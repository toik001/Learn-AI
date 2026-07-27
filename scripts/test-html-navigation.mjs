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
  new RegExp(`\\b${name}="([^"]*)"`, "i").exec(html)?.[1] ?? "";

try {
  await fs.cp(path.join(rootDir, "public"), path.join(fixtureRoot, "public"), {
    recursive: true,
  });
  await fs.mkdir(path.join(fixtureRoot, "scripts"), { recursive: true });
  await fs.copyFile(
    path.join(rootDir, "scripts", "build-html-index.mjs"),
    path.join(fixtureRoot, "scripts", "build-html-index.mjs"),
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

    const toc =
      /<aside class="toc-sidebar">([\s\S]*?)<\/aside>/i.exec(html)?.[1] ??
      "";
    assert.match(
      toc,
      /<ol class="toc-list">/,
      `${document.output} 右侧目录必须使用统一 toc-list`,
    );
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
    ...entryGrid.matchAll(/<a class="category-entry-card"([^>]*)>/gi),
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
    `PASS: ${manifest.documents.length} 篇文档按 ${categoryCounts.size} 个分类生成导航与目录`,
  );
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}
