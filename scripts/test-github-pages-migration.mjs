#!/usr/bin/env node

import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const read = (relativePath) =>
  fs.readFile(path.join(rootDir, relativePath), "utf8");

const readmePath = "README.md";
const agentsPath = "AGENTS.md";
const newGuidePath =
  "public/notes/project/2026-07-29-GitHub-Pages部署与项目结构.html";
const oldGuidePath =
  "public/notes/project/2026-07-24-GitLab-Pages极简部署与项目结构.html";

const [readme, agents, guide] = await Promise.all([
  read(readmePath),
  read(agentsPath),
  read(newGuidePath),
]);

await assert.rejects(
  fs.access(path.join(rootDir, oldGuidePath)),
  (error) => error?.code === "ENOENT",
  "项目专属 GitLab Pages 页面必须完成迁移而不是保留副本",
);

for (const expected of [
  "https://toik001.github.io/Learn-AI/",
  "index.html",
  "Deploy from a branch",
  "main",
  "/ (root)",
  "Settings → Pages",
  "node scripts/build-html-index.mjs",
  "node scripts/verify-site.mjs",
]) {
  assert.ok(readme.includes(expected), `README 缺少：${expected}`);
}

assert.match(agents, /^## GitHub Pages 项目结构$/m);
assert.ok(agents.includes("Deploy from a branch"));
assert.ok(agents.includes("/ (root)"));
assert.ok(agents.includes("scripts/verify-site.mjs"));
assert.ok(agents.includes("README.md"));
assert.doesNotMatch(agents, /^## GitLab Pages 项目结构$/m);
assert.doesNotMatch(agents, /\.gitlab-ci\.yml/);

const requiredGuidePatterns = [
  [/<meta charset="utf-8">/i, "utf-8"],
  [/<meta name="viewport" content="[^"]+">/i, "viewport"],
  [/<meta name="description" content="[^"]+">/i, "description"],
  [/<meta name="study-category" content="项目维护">/i, "分类"],
  [/<meta name="study-date" content="2026-07-29">/i, "日期"],
  [/<title>GitHub Pages branch 部署与项目结构[^<]*<\/title>/i, "标题"],
  [/<header\b/i, "header"],
  [/<nav\b/i, "nav"],
  [/<main\b/i, "main"],
  [/<article\b/i, "article"],
  [/<h2 id="核心结论">/i, "核心结论"],
  [/<h2 id="参考资料">/i, "参考资料"],
  [/href="\.\.\/\.\.\/assets\/style\.css"/i, "共享样式"],
  [/src="\.\.\/\.\.\/assets\/app\.js"/i, "共享脚本"],
  [/Deploy from a branch/, "分支发布来源"],
  [/<code>main<\/code>/i, "main 分支"],
  [/<code>\/ \(root\)<\/code>/i, "根目录发布"],
  [/根目录的 <code>index\.html<\/code>/i, "根入口"],
  [/<code>public\/notes\/<\/code>/i, "知识页目录"],
  [/https:\/\/toik001\.github\.io\/Learn-AI\//, "项目站点地址"],
  [/Settings[\s\S]*Pages[\s\S]*Deploy from a branch/i, "首次启用步骤"],
  [/<table\b/i, "迁移差异表"],
  [/检索日期：2026-07-29/, "检索日期"],
];

for (const [pattern, description] of requiredGuidePatterns) {
  assert.match(guide, pattern, `GitHub Pages 指南缺少：${description}`);
}

const officialLinks = [
  "https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site",
  "https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages",
  "https://docs.github.com/en/pages/getting-started-with-github-pages/troubleshooting-404-errors-for-github-pages-sites",
];
for (const url of officialLinks) {
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    guide,
    new RegExp(
      `<a\\b[^>]*href="${escaped}"[^>]*target="_blank"[^>]*rel="noopener noreferrer"`,
      "i",
    ),
    `官方来源缺失或外链属性不安全：${url}`,
  );
}

console.log(
  "PASS: README、项目规则和 GitHub Pages branch 部署指南已完成结构化迁移",
);
