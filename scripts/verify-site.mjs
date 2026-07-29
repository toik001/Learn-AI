#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
if (
  args.length > 2 ||
  (args.length > 0 && rootIndex === -1) ||
  (rootIndex !== -1 && !args[rootIndex + 1])
) {
  console.error("用法：node scripts/verify-site.mjs [--root <目录>]");
  process.exit(2);
}

const siteRoot = path.resolve(
  rootIndex === -1 ? path.join(process.cwd(), "public") : args[rootIndex + 1],
);
const errors = [];
const files = new Set();
const htmlByFile = new Map();
const idsByFile = new Map();
let localReferenceCount = 0;

const decodeEntities = (value) =>
  String(value)
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );

const decodeUrlPart = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const relativePath = (file) =>
  path.relative(siteRoot, file).split(path.sep).join("/") || ".";

const report = (file, message, value = "") => {
  const suffix = value ? ` — ${value}` : "";
  errors.push(`${relativePath(file)}: ${message}${suffix}`);
};

async function collectFiles(directory) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    errors.push(`.: 无法读取站点目录 — ${error.message}`);
    return;
  }

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      report(absolutePath, "GitHub Pages artifact 禁止符号链接");
    } else if (entry.isDirectory()) {
      await collectFiles(absolutePath);
    } else if (entry.isFile()) {
      files.add(absolutePath);
    }
  }
}

function attributesOf(source) {
  const attributes = new Map();
  const pattern =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    attributes.set(
      match[1].toLowerCase(),
      decodeEntities(match[2] ?? match[3] ?? match[4] ?? ""),
    );
  }
  return attributes;
}

function tagsOf(html) {
  return [...html.matchAll(/<([a-z][\w:-]*)\b([^>]*)>/gi)].map((match) => ({
    name: match[1].toLowerCase(),
    attributes: attributesOf(match[2]),
  }));
}

function metaContent(html, name) {
  for (const tag of tagsOf(html)) {
    if (
      tag.name === "meta" &&
      tag.attributes.get("name")?.toLowerCase() === name.toLowerCase()
    ) {
      return tag.attributes.get("content")?.trim() ?? "";
    }
  }
  return "";
}

function stripHtml(value) {
  return decodeEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function headingText(value) {
  return stripHtml(
    value.replace(
      /<a\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bheading-anchor\b[^"']*["'])[^>]*>[\s\S]*?<\/a>/gi,
      "",
    ),
  );
}

function collectIds(file, html) {
  const ids = new Set();
  for (const tag of tagsOf(html)) {
    const id = tag.attributes.get("id");
    if (!id) continue;
    if (ids.has(id)) {
      report(file, "重复 id", id);
    }
    ids.add(id);
  }
  idsByFile.set(file, ids);
}

function validateKnowledgePage(file, html) {
  if (!relativePath(file).startsWith("notes/")) return;

  const requiredTags = ["header", "nav", "main", "article"];
  for (const tagName of requiredTags) {
    if (!new RegExp(`<${tagName}\\b`, "i").test(html)) {
      report(file, `知识页缺少 <${tagName}>`);
    }
  }

  if (!/<meta\b[^>]*charset=["']?utf-8["']?[^>]*>/i.test(html)) {
    report(file, "知识页缺少 utf-8 charset");
  }
  for (const name of [
    "viewport",
    "description",
    "study-category",
    "study-date",
  ]) {
    if (!metaContent(html, name)) {
      report(file, `知识页缺少 meta ${name}`);
    }
  }
  if (!/<title\b[^>]*>[\s\S]*?\S[\s\S]*?<\/title>/i.test(html)) {
    report(file, "知识页缺少非空 title");
  }

  const headings = [...html.matchAll(/<(h[2-4])\b([^>]*)>([\s\S]*?)<\/\1>/gi)];
  for (const heading of headings) {
    if (!attributesOf(heading[2]).get("id")) {
      report(file, `${heading[1].toLowerCase()} 缺少稳定 id`, headingText(heading[3]));
    }
  }
  const headingTexts = new Set(headings.map((heading) => headingText(heading[3])));
  for (const requiredHeading of ["核心结论", "参考资料"]) {
    if (!headingTexts.has(requiredHeading)) {
      report(file, `知识页缺少“${requiredHeading}”章节`);
    }
  }
}

const referenceAttributes = new Map([
  ["a", ["href"]],
  ["audio", ["src"]],
  ["iframe", ["src"]],
  ["img", ["src"]],
  ["link", ["href"]],
  ["object", ["data"]],
  ["script", ["src"]],
  ["source", ["src"]],
  ["video", ["src", "poster"]],
]);

function isExternal(reference) {
  return /^(?:https?:)?\/\//i.test(reference);
}

function validateExternalLink(file, attributes, reference) {
  if (attributes.get("target")?.toLowerCase() !== "_blank") {
    report(file, "外部链接必须使用安全新窗口属性", reference);
    return;
  }
  const rel = new Set(
    (attributes.get("rel") ?? "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean),
  );
  if (!rel.has("noopener") || !rel.has("noreferrer")) {
    report(file, "外部链接必须使用安全新窗口属性", reference);
  }
}

function resolveLocalTarget(file, reference) {
  const hashIndex = reference.indexOf("#");
  const fragment =
    hashIndex === -1
      ? ""
      : decodeUrlPart(decodeEntities(reference.slice(hashIndex + 1)));
  const beforeHash = hashIndex === -1 ? reference : reference.slice(0, hashIndex);
  const queryIndex = beforeHash.indexOf("?");
  const rawPath = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
  const decodedPath = decodeUrlPart(decodeEntities(rawPath));
  let target = decodedPath
    ? path.resolve(path.dirname(file), decodedPath)
    : file;

  if (target !== siteRoot && !target.startsWith(`${siteRoot}${path.sep}`)) {
    report(file, "本地引用越出 public 目录", reference);
    return;
  }
  if (!files.has(target) && files.has(path.join(target, "index.html"))) {
    target = path.join(target, "index.html");
  }
  if (!files.has(target)) {
    report(file, "本地目标不存在", reference);
    return;
  }

  localReferenceCount += 1;
  if (fragment && path.extname(target).toLowerCase() === ".html") {
    const ids = idsByFile.get(target);
    if (!ids?.has(fragment)) {
      report(file, "片段锚点不存在", reference);
    }
  }
}

function validateReferences(file, html) {
  for (const tag of tagsOf(html)) {
    const attributeNames = referenceAttributes.get(tag.name);
    if (!attributeNames) continue;

    for (const attributeName of attributeNames) {
      const rawReference = tag.attributes.get(attributeName);
      if (rawReference === undefined) continue;
      const reference = rawReference.trim();
      if (!reference) continue;

      if (isExternal(reference)) {
        if (tag.name === "a" && attributeName === "href") {
          validateExternalLink(file, tag.attributes, reference);
        }
        continue;
      }
      if (reference.startsWith("/")) {
        report(file, "禁止根路径引用", reference);
        continue;
      }
      if (/^javascript:/i.test(reference)) {
        report(file, "禁止 javascript: URL", reference);
        continue;
      }
      if (/^(?:mailto|tel|data):/i.test(reference)) continue;
      if (/^[a-z][a-z\d+.-]*:/i.test(reference)) {
        report(file, "不支持的 URL scheme", reference);
        continue;
      }
      resolveLocalTarget(file, reference);
    }
  }
}

await collectFiles(siteRoot);

const entryFile = path.join(siteRoot, "index.html");
if (!files.has(entryFile)) {
  errors.push("index.html: GitHub Pages artifact 根目录缺少入口文件");
}

for (const file of files) {
  if (path.extname(file).toLowerCase() !== ".html") continue;
  const html = await fs.readFile(file, "utf8");
  htmlByFile.set(file, html);
  collectIds(file, html);
  validateKnowledgePage(file, html);
}

for (const [file, html] of htmlByFile) {
  validateReferences(file, html);
}

for (const file of files) {
  if (path.extname(file).toLowerCase() !== ".css") continue;
  const css = await fs.readFile(file, "utf8");
  for (const match of css.matchAll(/url\(\s*["']?(\/[^)"']*)/gi)) {
    report(file, "CSS 禁止根路径引用", match[1]);
  }
}

if (errors.length > 0) {
  console.error(`FAIL: 站点完整性校验发现 ${errors.length} 个问题`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `PASS: ${htmlByFile.size} 个 HTML、${localReferenceCount} 个本地引用通过站点完整性校验`,
);
