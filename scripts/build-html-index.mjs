#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");

const posixPath = (value) => value.split(path.sep).join("/");

const htmlEscape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const attributeEscape = (value) => htmlEscape(value).replaceAll("`", "&#96;");

const decodeEntities = (value) =>
  String(value)
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));

const stripHtml = (value) =>
  decodeEntities(
    String(value)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );

const relativeUrl = (fromFile, toFile) => {
  const result = posixPath(path.relative(path.dirname(fromFile), toFile));
  return result || path.basename(toFile);
};

async function collectHtmlFiles(directory = publicDir) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === "assets") continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectHtmlFiles(absolutePath)));
    } else if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".html") &&
      absolutePath !== path.join(publicDir, "index.html")
    ) {
      files.push(absolutePath);
    }
  }

  return files.sort((left, right) =>
    left.localeCompare(right, "zh-CN", { numeric: true }),
  );
}

function metaContent(html, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameFirst = new RegExp(
    `<meta\\b[^>]*name=["']${escapedName}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    "i",
  ).exec(html);
  if (nameFirst) return decodeEntities(nameFirst[1]);

  const contentFirst = new RegExp(
    `<meta\\b[^>]*content=["']([^"']*)["'][^>]*name=["']${escapedName}["'][^>]*>`,
    "i",
  ).exec(html);
  return contentFirst ? decodeEntities(contentFirst[1]) : "";
}

function fallbackCategory(outputPath) {
  const relative = posixPath(path.relative(publicDir, outputPath));
  const segments = relative.split("/");
  if (relative === "AGENTS.html") return "项目指南";
  if (segments[0] === "notes" && segments[1]) {
    return segments[1].toLowerCase() === "codex"
      ? "Codex 与 AI 工程"
      : segments[1];
  }
  return segments.length > 1 ? segments[0] : "其他文档";
}

function extractHeadings(html) {
  return [...html.matchAll(/<h([2-4])\b[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/h\1>/gi)].map(
    (match) => ({
      level: Number(match[1]),
      id: decodeEntities(match[2]),
      text: stripHtml(match[3].replace(/<a\b[^>]*class=["']heading-anchor["'][^>]*>[\s\S]*?<\/a>/i, "")),
    }),
  );
}

function extractDocument(outputPath, html) {
  const titleMatch = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch
    ? stripHtml(
        titleMatch[1].replace(
          /<a\b[^>]*class=["']heading-anchor["'][^>]*>[\s\S]*?<\/a>/i,
          "",
        ),
      )
    : stripHtml(titleTag?.[1] ?? path.basename(outputPath, ".html"));
  const article = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(html)?.[1] ?? html;
  const headings = extractHeadings(article);
  const category = metaContent(html, "study-category") || fallbackCategory(outputPath);
  const date =
    metaContent(html, "study-date") ||
    stripHtml(/<time\b[^>]*>([\s\S]*?)<\/time>/i.exec(html)?.[1] ?? "");
  const description =
    metaContent(html, "description") ||
    stripHtml(article).slice(0, 160);
  const characters = stripHtml(article).replace(/\s/g, "").length;

  return {
    outputPath,
    relativePath: posixPath(path.relative(publicDir, outputPath)),
    html,
    title,
    category,
    date,
    description,
    headings,
    sectionCount: headings.length,
    characters,
    readingMinutes: Math.max(1, Math.ceil(characters / 500)),
  };
}

function categoryId(category) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < String(category).length; index += 1) {
    hash ^= String(category).charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  const slug = String(category)
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `category-${slug || "other"}-${(hash >>> 0).toString(36)}`;
}

function documentsInCategory(documents, category) {
  return documents.filter((document) => document.category === category);
}

function categoryMainDocument(documents) {
  return documents.find((document) => /主目录|总览/.test(document.title)) ?? null;
}

function categorySummary(documents) {
  const source = categoryMainDocument(documents) ?? documents[0];
  const description = source?.description?.trim() ?? "";
  if (!description) return "打开分类，查看完整学习资料与实践内容。";
  return description.length > 76
    ? `${description.slice(0, 76).trimEnd()}…`
    : description;
}

function classTokens(attributes) {
  const className =
    /(?:^|\s)class\s*=\s*["']([^"']*)["']/i.exec(attributes)?.[1] ?? "";
  return className.split(/\s+/).filter(Boolean);
}

function openingElementIndexByClass(html, tagName, className) {
  const openings = new RegExp(`<${tagName}\\b([^>]*)>`, "gi");
  for (const match of html.matchAll(openings)) {
    if (classTokens(match[1]).includes(className)) return match.index;
  }
  return -1;
}

function replaceElementByClass(html, tagName, className, replacement) {
  let replaced = false;
  const elements = new RegExp(
    `<${tagName}\\b([^>]*)>[\\s\\S]*?<\\/${tagName}>`,
    "gi",
  );
  const output = html.replace(elements, (element, attributes) => {
    if (replaced || !classTokens(attributes).includes(className)) {
      return element;
    }
    replaced = true;
    return replacement;
  });
  return { html: output, replaced };
}

function documentNavigation(categoryDocuments, currentDocument) {
  return categoryDocuments
    .map((document) => {
      const href = relativeUrl(currentDocument.outputPath, document.outputPath);
      const active =
        document.outputPath === currentDocument.outputPath ? " is-active" : "";
      const current =
        document.outputPath === currentDocument.outputPath
          ? ' aria-current="page"'
          : "";
      return `<a class="doc-nav-item${active}" href="${attributeEscape(href)}"${current}><span>${htmlEscape(document.title)}</span>${document.date ? `<small>${htmlEscape(document.date)}</small>` : ""}</a>`;
    })
    .join("");
}

function sidebarChrome(documents, currentDocument) {
  const categoryDocuments = documentsInCategory(
    documents,
    currentDocument.category,
  );
  const homeHref = relativeUrl(
    currentDocument.outputPath,
    path.join(publicDir, "index.html"),
  );
  const categoryHref = `${homeHref}#${categoryId(currentDocument.category)}`;
  const mainDocument = categoryMainDocument(categoryDocuments);
  const featured =
    mainDocument === null
      ? ""
      : `\n      <a class="sidebar-featured-link" href="${attributeEscape(relativeUrl(currentDocument.outputPath, mainDocument.outputPath))}">分类主目录<span>${htmlEscape(mainDocument.title)}</span></a>`;

  return `<div class="sidebar-header">
      <a class="sidebar-home-link" href="${attributeEscape(homeHref)}"><span aria-hidden="true">←</span>知识库首页</a>
      <button class="sidebar-close" type="button" aria-label="关闭文档列表">×</button>
    </div>
    <div class="sidebar-category-summary">
      <span class="eyebrow">当前分类</span>
      <a class="sidebar-category-link" href="${attributeEscape(categoryHref)}">
        <strong>${htmlEscape(currentDocument.category)}</strong>
        <small>${categoryDocuments.length} 篇文档</small>
      </a>${featured}
    </div>`;
}

function tableOfContents(document) {
  const content =
    document.headings.length === 0
      ? '<p class="toc-empty">本页暂无分节</p>'
      : `<ol class="toc-list">${document.headings
          .map(
            (heading) =>
              `<li class="toc-level-${heading.level}"><a href="#${attributeEscape(heading.id)}">${htmlEscape(heading.text)}</a></li>`,
          )
          .join("")}</ol>`;

  return `<aside class="toc-sidebar">
    <div class="toc-title">本页目录</div>
    <nav aria-label="本页目录">
      ${content}
    </nav>
    <a class="back-to-top" href="#">返回顶部 ↑</a>
  </aside>`;
}

function pager(documents, currentIndex, currentDocument) {
  const previous = currentIndex > 0 ? documents[currentIndex - 1] : null;
  const next =
    currentIndex < documents.length - 1 ? documents[currentIndex + 1] : null;

  return `<nav class="pager" aria-label="上一篇和下一篇">
        ${
          previous
            ? `<a class="pager-link previous" href="${attributeEscape(relativeUrl(currentDocument.outputPath, previous.outputPath))}"><small>上一篇</small><span>${htmlEscape(previous.title)}</span></a>`
            : '<span class="pager-spacer"></span>'
        }
        ${
          next
            ? `<a class="pager-link next" href="${attributeEscape(relativeUrl(currentDocument.outputPath, next.outputPath))}"><small>下一篇</small><span>${htmlEscape(next.title)}</span></a>`
            : '<span class="pager-spacer"></span>'
        }
      </nav>`;
}

function articleFooter(documents, currentIndex, currentDocument) {
  return `    <footer class="article-footer">
      <div class="source-path">HTML 页面：<code>${htmlEscape(currentDocument.relativePath)}</code></div>
      ${pager(documents, currentIndex, currentDocument)}
    </footer>`;
}

function ensureMeta(html, name, value) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existing = new RegExp(
    `<meta\\b(?=[^>]*name=["']${escapedName}["'])[^>]*>`,
    "i",
  );
  const tag = `<meta name="${attributeEscape(name)}" content="${attributeEscape(value)}">`;
  if (existing.test(html)) return html.replace(existing, tag);
  return html.replace("</head>", `  ${tag}\n</head>`);
}

function updateDocumentHtml(document, documents) {
  let updated = document.html;
  const categoryDocuments = documentsInCategory(
    documents,
    document.category,
  );
  const categoryIndex = categoryDocuments.findIndex(
    (candidate) => candidate.outputPath === document.outputPath,
  );
  updated = ensureMeta(updated, "study-category", document.category);
  updated = ensureMeta(updated, "study-date", document.date);
  updated = updated.replace(
    /<div class="sidebar-header">[\s\S]*?<\/div>(?:\s*<div class="sidebar-category-summary">[\s\S]*?<\/div>)?/i,
    sidebarChrome(documents, document),
  );
  updated = updated.replace(
    /placeholder="筛选文档…"/i,
    'placeholder="筛选当前分类…"',
  );
  updated = updated.replace(
    /<nav class="doc-nav" aria-label="[^"]*">[\s\S]*?<\/nav>/i,
    `<nav class="doc-nav" aria-label="当前分类文档">\n      ${documentNavigation(categoryDocuments, document)}\n    </nav>`,
  );
  const readerLayoutIndex = openingElementIndexByClass(
    updated,
    "div",
    "reader-layout",
  );
  if (readerLayoutIndex >= 0) {
    const beforeReader = updated.slice(0, readerLayoutIndex);
    const readerAndAfter = updated.slice(readerLayoutIndex);
    const tocReplacement = replaceElementByClass(
      readerAndAfter,
      "aside",
      "toc-sidebar",
      tableOfContents(document),
    );
    if (tocReplacement.replaced) {
      updated = beforeReader + tocReplacement.html;
    } else {
      const mainEnd = updated.indexOf("</main>", readerLayoutIndex);
      if (mainEnd >= 0) {
        const insertAt = mainEnd + "</main>".length;
        updated =
          updated.slice(0, insertAt) +
          `\n  ${tableOfContents(document)}` +
          updated.slice(insertAt);
      }
    }
  }
  const footer = articleFooter(categoryDocuments, categoryIndex, document);
  const existingFooter =
    /^[ \t]*<footer class="article-footer">[\s\S]*?<\/footer>/im;
  updated = existingFooter.test(updated)
    ? updated.replace(existingFooter, footer)
    : updated.replace(/^([ \t]*)<\/main>/im, `${footer}\n$1</main>`);
  return updated;
}

function renderIndex(documents) {
  const categories = new Map();
  for (const document of documents) {
    if (!categories.has(document.category)) categories.set(document.category, []);
    categories.get(document.category).push(document);
  }

  const totalCharacters = documents.reduce(
    (sum, document) => sum + document.characters,
    0,
  );
  const totalSections = documents.reduce(
    (sum, document) => sum + document.sectionCount,
    0,
  );

  const categoryEntryHtml = [...categories.entries()]
    .map(([category, categoryDocuments]) => {
      const sectionCount = categoryDocuments.reduce(
        (sum, document) => sum + document.sectionCount,
        0,
      );
      return `<a class="category-entry-card" href="#${attributeEscape(categoryId(category))}">
      <span class="eyebrow">COLLECTION</span>
      <strong>${htmlEscape(category)}</strong>
      <p>${htmlEscape(categorySummary(categoryDocuments))}</p>
      <span>${categoryDocuments.length} 篇文档 · ${sectionCount} 个章节</span>
    </a>`;
    })
    .join("");

  const categoryHtml = [...categories.entries()]
    .map(
      ([category, categoryDocuments]) => `<section class="library-section" id="${attributeEscape(categoryId(category))}">
  <div class="section-heading">
    <div>
      <span class="eyebrow">COLLECTION</span>
      <h2>${htmlEscape(category)}</h2>
    </div>
    <span class="section-count">${categoryDocuments.length} 篇</span>
  </div>
  <div class="document-grid">
    ${categoryDocuments
      .map((document) => {
        const href = relativeUrl(path.join(publicDir, "index.html"), document.outputPath);
        const searchText = [
          document.title,
          document.description,
          document.relativePath,
          ...document.headings.map((heading) => heading.text),
        ]
          .join(" ")
          .toLowerCase();
        return `<article class="document-card" data-search-text="${attributeEscape(searchText)}">
          <a class="card-link" href="${attributeEscape(href)}" aria-label="阅读 ${attributeEscape(document.title)}"></a>
          <div class="card-topline">
            <span class="category-pill">${htmlEscape(document.category)}</span>${document.date ? `\n            <time>${htmlEscape(document.date)}</time>` : ""}
          </div>
          <h3>${htmlEscape(document.title)}</h3>
          <p>${htmlEscape(document.description || "打开文档查看完整内容。")}</p>
          <div class="card-footer">
            <span>${document.sectionCount} 个章节</span>
            <span>约 ${document.readingMinutes} 分钟</span>
            <span class="read-more">阅读 →</span>
          </div>
        </article>`;
      })
      .join("")}
  </div>
</section>`,
    )
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Java 全栈、Codex、AI Agent 与 AI 开发工作流知识库">
  <meta name="color-scheme" content="light dark">
  <title>Java 全栈 AI 学习库</title>
  <link rel="stylesheet" href="assets/style.css">
  <script defer src="assets/app.js"></script>
</head>
<body class="library-page">
<header class="library-header">
  <a class="brand" href="index.html"><span class="brand-mark">J</span><span>Java 全栈 AI 学习库</span></a>
  <button class="icon-button theme-toggle" type="button" aria-label="切换明暗主题">主题</button>
</header>
<main class="library-main">
  <section class="hero">
    <div class="hero-copy">
      <span class="eyebrow">LOCAL KNOWLEDGE BASE</span>
      <h1>以 Java 全栈为基座，系统学习 AI 工程</h1>
      <p>这里汇集 Codex、Agent 工作流、AI-DLC 与工程实践资料。所有内容直接维护为 HTML，可离线阅读。</p>
    </div>
    <div class="hero-stats" aria-label="知识库统计">
      <div><strong>${documents.length}</strong><span>篇文档</span></div>
      <div><strong>${totalSections}</strong><span>个章节</span></div>
      <div><strong>${Math.round(totalCharacters / 1000)}k</strong><span>约字符</span></div>
    </div>
  </section>
  <section class="library-tools" aria-label="文档搜索">
    <label class="search-box">
      <span aria-hidden="true">⌕</span>
      <input type="search" placeholder="搜索标题、主题或章节…" data-library-search autofocus>
      <kbd>/</kbd>
    </label>
    <p class="search-status" aria-live="polite">显示全部 ${documents.length} 篇文档</p>
  </section>
  <nav class="category-entry-grid" aria-label="知识分类">
    ${categoryEntryHtml}
  </nav>
  <div class="no-results" hidden>
    <h2>没有找到匹配文档</h2>
    <p>换一个关键词，或清空搜索框查看全部内容。</p>
  </div>
  <div class="library-content">${categoryHtml}</div>
</main>
<footer class="library-footer">
  <p>HTML 是内容真相源 · 运行 <code>node scripts/build-html-index.mjs</code> 可重建入口与导航</p>
</footer>
</body>
</html>
`;
}

async function main() {
  const outputPaths = await collectHtmlFiles();
  if (outputPaths.length === 0) {
    throw new Error("public/ 中没有找到知识页面。");
  }

  const documents = [];
  for (const outputPath of outputPaths) {
    const html = await fs.readFile(outputPath, "utf8");
    documents.push(extractDocument(outputPath, html));
  }

  for (const document of documents) {
    await fs.writeFile(
      document.outputPath,
      updateDocumentHtml(document, documents),
      "utf8",
    );
  }

  await fs.writeFile(
    path.join(publicDir, "index.html"),
    renderIndex(documents),
    "utf8",
  );

  const manifest = {
    generatedAt: new Date().toISOString(),
    documentCount: documents.length,
    documents: documents.map((document) => ({
      output: document.relativePath,
      title: document.title,
      category: document.category,
      date: document.date,
      sections: document.sectionCount,
    })),
  };
  await fs.writeFile(
    path.join(publicDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  console.log(`已索引 ${documents.length} 篇 HTML 文档。`);
  console.log(`入口：${path.join(publicDir, "index.html")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
