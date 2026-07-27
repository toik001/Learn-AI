#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
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

for (const implementationContract of [
  /MAX_QUERY_CHARS\s*=\s*500/,
  /ledger\.recordConflicts\(assessment\.conflicts\(\)\)/,
  /ledger\.hasConflicts\(\)/,
  /ledger\.covers\(request\.requiredClaimIds\(\)\)/,
  /final class EvidenceProjection/,
  /\.options\(ChatOptions\.builder\(\)\s*\.maxTokens\(/,
]) {
  assert.match(
    note,
    implementationContract,
    `Java / Spring AI 示例未兑现实现契约：${implementationContract}`,
  );
}
assert.ok(
  (note.match(/RemainingBudget\.from\(/g) ?? []).length >= 4,
  "必须在 planner 前后及每次查询前后重新计算预算",
);

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
assert.ok(
  note.includes("检索于 <strong>2026-07-27</strong>"),
  "参考资料必须记录检索日期",
);
for (const officialSource of [
  "https://learn.microsoft.com/",
  "https://arxiv.org/",
  "https://docs.langchain.com/",
  "https://docs.spring.io/",
]) {
  assert.ok(note.includes(officialSource), `缺少一手来源域名：${officialSource}`);
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

const codeBlocks = [
  ...note.matchAll(/<pre><code>([\s\S]*?)<\/code><\/pre>/g),
].map((match) =>
  match[1]
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'"),
);
const javaFixture = await fs.mkdtemp(
  path.join(os.tmpdir(), "agentic-search-java-test-"),
);
for (const [name, index] of [
  ["SearchTypes.java", 0],
  ["EvidenceLedger.java", 1],
  ["AgenticSearchService.java", 2],
]) {
  await fs.writeFile(path.join(javaFixture, name), codeBlocks[index]);
}
await fs.writeFile(
  path.join(javaFixture, "AgenticSearchCoreHarness.java"),
  `import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class AgenticSearchCoreHarness {
    public static void main(String[] args) {
        Evidence evidence = new Evidence(
                "e-1", "runbook", "Runbook", URI.create("https://example.test/runbook"),
                Instant.parse("2026-07-27T00:00:00Z"), "supported", Set.of("claim-1"), Map.of());
        SearchPlanner planner = (goal, accepted, remaining, sources) ->
                new SearchDecision(
                        DecisionType.SEARCH,
                        List.of(new SearchQuery("runbook", "timeout", "claim-1")),
                        "fill claim-1",
                        Set.of());
        SearchGateway gateway = (query, principal, timeout) -> List.of(evidence);
        EvidenceEvaluator evaluator = (existing, candidates, required) ->
                new EvidenceAssessment(candidates, List.of());
        AnswerPublisher publisher = new AnswerPublisher() {
            public SearchOutcome abstain(
                    List<Evidence> accepted, String reason, int rounds, int queries) {
                return new SearchOutcome("", accepted, reason, rounds, queries);
            }

            public SearchOutcome publishIfSupported(
                    Set<String> required,
                    EvidenceLedger ledger,
                    int rounds,
                    int queries,
                    RemainingBudget remaining) {
                if (!ledger.covers(required)) throw new AssertionError("unsupported publish");
                return new SearchOutcome("answer", ledger.snapshot(), "PUBLISHED", rounds, queries);
            }
        };
        AgenticSearchService service = new AgenticSearchService(
                planner,
                gateway,
                evaluator,
                publisher,
                () -> new Usage(0, 0),
                Clock.fixed(Instant.parse("2026-07-27T00:00:00Z"), ZoneOffset.UTC));
        SearchOutcome outcome = service.search(
                new SearchRequest(
                        "why timeout",
                        new PrincipalScope("tenant-a", "user-a", Set.of("support")),
                        Set.of("claim-1")),
                new SearchBudget(2, 1, 4, Duration.ofSeconds(30), 4_000, 1_000_000),
                Set.of("runbook"));
        if (!"PUBLISHED".equals(outcome.stopReason())) {
            throw new AssertionError(
                    "final permitted query must publish sufficient evidence, got "
                            + outcome.stopReason());
        }
    }
}
`,
);
const javaFiles = [
  "SearchTypes.java",
  "EvidenceLedger.java",
  "AgenticSearchService.java",
  "AgenticSearchCoreHarness.java",
].map((name) => path.join(javaFixture, name));
const compiled = spawnSync("javac", ["--release", "21", ...javaFiles], {
  encoding: "utf8",
});
assert.equal(
  compiled.status,
  0,
  `Java 21 核心示例编译失败：${compiled.stderr || compiled.stdout}`,
);
const executed = spawnSync(
  "java",
  ["-cp", javaFixture, "AgenticSearchCoreHarness"],
  { encoding: "utf8" },
);
assert.equal(
  executed.status,
  0,
  `最后一次允许查询获得充分证据时必须发布：${executed.stderr || executed.stdout}`,
);

console.log(
  `PASS: ${noteRelativePath} 的内容契约及 Java 21 最后一次查询停止路径完整`,
);
