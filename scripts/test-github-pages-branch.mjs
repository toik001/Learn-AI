#!/usr/bin/env node

import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const exists = async (relativePath) =>
  fs.access(path.join(rootDir, relativePath)).then(
    () => true,
    () => false,
  );

assert.equal(
  await exists(".github/workflows/pages.yml"),
  false,
  "branch 部署不得保留 GitHub Pages Actions workflow",
);
assert.equal(
  await exists("public/index.html"),
  false,
  "入口必须从 public 移到仓库根目录",
);
assert.equal(await exists("index.html"), true, "仓库根目录必须存在 index.html");
assert.equal(await exists(".nojekyll"), true, "branch 静态部署必须保留 .nojekyll");

const index = await fs.readFile(path.join(rootDir, "index.html"), "utf8");
assert.match(index, /href="public\/assets\/style\.css"/i, "首页样式路径错误");
assert.match(index, /src="public\/assets\/app\.js"/i, "首页脚本路径错误");
assert.match(
  index,
  /href="public\/notes\/[^"]+\.html"/i,
  "首页知识页链接必须保留 public 前缀",
);

console.log("PASS: GitHub Pages 使用 main 根目录 branch 部署结构");
