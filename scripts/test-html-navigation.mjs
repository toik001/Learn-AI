#!/usr/bin/env node

import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const fixtureRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "study-navigation-test-"),
);

const decodeEntities = (value) =>
  String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");

const attribute = (html, name) =>
  new RegExp(`(?:^|\\s)${name}\\s*=\\s*"([^"]*)"`, "i").exec(html)?.[1] ?? "";

const readerFixture = ({
  title,
  category,
  heading = '<h2 id="section">Section</h2>',
  toc = '<aside class="toc-sidebar"><p>legacy</p></aside>',
}) => `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="fixture">
  <meta name="study-category" content="${category}">
  <meta name="study-date" content="2026-07-27">
  <title>${title}</title>
  <link rel="stylesheet" href="../../assets/style.css">
</head>
<body>
<div class="reader-layout">
  <aside class="doc-sidebar">
    <div class="sidebar-header"><a href="../../index.html">首页</a></div>
    <label class="sidebar-search"><input type="search" placeholder="筛选文档…"></label>
    <nav class="doc-nav" aria-label="文档列表"></nav>
  </aside>
  <main class="article-column">
    <article><h1 id="title">${title}</h1>${heading}</article>
  </main>
  ${toc}
</div>
</body>
</html>`;

const tocAsides = (html) =>
  [...html.matchAll(/<aside\b([^>]*)>([\s\S]*?)<\/aside>/gi)].filter(
    (match) =>
      attribute(match[1], "class").split(/\s+/).includes("toc-sidebar"),
  );

try {
  await fs.cp(path.join(rootDir, "public"), path.join(fixtureRoot, "public"), {
    recursive: true,
  });
  await fs.mkdir(path.join(fixtureRoot, "scripts"), { recursive: true });
  await fs.copyFile(
    path.join(rootDir, "scripts", "build-html-index.mjs"),
    path.join(fixtureRoot, "scripts", "build-html-index.mjs"),
  );

  const fixtureNotes = path.join(
    fixtureRoot,
    "public",
    "notes",
    "navigation-fixtures",
  );
  await fs.mkdir(fixtureNotes, { recursive: true });
  await fs.writeFile(
    path.join(fixtureNotes, "collision-slash.html"),
    readerFixture({ title: "Slash Category", category: "AI/ML" }),
  );
  await fs.writeFile(
    path.join(fixtureNotes, "collision-space.html"),
    readerFixture({ title: "Space Category", category: "AI ML" }),
  );
  await fs.writeFile(
    path.join(fixtureNotes, "toc-extra-attributes.html"),
    readerFixture({
      title: "TOC Attributes",
      category: "TOC Fixture",
      toc: '<aside data-fixture="legacy" class="secondary toc-sidebar" aria-label="旧目录"><p>legacy</p></aside>',
    }),
  );
  await fs.writeFile(
    path.join(fixtureNotes, "zero-headings.html"),
    readerFixture({
      title: "Zero Headings",
      category: "TOC Fixture",
      heading: "",
    }),
  );
  await fs.writeFile(
    path.join(fixtureNotes, "no-reader-layout.html"),
    `<!doctype html><html lang="zh-CN"><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width">
      <meta name="description" content="fixture">
      <meta name="study-category" content="No Layout">
      <meta name="study-date" content="2026-07-27"><title>No Layout</title>
    </head><body><main><article><h1 id="title">No Layout</h1><h2 id="section">Section</h2></article></main></body></html>`,
  );
  await fs.writeFile(
    path.join(fixtureNotes, "data-class-decoy.html"),
    `<!doctype html><html lang="zh-CN"><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width">
      <meta name="description" content="fixture">
      <meta name="study-category" content="No Layout">
      <meta name="study-date" content="2026-07-27"><title>Data Class Decoy</title>
    </head><body><div data-class="reader-layout"><main><article>
      <h1 id="title">Data Class Decoy</h1><h2 id="section">Section</h2>
    </article></main><aside data-class="toc-sidebar">decoy</aside></div></body></html>`,
  );

  const generated = spawnSync(
    process.execPath,
    ["scripts/build-html-index.mjs"],
    {
      cwd: fixtureRoot,
      encoding: "utf8",
    },
  );
  assert.equal(
    generated.status,
    0,
    `生成器执行失败：${generated.stderr || generated.stdout}`,
  );

  const publicDir = path.join(fixtureRoot, "public");
  const manifest = JSON.parse(
    await fs.readFile(path.join(publicDir, "manifest.json"), "utf8"),
  );
  const categoryCounts = new Map();
  for (const document of manifest.documents) {
    categoryCounts.set(
      document.category,
      (categoryCounts.get(document.category) ?? 0) + 1,
    );
  }

  for (const document of manifest.documents) {
    const outputPath = path.join(
      publicDir,
      ...document.output.split("/"),
    );
    const html = await fs.readFile(outputPath, "utf8");
    if (
      document.output.endsWith("no-reader-layout.html") ||
      document.output.endsWith("data-class-decoy.html")
    ) {
      assert.equal(
        tocAsides(html).length,
        0,
        "没有 reader-layout 的页面不得猜测插入右侧目录",
      );
      continue;
    }
    const nav =
      /<nav class="doc-nav" aria-label="当前分类文档">([\s\S]*?)<\/nav>/i.exec(
        html,
      )?.[1] ?? "";
    const items = [...nav.matchAll(/<a class="doc-nav-item([^"]*)"([^>]*)>/gi)];

    assert.equal(
      items.length,
      categoryCounts.get(document.category),
      `${document.output} 左侧导航必须只包含“${document.category}”分类文档`,
    );
    assert.equal(
      items.filter((item) => item[1].includes("is-active")).length,
      1,
      `${document.output} 必须恰有一个活动文档`,
    );
    assert.equal(
      items.filter((item) => attribute(item[2], "aria-current") === "page")
        .length,
      1,
      `${document.output} 当前文档必须带 aria-current="page"`,
    );
    const expectedCategoryOutputs = new Set(
      manifest.documents
        .filter((candidate) => candidate.category === document.category)
        .map((candidate) =>
          path.join(publicDir, ...candidate.output.split("/")),
        ),
    );
    for (const item of items) {
      const href = decodeEntities(attribute(item[2], "href"));
      assert.ok(
        expectedCategoryOutputs.has(path.resolve(path.dirname(outputPath), href)),
        `${document.output} 左侧出现跨分类链接：${href}`,
      );
    }

    const homeLink =
      /<a class="sidebar-home-link"([^>]*)>/i.exec(html)?.[1] ?? "";
    const homeHref = decodeEntities(attribute(homeLink, "href"));
    assert.ok(homeHref, `${document.output} 缺少知识库首页入口`);
    assert.equal(
      path.resolve(path.dirname(outputPath), homeHref.split("#")[0]),
      path.join(publicDir, "index.html"),
      `${document.output} 首页入口目标错误`,
    );

    const categoryLink =
      /<a class="sidebar-category-link"([^>]*)>/i.exec(html)?.[1] ?? "";
    const categoryHref = decodeEntities(attribute(categoryLink, "href"));
    assert.match(
      categoryHref,
      /index\.html#[^#]+$/,
      `${document.output} 缺少当前分类首页锚点入口`,
    );

    const categoryMain = manifest.documents.find(
      (candidate) =>
        candidate.category === document.category &&
        /主目录|总览/.test(candidate.title),
    );
    if (categoryMain) {
      const featuredLink =
        /<a class="sidebar-featured-link"([^>]*)>/i.exec(html)?.[1] ?? "";
      const featuredHref = decodeEntities(attribute(featuredLink, "href"));
      assert.equal(
        path.resolve(path.dirname(outputPath), featuredHref),
        path.join(publicDir, ...categoryMain.output.split("/")),
        `${document.output} 必须保留分类主目录便捷入口`,
      );
    }

    const footerPager =
      /<footer class="article-footer">[\s\S]*?<nav class="pager" aria-label="上一篇和下一篇">([\s\S]*?)<\/nav>[\s\S]*?<\/footer>/i.exec(
        html,
      )?.[1] ?? "";
    assert.ok(footerPager, `${document.output} 缺少篇章页尾导航`);
    const pagerLinks = [
      ...footerPager.matchAll(/<a class="pager-link[^"]*"([^>]*)>/gi),
    ];
    for (const pagerLink of pagerLinks) {
      const href = decodeEntities(attribute(pagerLink[1], "href"));
      assert.ok(
        expectedCategoryOutputs.has(
          path.resolve(path.dirname(outputPath), href),
        ),
        `${document.output} 页尾导航出现跨分类链接：${href}`,
      );
    }

    const asides = tocAsides(html);
    assert.equal(
      asides.length,
      1,
      `${document.output} 必须恰有一个右侧目录`,
    );
    const toc = asides[0][2];
    if (document.sections === 0) {
      assert.match(
        toc,
        /class="toc-empty"/,
        `${document.output} 零标题页面必须显示目录空状态`,
      );
    } else {
      assert.match(
        toc,
        /<ol class="toc-list">/,
        `${document.output} 右侧目录必须使用统一 toc-list`,
      );
    }
    const tocLinks = [...toc.matchAll(/<a href="#([^"]+)"/gi)];
    assert.equal(
      tocLinks.length,
      document.sections,
      `${document.output} 目录条目数必须等于 h2～h4 数量`,
    );
    for (const link of tocLinks) {
      assert.ok(
        html.includes(`id="${decodeEntities(link[1])}"`),
        `${document.output} 目录锚点不存在：#${link[1]}`,
      );
    }
  }

  const indexHtml = await fs.readFile(path.join(publicDir, "index.html"), "utf8");
  const entryGrid =
    /<nav class="category-entry-grid"[^>]*>([\s\S]*?)<\/nav>/i.exec(
      indexHtml,
    )?.[1] ?? "";
  const categoryEntries = [
    ...entryGrid.matchAll(
      /<a class="category-entry-card"([^>]*)>([\s\S]*?)<\/a>/gi,
    ),
  ];
  assert.equal(
    categoryEntries.length,
    categoryCounts.size,
    "首页大分类入口数量必须等于唯一分类数量",
  );
  const entryTargets = new Set();
  for (const entry of categoryEntries) {
    const href = decodeEntities(attribute(entry[1], "href"));
    assert.match(href, /^#[^#]+$/, "分类入口必须使用同页稳定锚点");
    entryTargets.add(href);
    assert.ok(
      indexHtml.includes(`id="${href.slice(1)}"`),
      `首页缺少分类区块 ${href}`,
    );
    assert.match(
      entry[2],
      /<p>[^<]+<\/p>/,
      `分类入口 ${href} 必须包含简短说明`,
    );
  }
  assert.equal(entryTargets.size, categoryCounts.size, "分类入口锚点必须唯一");
  for (const category of categoryCounts.keys()) {
    assert.ok(entryGrid.includes(category), `首页缺少“${category}”分类入口`);
  }

  const css = await fs.readFile(
    path.join(publicDir, "assets", "style.css"),
    "utf8",
  );
  const tocRule =
    /\.toc-list a,\s*\.toc-nav a\s*\{([\s\S]*?)\}/i.exec(css)?.[1] ?? "";
  assert.match(tocRule, /white-space:\s*normal/, "右侧目录必须允许自然换行");
  assert.match(
    tocRule,
    /overflow-wrap:\s*anywhere/,
    "右侧目录必须允许长词折行",
  );
  assert.match(
    tocRule,
    /word-break:\s*break-word/,
    "右侧目录必须处理连续英文或路径",
  );

  console.log(
    `PASS: ${manifest.documents.length} 个真实页面与边界夹具按 ${categoryCounts.size} 个分类生成导航与目录`,
  );
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}
