#!/usr/bin/env node

import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const agentDir = path.join(rootDir, "public", "notes", "agent");
const overviewPath = path.join(
  rootDir,
  "public",
  "notes",
  "codex",
  "2026-08-07-Harness-Loop-Graph与Codex-Superpowers开发模式.html",
);
const stylePath = path.join(rootDir, "public", "assets", "style.css");

const pages = [
  ["Harness", "2026-08-07-Harness从运行时Agent到Codex开发环境.html"],
  ["Loop", "2026-08-07-Loop从业务Agent循环到Codex开发闭环.html"],
  ["Graph", "2026-08-07-Graph从审批状态编排到Codex开发流程.html"],
  ["整合", "2026-08-07-Harness-Loop-Graph双层整合实战.html"],
];

const readRequired = async (filePath, label) => {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    assert.fail(`${label}不存在：${path.relative(rootDir, filePath)}（${error.code}）`);
  }
};

const overview = await readRequired(overviewPath, "现有综合页");
const style = await readRequired(stylePath, "共享样式");
const documents = new Map();

for (const [label, fileName] of pages) {
  const html = await readRequired(path.join(agentDir, fileName), `${label}学习页`);
  documents.set(label, html);

  for (const tag of ["header", "main", "article", "nav"]) {
    assert.match(html, new RegExp(`<${tag}\\b`, "i"), `${label}页缺少 <${tag}>`);
  }
  for (const metadata of [
    '<meta charset="utf-8">',
    'name="viewport"',
    'name="description"',
    'name="study-category" content="Agent 开发"',
    'name="study-date" content="2026-08-07"',
    'href="../../assets/style.css"',
    'src="../../assets/app.js"',
  ]) {
    assert.ok(html.includes(metadata), `${label}页缺少元数据或共享资源：${metadata}`);
  }

  for (const sectionId of [
    "核心结论",
    "概念模型",
    "审批-agent-开发",
    "无框架实现",
    "spring-ai-实现",
    "codex开发使用",
    "线上应用",
    "失败模式",
    "练习与验收",
    "参考资料",
  ]) {
    assert.match(html, new RegExp(`\\bid="${sectionId}"`), `${label}页缺少章节：${sectionId}`);
  }

  for (const phrase of [
    "智能审批 Agent 开发",
    "代码开发过程中的使用",
    "Java 25",
    "Spring AI",
    "Codex",
    "检索于 <strong>2026-08-07</strong>",
  ]) {
    assert.ok(html.includes(phrase), `${label}页缺少必讲内容：${phrase}`);
  }
  assert.ok(!html.includes("Claude Code"), `${label}页不得包含 Claude Code 示例`);
  assert.ok((html.match(/<table\b/g) ?? []).length >= 2, `${label}页至少需要两张表`);
  assert.ok(
    (html.match(/<pre><code/g) ?? []).length >= 3,
    `${label}页至少需要三个代码、配置或任务模板`,
  );
  assert.ok(
    (html.match(/role="img"/g) ?? []).length >= 2,
    `${label}页至少需要两张带可访问名称的图`,
  );
  assert.match(html, /class="diagram-text"/, `${label}页缺少图表等价文字说明`);

  const externalLinks = [
    ...html.matchAll(/<a\b([^>]*\bhref="https?:\/\/[^\"]+"[^>]*)>/gi),
  ];
  assert.ok(externalLinks.length >= 5, `${label}页至少需要五个一手外链`);
  for (const [, attributes] of externalLinks) {
    assert.match(attributes, /\btarget="_blank"/, `${label}页外链缺少 target=_blank`);
    assert.match(
      attributes,
      /\brel="noopener noreferrer"/,
      `${label}页外链缺少 rel=noopener noreferrer`,
    );
  }

  for (const [, otherFile] of pages) {
    if (otherFile === fileName) continue;
    assert.ok(html.includes(`href="${otherFile}"`), `${label}页缺少课程互链：${otherFile}`);
  }
  assert.ok(overview.includes(`href="../agent/${fileName}"`), `综合页缺少 ${label} 课程入口`);
}

for (const cssClass of ["dual-lane-diagram", "layer-stack", "state-node"]) {
  assert.match(style, new RegExp(`\\.${cssClass}\\b`), `共享样式缺少 .${cssClass}`);
}
assert.match(
  style,
  /@media \(max-width: 820px\)[\s\S]*?\.dual-lane-diagram\s*\{[^}]*grid-template-columns:\s*1fr/s,
  "双泳道图在移动端必须收敛为单列",
);
assert.match(
  style,
  /@media \(max-width: 820px\)[\s\S]*?\.state-graph\s*\{[^}]*flex-direction:\s*column/s,
  "状态图在移动端必须纵向排列",
);

const integrated = documents.get("整合");
for (const phrase of [
  "运行时 Agent",
  "编码 Agent",
  "AGENTS.md",
  "Goal",
  "Context",
  "Constraints",
  "Done when",
  "shadow",
  "幂等",
  "SLO",
]) {
  assert.ok(integrated.includes(phrase), `整合页缺少双层实战内容：${phrase}`);
}

console.log("PASS: Harness、Loop、Graph 四篇双场景课程契约完整");
