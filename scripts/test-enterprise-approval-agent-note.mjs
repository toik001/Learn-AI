#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const rootDir = process.cwd();
const noteFile = "2026-07-28-企业智能审批与公司主子Agent落地实战.html";
const agentDir = path.join(rootDir, "public", "notes", "agent");
const notePath = path.join(agentDir, noteFile);
const mainPath = path.join(agentDir, "2026-07-27-Agent开发学习主目录.html");
const multiAgentPath = path.join(
  agentDir,
  "2026-07-27-06-多Agent协作与编排.html",
);
const governancePath = path.join(
  agentDir,
  "2026-07-27-07-Agent评测安全权限与成本控制.html",
);
const stylePath = path.join(rootDir, "public", "assets", "style.css");

const readRequired = async (file, label) => {
  try {
    return await fs.readFile(file, "utf8");
  } catch (error) {
    assert.fail(`${label}不存在：${path.relative(rootDir, file)}（${error.code}）`);
  }
};

const note = await readRequired(notePath, "企业智能审批 Agent 实战页");
const main = await readRequired(mainPath, "Agent 开发学习主目录");
const multiAgent = await readRequired(multiAgentPath, "多 Agent 协作课程");
const governance = await readRequired(governancePath, "Agent 安全治理课程");
const style = await readRequired(stylePath, "共享样式");

for (const tag of ["header", "main", "article", "nav"]) {
  assert.match(note, new RegExp(`<${tag}\\b`, "i"), `缺少语义标签 <${tag}>`);
}

for (const metadata of [
  '<meta charset="utf-8">',
  'name="viewport"',
  'name="description"',
  'name="study-category" content="Agent 开发"',
  'name="study-date" content="2026-07-28"',
  'href="../../assets/style.css"',
  'src="../../assets/app.js"',
]) {
  assert.ok(note.includes(metadata), `缺少元数据或共享资源：${metadata}`);
}

for (const sectionId of [
  "核心结论",
  "业务场景与目标",
  "智能审批闭环",
  "公司主子agent架构",
  "角色职责与权限",
  "采购审批实例",
  "公司级应用场景",
  "领域状态与数据",
  "java领域契约",
  "spring-ai实现",
  "确定性协调器",
  "权限审计与安全",
  "失败恢复与降级",
  "评测与业务指标",
  "分阶段落地路线",
  "实施检查单",
  "参考资料",
]) {
  assert.match(note, new RegExp(`\\bid="${sectionId}"`), `缺少章节：${sectionId}`);
}

for (const phrase of [
  "Agent 只生成提案",
  "最终决定由规则引擎或授权审批人完成",
  "主 Agent",
  "材料理解子 Agent",
  "制度检索子 Agent",
  "财务核验子 Agent",
  "合规风险子 Agent",
  "BPMN",
  "DMN",
  "人工审批",
  "proposalHash",
  "idempotencyKey",
  "Java 21",
  "Spring AI",
  "ChatClient",
  "ToolCallback",
  "REQUEST_INFO",
  "ESCALATE",
]) {
  assert.ok(note.includes(phrase), `缺少企业落地关键内容：${phrase}`);
}
assert.ok(
  note.includes(".defaultTools(tools.callbacksFor(role))"),
  "Spring AI 2.0 示例必须使用当前 defaultTools API",
);
assert.ok(
  !note.includes(".defaultToolCallbacks("),
  "Spring AI 2.0 示例不得继续使用已弃用的 defaultToolCallbacks API",
);
for (const safetyBoundary of [
  "执行器不能作为任何 Agent 的工具暴露",
  "每个 callback 在 delegate 前重新检查 principal",
  "任何材料、金额、供应商或拟执行动作变化都会使旧审批失效",
  "最终决定由规则引擎或授权审批人完成",
  "所有金额阈值、角色、制度编号和 DPA 路由均为教学假设",
]) {
  assert.ok(note.includes(safetyBoundary), `缺少关键安全边界：${safetyBoundary}`);
}
assert.match(
  note,
  /enum ApprovalCaseState\s*\{\s*COLLECTING,\s*ANALYZING,\s*NEEDS_INFO,\s*ANALYSIS_RETRYABLE,\s*NEEDS_REVIEW,\s*PENDING_APPROVAL,\s*ESCALATED,\s*APPROVED,\s*REJECTED,\s*EXECUTING,\s*EXECUTION_UNKNOWN,\s*COMPLETED,\s*CANCELLED\s*\}/,
  "Java 领域契约必须定义完整且唯一的审批状态集合",
);
for (const state of [
  "COLLECTING",
  "ANALYZING",
  "NEEDS_INFO",
  "ANALYSIS_RETRYABLE",
  "NEEDS_REVIEW",
  "PENDING_APPROVAL",
  "ESCALATED",
  "APPROVED",
  "REJECTED",
  "EXECUTING",
  "EXECUTION_UNKNOWN",
  "COMPLETED",
  "CANCELLED",
]) {
  assert.ok(
    note.includes(`<tr><td><code>${state}</code></td>`),
    `状态转移表缺少 ${state}`,
  );
}
assert.ok(!note.includes("<code>CASE_OPEN</code>"), "不得出现未定义的 CASE_OPEN 状态");
for (const storageContract of [
  "create table approval_case_version",
  "case_version bigint not null",
  "create table approval_execution",
  "unique (tenant_id, idempotency_key)",
  "create table approval_audit_event",
  "auth_context_ref",
  "mfa_strength",
  "previous_hash",
  "event_hash",
]) {
  assert.ok(note.includes(storageContract), `存储契约缺少：${storageContract}`);
}
assert.match(
  note,
  /record EvidenceRef\([\s\S]*?long caseVersion,/,
  "证据契约必须绑定产生证据时的 caseVersion",
);
assert.match(
  note,
  /final class ApprovedProcurementExecutor \{[\s\S]*?ApprovedProcurementExecutor\([\s\S]*?this\.verifier = Objects\.requireNonNull\(verifier\);[\s\S]*?this\.writer = Objects\.requireNonNull\(writer\);/,
  "执行器必须显式初始化 final 依赖",
);
assert.ok(
  !note.includes("findByIdempotencyKey"),
  "执行示例不得使用先查后写的竞态幂等模式",
);

const decodeCode = (value) =>
  value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("-&gt;", "->");
const javaBlocks = [
  ...note.matchAll(
    /<pre><code class="language-java" data-java-fixture="enterprise-approval-core">([\s\S]*?)<\/code><\/pre>/g,
  ),
].map((match) => decodeCode(match[1]).replace(/^import [^;]+;\s*$/gm, ""));
assert.equal(javaBlocks.length, 3, "必须有三段来自页面本身的 Java 21 核心编译夹具");
const fixtureDir = await fs.mkdtemp(
  path.join(os.tmpdir(), "enterprise-approval-java-"),
);
try {
  const fixturePath = path.join(fixtureDir, "EnterpriseApprovalExample.java");
  await fs.writeFile(
    fixturePath,
    `import java.time.Instant;\nimport java.util.*;\n${javaBlocks.join("\n")}`,
    "utf8",
  );
  const compiled = spawnSync(
    "javac",
    ["--release", "21", "-d", fixtureDir, fixturePath],
    { encoding: "utf8" },
  );
  assert.equal(
    compiled.status,
    0,
    `Java 21 页面示例无法编译：${compiled.stderr || compiled.stdout}`,
  );
} finally {
  await fs.rm(fixtureDir, { recursive: true, force: true });
}

for (const diagramClass of ["approval-agent-flow", "company-agent-map"]) {
  assert.match(
    note,
    new RegExp(
      `class="[^"]*${diagramClass}[^"]*"[^>]*role="img"[^>]*aria-label="[^"]+"`,
    ),
    `${diagramClass} 必须有可访问名称`,
  );
}
assert.ok(
  (note.match(/class="diagram-text"/g) ?? []).length >= 2,
  "两张架构图都必须提供等价文字说明",
);
assert.ok((note.match(/<table\b/g) ?? []).length >= 5, "至少需要五张业务表");
assert.ok(
  (note.match(/<pre><code/g) ?? []).length >= 4,
  "至少需要四段可复制的 Java、配置或数据示例",
);

assert.match(
  style,
  /\.company-agent-map\s*\{[^}]*display:\s*grid/s,
  "公司主子 Agent 拓扑必须有桌面网格布局",
);
assert.match(
  style,
  /@media \(max-width: 820px\)[\s\S]*?\.company-agent-map\s*\{[^}]*grid-template-columns:\s*1fr/s,
  "公司主子 Agent 拓扑必须有移动端单列布局",
);

const externalLinks = [
  ...note.matchAll(/<a\b([^>]*\bhref="https?:\/\/[^"]+"[^>]*)>/gi),
];
assert.ok(externalLinks.length >= 5, "至少需要五个一手参考链接");
const externalUrls = new Set();
for (const [, attributes] of externalLinks) {
  assert.match(attributes, /\btarget="_blank"/, "外链缺少 target=_blank");
  assert.match(
    attributes,
    /\brel="noopener noreferrer"/,
    "外链缺少 rel=noopener noreferrer",
  );
  externalUrls.add(/\bhref="([^"]+)"/.exec(attributes)?.[1] ?? "");
}
for (const expectedUrl of [
  "https://docs.spring.io/spring-ai/reference/api/tools.html",
  "https://docs.spring.io/spring-ai/reference/api/chatclient.html",
  "https://docs.spring.io/spring-ai/docs/current/api/org/springframework/ai/chat/client/ChatClient.Builder.html",
  "https://docs.spring.io/spring-ai/reference/observability/index.html",
  "https://docs.camunda.io/docs/components/modeler/bpmn/user-tasks/",
  "https://docs.camunda.io/docs/components/modeler/dmn/decision-table/",
  "https://airc.nist.gov/airmf-resources/airmf/5-sec-core/",
]) {
  assert.ok(externalUrls.has(expectedUrl), `缺少关键一手来源：${expectedUrl}`);
}
assert.ok(
  note.includes("检索于 <strong>2026-07-28</strong>"),
  "参考资料必须记录检索日期",
);

for (const [html, label] of [
  [main, "Agent 主目录"],
  [multiAgent, "多 Agent 课程"],
  [governance, "安全治理课程"],
]) {
  assert.ok(html.includes(`href="${noteFile}"`), `${label}缺少新实战页入口`);
}
for (const relatedFile of [
  "2026-07-27-Agent开发学习主目录.html",
  "2026-07-27-06-多Agent协作与编排.html",
  "2026-07-27-07-Agent评测安全权限与成本控制.html",
]) {
  assert.ok(note.includes(`href="${relatedFile}"`), `新页面缺少回链：${relatedFile}`);
}

console.log(
  "PASS: 企业智能审批、公司主子 Agent、Java/Spring AI、安全门禁与课程入口完整",
);
