#!/usr/bin/env node

import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const verifierPath = path.join(projectRoot, "scripts", "verify-site.mjs");
const temporaryRoots = [];

const indexHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fixture Index</title>
  <link rel="stylesheet" href="assets/style.css">
</head>
<body>
  <header><h1 id="library">Fixture Index</h1></header>
  <main>
    <a href="notes/project/guide.html#核心结论">阅读指南</a>
  </main>
  <script src="assets/app.js"></script>
</body>
</html>`;

const noteHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="用于验证站点完整性检查器">
  <meta name="study-category" content="项目指南">
  <meta name="study-date" content="2026-07-29">
  <title>Fixture Guide</title>
  <link rel="stylesheet" href="../../assets/style.css">
</head>
<body>
  <header><a href="../../index.html#library">知识库</a></header>
  <nav aria-label="页面导航"><a href="#参考资料">参考资料</a></nav>
  <main>
    <article>
      <h1 id="fixture-guide">Fixture Guide</h1>
      <h2 id="核心结论"><a class="heading-anchor" href="#核心结论" aria-label="链接到本节">#</a>核心结论</h2>
      <p>有效页面。</p>
      <h2 id="参考资料"><a class="heading-anchor" href="#参考资料" aria-label="链接到本节">#</a>参考资料</h2>
      <p><a href="https://docs.github.com/pages" target="_blank" rel="noopener noreferrer">GitHub Docs</a></p>
    </article>
  </main>
  <script src="../../assets/app.js"></script>
</body>
</html>`;

async function createSite() {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "study-site-verifier-test-"),
  );
  temporaryRoots.push(root);
  const publicDir = path.join(root, "public");
  await fs.mkdir(path.join(publicDir, "assets"), { recursive: true });
  await fs.mkdir(path.join(publicDir, "notes", "project"), {
    recursive: true,
  });
  await fs.writeFile(path.join(publicDir, "index.html"), indexHtml);
  await fs.writeFile(
    path.join(publicDir, "notes", "project", "guide.html"),
    noteHtml,
  );
  await fs.writeFile(path.join(publicDir, "assets", "style.css"), "body {}\n");
  await fs.writeFile(path.join(publicDir, "assets", "app.js"), "(() => {})();\n");
  return publicDir;
}

function verify(publicDir) {
  return spawnSync(process.execPath, [verifierPath, "--root", publicDir], {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

function diagnostics(result) {
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

async function expectFailure({ mutate, message }) {
  const publicDir = await createSite();
  await mutate(publicDir);
  const result = verify(publicDir);
  assert.notEqual(result.status, 0, `无效站点不应通过：${message}`);
  assert.match(diagnostics(result), message);
}

try {
  const validPublicDir = await createSite();
  const validResult = verify(validPublicDir);
  assert.equal(
    validResult.status,
    0,
    `有效站点必须通过：${diagnostics(validResult)}`,
  );

  await expectFailure({
    mutate: async (publicDir) => {
      await fs.writeFile(
        path.join(publicDir, "index.html"),
        indexHtml.replace(
          "</main>",
          '<a href="notes/project/missing.html">缺失页面</a></main>',
        ),
      );
    },
    message: /本地目标不存在/,
  });

  await expectFailure({
    mutate: async (publicDir) => {
      await fs.writeFile(
        path.join(publicDir, "index.html"),
        indexHtml.replace(
          "guide.html#核心结论",
          "guide.html#不存在的章节",
        ),
      );
    },
    message: /片段锚点不存在/,
  });

  await expectFailure({
    mutate: async (publicDir) => {
      await fs.writeFile(
        path.join(publicDir, "index.html"),
        indexHtml.replace(
          "assets/style.css",
          "/Learn-AI/assets/style.css",
        ),
      );
    },
    message: /禁止根路径引用/,
  });

  await expectFailure({
    mutate: async (publicDir) => {
      const notePath = path.join(
        publicDir,
        "notes",
        "project",
        "guide.html",
      );
      await fs.writeFile(
        notePath,
        noteHtml.replace(
          '<p>有效页面。</p>',
          '<p id="核心结论">重复标识。</p>',
        ),
      );
    },
    message: /重复 id/,
  });

  await expectFailure({
    mutate: async (publicDir) => {
      const notePath = path.join(
        publicDir,
        "notes",
        "project",
        "guide.html",
      );
      await fs.writeFile(
        notePath,
        noteHtml.replace(
          ' target="_blank" rel="noopener noreferrer"',
          "",
        ),
      );
    },
    message: /外部链接必须使用安全新窗口属性/,
  });

  console.log("PASS: 站点完整性校验器接受有效页面并拒绝 5 类发布缺陷");
} finally {
  await Promise.all(
    temporaryRoots.map((root) =>
      fs.rm(root, { recursive: true, force: true }),
    ),
  );
}
