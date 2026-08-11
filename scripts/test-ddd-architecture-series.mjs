#!/usr/bin/env node

import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const notesDir = path.join(rootDir, "public", "notes", "architecture");
const assetsDir = path.join(rootDir, "public", "assets", "ddd");

const pages = {
  overview: {
    file: "2026-08-11-DDD架构总览与学习路线.html",
    images: ["ddd-landscape.svg", "ddd-learning-roadmap.svg"],
  },
  foundation: {
    file: "2026-08-11-DDD基础概念与统一语言.html",
    images: ["ubiquitous-language-loop.svg"],
  },
  strategic: {
    file: "2026-08-11-DDD战略设计与限界上下文.html",
    images: ["subdomain-context-boundaries.svg", "context-map.svg"],
  },
  tactical: {
    file: "2026-08-11-DDD战术设计与领域模型.html",
    images: ["aggregate-consistency-boundary.svg", "tactical-building-blocks.svg"],
  },
  layers: {
    file: "2026-08-11-DDD分层架构模式对比.html",
    images: ["architecture-comparison.svg", "dependency-rule.svg"],
  },
  java: {
    file: "2026-08-11-DDD订单领域Java实践.html",
    images: ["order-use-case-event-flow.svg"],
  },
  adoption: {
    file: "2026-08-11-DDD落地演进与常见误区.html",
    images: ["adoption-evolution.svg"],
  },
};

const args = process.argv.slice(2);
let requestedKey = null;
if (args.length > 0) {
  assert.equal(args.length, 2, "用法：node scripts/test-ddd-architecture-series.mjs [--page overview|foundation|strategic|tactical|layers|java|adoption]");
  assert.equal(args[0], "--page", "唯一可选参数是 --page <key>");
  assert.ok(pages[args[1]], `未知页面键：${args[1]}`);
  requestedKey = args[1];
}

const readRequired = async (filePath, label) => {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    assert.fail(`${label}不存在：${path.relative(rootDir, filePath)}（${error.code}）`);
  }
};

const readDirectory = async (directoryPath, label) => {
  try {
    return await fs.readdir(directoryPath);
  } catch (error) {
    assert.fail(`${label}不存在：${path.relative(rootDir, directoryPath)}（${error.code}）`);
  }
};

const assertExactFileSet = (actualFiles, expectedFiles, label) => {
  const actual = [...actualFiles].sort();
  const expected = [...expectedFiles].sort();
  assert.deepEqual(actual, expected, `${label}必须与规划文件集合完全一致`);
};

const matchingTags = (html, tagName) =>
  [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi"))].map(([tag]) => tag);

const attribute = (tag, name) => {
  const match = tag.match(new RegExp(`\\b${name}=(["'])(.*?)\\1`, "i"));
  return match?.[2];
};

const attributeValues = (tag, name) =>
  [...tag.matchAll(new RegExp(`\\b${name}=(["'])(.*?)\\1`, "gi"))].map(([, , value]) => value);

const isAbsoluteLocalReference = (reference) =>
  reference.startsWith("/")
  || reference.startsWith("\\\\")
  || /^file:/i.test(reference)
  || /^[a-z]:[\\/]/i.test(reference)
  || /^~[\\/]/.test(reference);

const srcsetCandidates = (srcset) =>
  [...srcset.matchAll(/(?:^|,\s*)(data:[^\s]+|blob:[^\s]+|https?:\/\/[^\s]+|[^\s,]+)(?=\s|,|$)/gi)]
    .map(([, reference]) => reference);

const styleUrlReferences = (style) =>
  [...style.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi)]
    .map(([, doubleQuoted, singleQuoted, unquoted]) => doubleQuoted ?? singleQuoted ?? unquoted);

const assertAllowedResourceReference = (reference, key, attributeName) => {
  assert.ok(
    !isAbsoluteLocalReference(reference),
    `${key} 页面不得使用本地绝对或根路径资源：${attributeName}="${reference}"`,
  );
};

const assertNoAbsoluteLocalResources = (html, key) => {
  for (const tag of [...html.matchAll(/<[a-z][\w:-]*\b[^>]*>/gi)].map(([match]) => match)) {
    for (const name of ["href", "src", "poster", "data"]) {
      for (const reference of attributeValues(tag, name)) {
        assertAllowedResourceReference(reference, key, name);
      }
    }
    for (const name of ["srcset", "imagesrcset"]) {
      for (const srcset of attributeValues(tag, name)) {
        for (const reference of srcsetCandidates(srcset)) {
          assertAllowedResourceReference(reference, key, name);
        }
      }
    }
    for (const style of attributeValues(tag, "style")) {
      for (const reference of styleUrlReferences(style)) {
        assertAllowedResourceReference(reference, key, "style url()");
      }
    }
  }
};

const assertMeta = (html, key, name, expectedValue) => {
  const tag = matchingTags(html, "meta").find((candidate) => attribute(candidate, "name") === name);
  assert.ok(tag, `${key} 页面缺少 ${name} 元数据`);
  const value = attribute(tag, "content");
  assert.notEqual(value, undefined, `${key} 页面 ${name} 元数据缺少 content`);
  if (expectedValue) {
    assert.equal(value, expectedValue, `${key} 页面 ${name} 元数据不正确`);
  } else {
    assert.ok(value.trim(), `${key} 页面 description 不能为空`);
  }
};

const assertExpectedImage = (html, key, image) => {
  const assetUrl = `../../assets/ddd/${image}`;
  const imageTags = matchingTags(html, "img");
  const imageTag = imageTags.find((candidate) => attribute(candidate, "src") === assetUrl);
  assert.ok(imageTag, `${key} 页面缺少图片：${assetUrl}`);
  assert.ok(attribute(imageTag, "alt")?.trim(), `${key} 页面图片 alt 不能为空：${assetUrl}`);

  const hasCaptionedFigure = [...html.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi)].some(([figure]) =>
    matchingTags(figure, "img").some((candidate) => attribute(candidate, "src") === assetUrl)
      && /<figcaption\b[^>]*>[\s\S]*?<\/figcaption>/i.test(figure),
  );
  assert.ok(hasCaptionedFigure, `${key} 页面图片缺少对应图注：${assetUrl}`);
};

const keys = requestedKey ? [requestedKey] : Object.keys(pages);
const documents = new Map();

for (const key of keys) {
  const page = pages[key];
  const html = await readRequired(path.join(notesDir, page.file), `${key} 页面`);
  documents.set(key, html);

  for (const tag of ["header", "nav", "main", "article"]) {
    assert.match(html, new RegExp(`<${tag}\\b`, "i"), `${key} 页面缺少 <${tag}>`);
  }

  assert.match(html, /<meta\b[^>]*\bcharset=["']utf-8["'][^>]*>/i, `${key} 页面缺少 <meta charset="utf-8">`);
  assertMeta(html, key, "viewport");
  assertMeta(html, key, "description");
  assertMeta(html, key, "study-category", "软件架构与 DDD");
  assertMeta(html, key, "study-date", "2026-08-11");
  assert.ok(matchingTags(html, "link").some((tag) => attribute(tag, "href") === "../../assets/style.css"), `${key} 页面缺少共享样式 ../../assets/style.css`);
  assert.ok(matchingTags(html, "script").some((tag) => attribute(tag, "src") === "../../assets/app.js"), `${key} 页面缺少共享脚本 ../../assets/app.js`);
  assert.match(html, /<h[1-6]\b[^>]*\bid=["']核心结论["'][^>]*>\s*核心结论\s*<\/h[1-6]>/i, `${key} 页面缺少“核心结论”结构锚点`);
  assert.match(html, /<h[1-6]\b[^>]*\bid=["']参考资料["'][^>]*>\s*参考资料\s*<\/h[1-6]>/i, `${key} 页面缺少“参考资料”结构锚点`);
  assert.match(html, /<figure\b/i, `${key} 页面至少需要一个 <figure>`);
  assertNoAbsoluteLocalResources(html, key);

  for (const image of page.images) {
    assertExpectedImage(html, key, image);
    const svg = await readRequired(path.join(assetsDir, image), `${key} 页面 SVG 资源 ${image}`);
    for (const marker of ["<svg", "<title>", "<desc>", "viewBox="]) {
      assert.ok(svg.includes(marker), `${key} SVG 缺少可访问结构：${image} -> ${marker}`);
    }
  }

  assert.ok(html.includes("2026-08-11"), `${key} 页面缺少可见或机器可读的检索日期 2026-08-11`);
  const externalLinks = [...html.matchAll(/<a\b([^>]*\bhref=["']https?:\/\/[^"']+["'][^>]*)>/gi)];
  assert.ok(externalLinks.length >= 4, `${key} 页面至少需要四个 HTTP(S) 参考链接`);
  for (const [, attributes] of externalLinks) {
    assert.match(attributes, /\btarget=["']_blank["']/i, `${key} 页面外链缺少 target="_blank"`);
    assert.match(attributes, /\brel=["']noopener noreferrer["']/i, `${key} 页面外链缺少 rel="noopener noreferrer"`);
  }
}

if (!requestedKey) {
  const expectedPageFiles = Object.values(pages).map((page) => page.file);
  const expectedAssetFiles = Object.values(pages).flatMap((page) => page.images);
  const pageFiles = (await readDirectory(notesDir, "DDD 页面目录")).filter((file) => file.endsWith(".html"));
  const assetFiles = (await readDirectory(assetsDir, "DDD SVG 目录")).filter((file) => file.endsWith(".svg"));
  assertExactFileSet(pageFiles, expectedPageFiles, "DDD 学习页面");
  assertExactFileSet(assetFiles, expectedAssetFiles, "DDD SVG 资源");

  for (const [key, page] of Object.entries(pages)) {
    const html = documents.get(key);
    for (const [otherKey, otherPage] of Object.entries(pages)) {
      if (otherKey === key) continue;
      assert.ok(
        matchingTags(html, "a").some((tag) => attribute(tag, "href") === otherPage.file),
        `${key} 页面缺少专题互链：${otherPage.file}`,
      );
    }
  }
}

console.log(`PASS: DDD 架构七篇专题契约完整${requestedKey ? `（${requestedKey}）` : ""}`);
