#!/usr/bin/env node

import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const workflowPath = path.join(
  rootDir,
  ".github",
  "workflows",
  "pages.yml",
);
const gitlabCiPath = path.join(rootDir, ".gitlab-ci.yml");

await assert.rejects(
  fs.access(gitlabCiPath),
  (error) => error?.code === "ENOENT",
  "迁移后不得保留 .gitlab-ci.yml",
);

const workflow = await fs.readFile(workflowPath, "utf8");

const requiredPatterns = [
  [/^name:\s*Deploy knowledge base to GitHub Pages$/m, "工作流名称"],
  [/\bon:[ \t]*\n[ \t]+push:[ \t]*\n[ \t]+branches:[ \t]*\n[ \t]+- main\b/m, "main push 触发"],
  [/\n[ \t]+workflow_dispatch:[ \t]*(?:\n|$)/m, "手动触发"],
  [/\nconcurrency:[ \t]*\n[ \t]+group:[ \t]*pages[ \t]*\n[ \t]+cancel-in-progress:[ \t]*false\b/m, "Pages 并发保护"],
  [/\n[ \t]+build:[ \t]*\n[\s\S]*?\n[ \t]+permissions:[ \t]*\n[ \t]+contents:[ \t]*read\b/m, "build 只读源码权限"],
  [/\n[ \t]+deploy:[ \t]*\n[ \t]+needs:[ \t]*build\b/m, "deploy 依赖 build"],
  [/\n[ \t]+pages:[ \t]*write[ \t]*\n[ \t]+id-token:[ \t]*write\b/m, "Pages 与 OIDC 部署权限"],
  [/\n[ \t]+name:[ \t]*github-pages[ \t]*\n[ \t]+url:[ \t]*\$\{\{[ \t]*steps\.deployment\.outputs\.page_url[ \t]*\}\}/m, "部署环境 URL"],
  [/uses:\s*actions\/checkout@v6\b/, "checkout v6"],
  [/uses:\s*actions\/setup-node@v6\b/, "setup-node v6"],
  [/\n[ \t]+node-version:[ \t]*24\b/, "Node.js 24"],
  [/\n[ \t]+package-manager-cache:[ \t]*false\b/, "禁用无依赖项目的包缓存"],
  [/uses:\s*actions\/configure-pages@v6\b/, "configure-pages v6"],
  [/uses:\s*actions\/upload-pages-artifact@v5\b/, "upload-pages-artifact v5"],
  [/uses:\s*actions\/deploy-pages@v5\b/, "deploy-pages v5"],
  [/\n[ \t]+path:[ \t]*public\b/, "只上传 public"],
  [/for test_file in scripts\/test-\*\.mjs/, "运行全部内容回归测试"],
  [/node scripts\/verify-site\.mjs/, "运行站点完整性校验"],
  [/node --check scripts\/build-html-index\.mjs/, "检查索引脚本语法"],
  [/node --check public\/assets\/app\.js/, "检查浏览器脚本语法"],
  [/node scripts\/build-html-index\.mjs/, "重跑索引生成器"],
  [/git diff --exit-code -- public/, "阻止未提交的生成结果"],
];

for (const [pattern, description] of requiredPatterns) {
  assert.match(workflow, pattern, `工作流缺少：${description}`);
}

assert.doesNotMatch(
  workflow,
  /\b(?:public|docs)\s*:\s*write\b/,
  "工作流不得声明无效或过宽的写权限",
);

console.log(
  "PASS: GitHub Pages 工作流的触发、校验、artifact、依赖和最小权限契约完整",
);
