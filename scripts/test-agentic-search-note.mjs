#!/usr/bin/env node

import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const noteRelativePath =
  "public/notes/agent/2026-07-27-Agentic-Search与RAG对比.html";
const notePath = path.join(rootDir, noteRelativePath);
const mainPath = path.join(
  rootDir,
  "public/notes/agent/2026-07-27-Agent开发学习主目录.html",
);
const ragPath = path.join(
  rootDir,
  "public/notes/agent/2026-07-27-04-Agent知识检索与RAG.html",
);

const readRequired = async (filePath, label) => {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    assert.fail(`${label}不存在：${path.relative(rootDir, filePath)}（${error.code}）`);
  }
};

const note = await readRequired(notePath, "Agentic Search 学习页");
const main = await readRequired(mainPath, "Agent 主学习目录");
const rag = await readRequired(ragPath, "RAG 基础课");

for (const tag of ["header", "main", "article", "nav"]) {
  assert.match(note, new RegExp(`<${tag}\\b`, "i"), `缺少语义标签 <${tag}>`);
}

for (const metadata of [
  '<meta charset="utf-8">',
  'name="viewport"',
  'name="description"',
  'name="study-category" content="Agent 开发"',
  'name="study-date" content="2026-07-27"',
  'href="../../assets/style.css"',
  'src="../../assets/app.js"',
]) {
  assert.ok(note.includes(metadata), `缺少页面元数据或共享资源：${metadata}`);
}

for (const sectionId of [
  "核心结论",
  "概念边界",
  "agentic-search-闭环",
  "能力阶梯",
  "三者对比",
  "优缺点",
  "选型决策",
  "企业服务台案例",
  "java-21-实现",
  "spring-ai-实现",
  "安全边界",
  "评测与测试",
  "练习与验收",
  "参考资料",
]) {
  assert.match(
    note,
    new RegExp(`\\bid="${sectionId}"`),
    `缺少稳定章节 id：${sectionId}`,
  );
}

for (const phrase of [
  "经典 RAG",
  "Agentic RAG",
  "Agentic Search",
  "不是统一的标准术语",
  "查询改写",
  "证据账本",
  "停止条件",
  "预算耗尽",
  "Java 21",
  "Spring AI 2.0.0",
  "ChatClient",
  "RetrievalAugmentationAdvisor",
  "Tool Calling",
  "提示注入",
  "引用正确率",
]) {
  assert.ok(note.includes(phrase), `缺少必讲内容：${phrase}`);
}

assert.match(
  note,
  /class="agent-call-flow"[^>]*role="img"[^>]*aria-label="[^"]+"/,
  "闭环图必须有可访问名称",
);
assert.match(note, /class="diagram-text"/, "闭环图必须有等价文字说明");
assert.ok(
  (note.match(/<table\b/g) ?? []).length >= 3,
  "至少需要三张表覆盖边界、对比和评测",
);
assert.ok(
  (note.match(/<pre><code>/g) ?? []).length >= 4,
  "至少需要四个完整代码或配置示例",
);

const externalLinks = [
  ...note.matchAll(/<a\b([^>]*\bhref="https?:\/\/[^"]+"[^>]*)>/gi),
];
assert.ok(externalLinks.length >= 6, "参考资料至少应包含六个一手外链");
for (const [, attributes] of externalLinks) {
  assert.match(attributes, /\btarget="_blank"/, "外链缺少 target=_blank");
  assert.match(
    attributes,
    /\brel="noopener noreferrer"/,
    "外链缺少 rel=noopener noreferrer",
  );
}

const noteFileName = path.basename(notePath);
assert.ok(main.includes(`href="${noteFileName}"`), "主学习目录缺少进阶入口");
assert.ok(rag.includes(`href="${noteFileName}"`), "RAG 基础课缺少进阶入口");
assert.ok(
  note.includes('href="2026-07-27-04-Agent知识检索与RAG.html"'),
  "新页面必须链接回 RAG 基础课",
);
assert.ok(
  note.includes('href="2026-07-27-Agent开发学习主目录.html"'),
  "新页面必须链接回 Agent 主学习目录",
);

console.log(
  `PASS: ${noteRelativePath} 的概念、图表、Java/Spring AI、评测、安全、来源与交叉入口完整`,
);
