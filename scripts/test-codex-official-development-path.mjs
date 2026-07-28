#!/usr/bin/env node

import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const noteFile = "2026-07-28-Codex官方原生项目开发最佳路径.html";
const notePath = path.join(rootDir, "public", "notes", "codex", noteFile);
const stylePath = path.join(rootDir, "public", "assets", "style.css");
const practicesPath = path.join(
  rootDir,
  "public",
  "notes",
  "codex",
  "2026-07-24-Codex全栈开发最佳实践.html",
);
const selectionPath = path.join(
  rootDir,
  "public",
  "notes",
  "codex",
  "2026-07-24-AI开发工作流选型与小团队沉淀指南.html",
);

const readRequired = async (file, label) => {
  try {
    return await fs.readFile(file, "utf8");
  } catch (error) {
    assert.fail(`${label}不存在：${path.relative(rootDir, file)}（${error.code}）`);
  }
};

const note = await readRequired(notePath, "Codex 官方原生开发路径页面");
const style = await readRequired(stylePath, "共享样式");
const practices = await readRequired(practicesPath, "Codex 全栈开发最佳实践");
const selection = await readRequired(selectionPath, "AI 开发工作流选型");

for (const tag of ["header", "main", "article", "nav"]) {
  assert.match(note, new RegExp(`<${tag}\\b`, "i"), `缺少语义标签 <${tag}>`);
}

for (const metadata of [
  '<meta charset="utf-8">',
  'name="viewport"',
  'name="description"',
  'name="study-category" content="Codex 与 AI 工程"',
  'name="study-date" content="2026-07-28"',
  'href="../../assets/style.css"',
  'src="../../assets/app.js"',
]) {
  assert.ok(note.includes(metadata), `缺少元数据或共享资源：${metadata}`);
}

for (const sectionId of [
  "核心结论",
  "官方原生边界",
  "默认开发闭环",
  "任务规模决策",
  "阶段一仓库准备",
  "阶段二agents规则",
  "阶段三环境与隔离",
  "阶段四任务提示",
  "阶段五计划与确认",
  "阶段六实现与反馈",
  "阶段七分层验证",
  "阶段八diff与review",
  "阶段九提交与pr",
  "阶段十复盘沉淀",
  "多表面映射",
  "java项目模板",
  "提示词模板",
  "权限与安全",
  "交付检查单",
  "参考资料",
]) {
  assert.match(note, new RegExp(`\\bid="${sectionId}"`), `缺少章节：${sectionId}`);
}

for (const phrase of [
  "不依赖 AIDLC、OpenSpec、Superpowers",
  "Goal",
  "Context",
  "Constraints",
  "Done when",
  "/init",
  "AGENTS.md",
  "Plan mode",
  "/plan",
  "worktree",
  "sandbox",
  "approval",
  "/diff",
  "/review",
  "Pull Request",
  "Java 21",
  "Spring Boot",
  "./mvnw",
  "一个 chat 对应一个可独立验收的结果",
  "最小相关检查",
]) {
  assert.ok(note.includes(phrase), `缺少官方路径关键内容：${phrase}`);
}

assert.match(
  note,
  /class="agent-call-flow codex-native-flow"[^>]*role="img"[^>]*aria-label="[^"]+"/,
  "开发闭环图必须有可访问名称",
);
assert.match(note, /class="diagram-text"/, "开发闭环图必须有等价文字说明");
const flowSteps = [
  ...note.matchAll(/<div class="agent-step">(\d+)\.[\s\S]*?<\/div>/g),
];
assert.equal(flowSteps.length, 11, "官方原生开发闭环必须恰有十一站");
assert.deepEqual(
  flowSteps.map((match) => Number(match[1])),
  Array.from({ length: 11 }, (_, index) => index),
  "官方原生开发闭环必须按 0～10 连续编号",
);
assert.ok(
  note.includes("不是 OpenAI 发布的固定 SDLC 标准"),
  "必须明确十一站是工程综合，而不是 OpenAI 固定 SDLC",
);
assert.match(
  style,
  /\.agent-call-flow\.codex-native-flow \.agent-step:nth-child\(8\)::after\s*\{[^}]*content:\s*"↓"/s,
  "桌面十一站流程必须连接第 7→8 站",
);
assert.match(
  style,
  /\.agent-call-flow\.codex-native-flow \.agent-step:nth-child\(9\)::after,\s*\.agent-call-flow\.codex-native-flow \.agent-step:nth-child\(10\)::after\s*\{[^}]*content:\s*"→"/s,
  "桌面十一站流程必须连接第 8→9→10 站",
);
assert.match(
  style,
  /@media \(max-width: 820px\)[\s\S]*?\.agent-call-flow\.codex-native-flow \.agent-step::after\s*\{[^}]*content:\s*"↓"[\s\S]*?\.agent-call-flow\.codex-native-flow \.agent-step:nth-child\(11\)::after\s*\{\s*content:\s*none;/,
  "移动端十一站流程必须纵向连续，且最后一站不再绘制箭头",
);
assert.equal(
  (
    style.match(
      /\.agent-call-flow\.codex-native-flow \.agent-step:nth-child\(11\)::after\s*\{\s*content:\s*none;/g,
    ) ?? []
  ).length,
  2,
  "桌面端与移动端都必须在最后一站终止箭头",
);
assert.ok((note.match(/<table\b/g) ?? []).length >= 4, "至少需要四张决策或映射表");
assert.ok(
  (note.match(/<pre><code/g) ?? []).length >= 4,
  "至少需要四个可复制的规则或提示词模板",
);

const officialLinks = [
  ...note.matchAll(/<a\b([^>]*\bhref="https?:\/\/[^"]+"[^>]*)>/gi),
];
assert.ok(officialLinks.length >= 7, "至少需要七个官方来源链接");
const officialUrls = new Set();
for (const [, attributes] of officialLinks) {
  assert.match(attributes, /\btarget="_blank"/, "官方外链缺少 target=_blank");
  assert.match(
    attributes,
    /\brel="noopener noreferrer"/,
    "官方外链缺少 rel=noopener noreferrer",
  );
  const url = /\bhref="([^"]+)"/.exec(attributes)?.[1] ?? "";
  officialUrls.add(url);
  const host = new URL(url).hostname;
  assert.ok(
    host === "learn.chatgpt.com" || host === "developers.openai.com",
    `出现非 OpenAI 官方来源：${host}`,
  );
}
for (const expectedUrl of [
  "https://learn.chatgpt.com/guides/best-practices",
  "https://learn.chatgpt.com/docs/prompting",
  "https://learn.chatgpt.com/docs/projects",
  "https://learn.chatgpt.com/docs/agent-configuration/agents-md",
  "https://learn.chatgpt.com/docs/agent-approvals-security",
  "https://learn.chatgpt.com/docs/developer-commands?surface=cli",
  "https://learn.chatgpt.com/docs/code-review",
  "https://learn.chatgpt.com/docs/environments/git-worktrees",
  "https://learn.chatgpt.com/docs/environments/local-environment",
]) {
  assert.ok(officialUrls.has(expectedUrl), `缺少关键官方来源：${expectedUrl}`);
}
assert.ok(
  note.includes("检索于 <strong>2026-07-28</strong>"),
  "参考资料必须记录检索日期",
);

assert.ok(practices.includes(`href="${noteFile}"`), "Codex 最佳实践页缺少新入口");
assert.ok(selection.includes(`href="${noteFile}"`), "工作流选型页缺少新入口");
assert.ok(
  note.includes('href="2026-07-24-Codex全栈开发最佳实践.html"'),
  "新页面必须链接回 Codex 最佳实践",
);
assert.ok(
  note.includes('href="2026-07-24-AI开发工作流选型与小团队沉淀指南.html"'),
  "新页面必须链接回工作流选型",
);

console.log(
  "PASS: Codex 官方原生项目开发路径的边界、闭环、模板、官方来源与交叉入口完整",
);
