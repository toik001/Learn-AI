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
    order: 1,
    images: ["ddd-landscape.svg", "ddd-learning-roadmap.svg"],
  },
  foundation: {
    file: "2026-08-11-DDD基础概念与统一语言.html",
    order: 2,
    images: ["ubiquitous-language-loop.svg"],
  },
  strategic: {
    file: "2026-08-11-DDD战略设计与限界上下文.html",
    order: 3,
    images: ["subdomain-context-boundaries.svg", "context-map.svg"],
  },
  tactical: {
    file: "2026-08-11-DDD战术设计与领域模型.html",
    order: 4,
    images: ["aggregate-consistency-boundary.svg", "tactical-building-blocks.svg"],
  },
  layers: {
    file: "2026-08-11-DDD分层架构模式对比.html",
    order: 5,
    images: ["architecture-comparison.svg", "dependency-rule.svg"],
  },
  java: {
    file: "2026-08-11-DDD订单领域Java实践.html",
    order: 6,
    images: ["order-use-case-event-flow.svg"],
  },
  adoption: {
    file: "2026-08-11-DDD落地演进与常见误区.html",
    order: 7,
    images: ["adoption-evolution.svg"],
  },
};

const expectedPageOrder = Object.values(pages).map((page) => page.file);

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
  for (const [, styleBlock] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const reference of styleUrlReferences(styleBlock)) {
      assertAllowedResourceReference(reference, key, "style block url()");
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

  const figure = [...html.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi)]
    .map(([match]) => match)
    .find((candidate) =>
      matchingTags(candidate, "img").some((tag) => attribute(tag, "src") === assetUrl),
    );
  assert.ok(figure, `${key} 页面图片缺少对应 figure：${assetUrl}`);
  assert.match(figure, /<figcaption\b[^>]*>[\s\S]*?<\/figcaption>/i, `${key} 页面图片缺少对应图注：${assetUrl}`);
  const figureTag = matchingTags(figure, "figure")[0];
  const classes = (attribute(figureTag, "class") ?? "").split(/\s+/);
  assert.ok(classes.includes("diagram-figure"), `${key} 页面 DDD 图必须使用 diagram-figure：${assetUrl}`);
  assert.equal(attribute(figureTag, "tabindex"), "0", `${key} 页面可横向滚动的 DDD 图必须可键盘聚焦：${assetUrl}`);
  assert.ok(attribute(figureTag, "aria-label")?.trim(), `${key} 页面 DDD 图必须提供滚动提示：${assetUrl}`);
};

const assertNonEmptySvgTextElement = (svg, key, image, tagName) => {
  const svgWithoutComments = svg.replace(/<!--[\s\S]*?-->/g, "");
  const match = svgWithoutComments.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}\\s*>`, "i"));
  assert.ok(match, `${key} SVG 缺少可访问结构：${image} -> <${tagName}>`);
  const text = match[1].replace(/<[^>]*>/g, "").trim();
  assert.ok(text, `${key} SVG 可访问文本不能为空：${image} -> <${tagName}>`);
};

const keys = requestedKey ? [requestedKey] : Object.keys(pages);
const documents = new Map();
const svgDocuments = new Map();

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
  assertMeta(html, key, "study-order", String(page.order));
  assert.ok(matchingTags(html, "link").some((tag) => attribute(tag, "href") === "../../assets/style.css"), `${key} 页面缺少共享样式 ../../assets/style.css`);
  assert.ok(matchingTags(html, "script").some((tag) => attribute(tag, "src") === "../../assets/app.js"), `${key} 页面缺少共享脚本 ../../assets/app.js`);
  assert.match(html, /<h[1-6]\b[^>]*\bid=["']核心结论["'][^>]*>\s*核心结论\s*<\/h[1-6]>/i, `${key} 页面缺少“核心结论”结构锚点`);
  assert.match(html, /<h[1-6]\b[^>]*\bid=["']参考资料["'][^>]*>\s*参考资料\s*<\/h[1-6]>/i, `${key} 页面缺少“参考资料”结构锚点`);
  assert.match(html, /<figure\b/i, `${key} 页面至少需要一个 <figure>`);
  assert.doesNotMatch(html, /mobile-backdrop/, `${key} 页面不得保留失效的 mobile-backdrop`);
  const scrims = matchingTags(html, "div").filter((tag) =>
    (attribute(tag, "class") ?? "").split(/\s+/).includes("sidebar-scrim"),
  );
  assert.equal(scrims.length, 1, `${key} 页面必须恰有一个 sidebar-scrim`);
  assert.equal(attribute(scrims[0], "aria-hidden"), "true", `${key} 页面 sidebar-scrim 必须从可访问树隐藏`);
  assertNoAbsoluteLocalResources(html, key);

  for (const image of page.images) {
    assertExpectedImage(html, key, image);
    const svg = await readRequired(path.join(assetsDir, image), `${key} 页面 SVG 资源 ${image}`);
    svgDocuments.set(image, svg);
    for (const marker of ["<svg", "viewBox="]) {
      assert.ok(svg.includes(marker), `${key} SVG 缺少可访问结构：${image} -> ${marker}`);
    }
    assertNonEmptySvgTextElement(svg, key, image, "title");
    assertNonEmptySvgTextElement(svg, key, image, "desc");
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
  const expectedPageFiles = expectedPageOrder;
  const expectedAssetFiles = Object.values(pages).flatMap((page) => page.images);
  const pageFiles = (await readDirectory(notesDir, "DDD 页面目录")).filter((file) => file.endsWith(".html"));
  const assetFiles = (await readDirectory(assetsDir, "DDD SVG 目录")).filter((file) => file.endsWith(".svg"));
  assertExactFileSet(pageFiles, expectedPageFiles, "DDD 学习页面");
  assertExactFileSet(assetFiles, expectedAssetFiles, "DDD SVG 资源");

  const studyOrders = Object.entries(pages).map(([key, page]) => {
    const tag = matchingTags(documents.get(key), "meta")
      .find((candidate) => attribute(candidate, "name") === "study-order");
    return Number(attribute(tag, "content"));
  });
  assert.deepEqual(studyOrders, [1, 2, 3, 4, 5, 6, 7], "DDD 七篇必须声明连续的学习顺序 1–7");
  assert.equal(new Set(studyOrders).size, 7, "DDD 七篇 study-order 必须唯一");

  for (const [key, page] of Object.entries(pages)) {
    const html = documents.get(key);
    const sidebarOrder = matchingTags(
      /<nav class="doc-nav"[^>]*>([\s\S]*?)<\/nav>/i.exec(html)?.[1] ?? "",
      "a",
    )
      .map((tag) => path.basename(attribute(tag, "href") ?? ""))
      .filter((file) => expectedPageOrder.includes(file));
    assert.deepEqual(sidebarOrder, expectedPageOrder, `${key} 页面生成侧栏必须遵循 study-order`);

    const featured = matchingTags(html, "a").find((tag) =>
      (attribute(tag, "class") ?? "").split(/\s+/).includes("sidebar-featured-link"),
    );
    assert.equal(
      path.basename(attribute(featured, "href") ?? ""),
      expectedPageOrder[0],
      `${key} 页面分类主目录快捷入口必须指向第 1 篇`,
    );

    const footer = /<footer class="article-footer">([\s\S]*?)<\/footer>/i.exec(html)?.[1] ?? "";
    const previous = matchingTags(footer, "a").find((tag) =>
      (attribute(tag, "class") ?? "").split(/\s+/).includes("previous"),
    );
    const next = matchingTags(footer, "a").find((tag) =>
      (attribute(tag, "class") ?? "").split(/\s+/).includes("next"),
    );
    const index = expectedPageOrder.indexOf(page.file);
    assert.equal(
      previous ? path.basename(attribute(previous, "href")) : null,
      index > 0 ? expectedPageOrder[index - 1] : null,
      `${key} 页面生成的上一篇不符合 study-order`,
    );
    assert.equal(
      next ? path.basename(attribute(next, "href")) : null,
      index < expectedPageOrder.length - 1 ? expectedPageOrder[index + 1] : null,
      `${key} 页面生成的下一篇不符合 study-order`,
    );

    for (const [otherKey, otherPage] of Object.entries(pages)) {
      if (otherKey === key) continue;
      assert.ok(
        matchingTags(html, "a").some((tag) => attribute(tag, "href") === otherPage.file),
        `${key} 页面缺少专题互链：${otherPage.file}`,
      );
    }
  }

  const indexHtml = await readRequired(path.join(rootDir, "index.html"), "知识库入口");
  const indexOrder = matchingTags(indexHtml, "a")
    .filter((tag) => (attribute(tag, "class") ?? "").split(/\s+/).includes("card-link"))
    .map((tag) => path.basename(attribute(tag, "href") ?? ""))
    .filter((file) => expectedPageOrder.includes(file));
  assert.deepEqual(indexOrder, expectedPageOrder, "知识库入口的 DDD 卡片必须遵循 study-order");

  const manifest = JSON.parse(await readRequired(path.join(rootDir, "public", "manifest.json"), "知识库 manifest"));
  const manifestDdd = manifest.documents.filter((document) =>
    expectedPageOrder.includes(path.basename(document.output)),
  );
  assert.deepEqual(
    manifestDdd.map((document) => path.basename(document.output)),
    expectedPageOrder,
    "manifest 中的 DDD 记录必须遵循 study-order",
  );
  assert.deepEqual(
    manifestDdd.map((document) => document.studyOrder),
    [1, 2, 3, 4, 5, 6, 7],
    "manifest 必须保留 DDD study-order",
  );

  for (const [key, html] of documents) {
    assert.doesNotMatch(html, /OrderCreated/, `${key} 页面不得保留与提交触发语义冲突的 OrderCreated`);
  }
  for (const [image, svg] of svgDocuments) {
    assert.doesNotMatch(svg, /OrderCreated/, `${image} 不得保留与提交触发语义冲突的 OrderCreated`);
  }
  for (const image of ["aggregate-consistency-boundary.svg", "order-use-case-event-flow.svg"]) {
    const svg = svgDocuments.get(image);
    assert.match(svg, /OrderSubmitted/, `${image} 必须显示内部 OrderSubmitted`);
    assert.match(svg, /OrderSubmittedV1/, `${image} 必须显示外部 OrderSubmittedV1`);
    assert.match(svg, /Payment/, `${image} 必须显示 Payment 消费者`);
    assert.match(svg, /Inventory/, `${image} 必须显示 Inventory 消费者`);
  }

  const contextMap = svgDocuments.get("context-map.svg");
  assert.doesNotMatch(contextMap, /核心模型\s*·\s*下游\/客户/, "context-map 不得给 Order 固定全局下游/客户角色");
  assert.doesNotMatch(contextMap, /上游制定契约/, "context-map 不得把所有 U/D 关系简化成上游单方面制定契约");
}

console.log(`PASS: DDD 架构七篇专题契约完整${requestedKey ? `（${requestedKey}）` : ""}`);
