#!/usr/bin/env node

import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const pagePath = path.join(
  rootDir,
  "public",
  "notes",
  "architecture",
  "2026-08-11-DDD订单领域Java实践.html",
);

const commandOutput = (result) => `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();

const javacVersion = spawnSync("javac", ["-version"], { encoding: "utf8" });
if (javacVersion.error?.code === "ENOENT") {
  console.log("SKIP: javac 不可用，未执行 DDD Java 21 walkthrough");
  process.exit(0);
}
assert.equal(
  javacVersion.status,
  0,
  `无法读取 javac 版本：${commandOutput(javacVersion)}`,
);
const versionText = commandOutput(javacVersion);
const versionMatch = /javac\s+(\d+)(?:\.(\d+))?/.exec(versionText);
assert.ok(versionMatch, `无法解析 javac 版本：${versionText}`);
const javacMajor = Number(versionMatch[1]) === 1
  ? Number(versionMatch[2])
  : Number(versionMatch[1]);
if (javacMajor < 21) {
  console.log(`SKIP: 需要 javac 21+，当前为 ${versionText}`);
  process.exit(0);
}

let walkthrough;
try {
  walkthrough = await import("./ddd-java-walkthrough.mjs");
} catch (error) {
  assert.fail(`DDD Java walkthrough 提取模块不可用：${error.message}`);
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ddd-java-walkthrough-"));
try {
  const html = await fs.readFile(pagePath, "utf8");
  const files = walkthrough.extractFrameworkFreeJava(html);
  assert.equal(files.size, 14, "Page 6 必须恰好提取 14 个 framework-free Java 文件");
  await walkthrough.writeJavaBundle(files, tempDir);

  const sourcePaths = [...files.keys()].map((sourcePath) =>
    path.join(tempDir, ...sourcePath.split("/")),
  );
  const outputDir = path.join(tempDir, "out");
  await fs.mkdir(outputDir);
  const compiled = spawnSync(
    "javac",
    ["--release", "21", "-d", outputDir, ...sourcePaths],
    { encoding: "utf8" },
  );
  assert.equal(
    compiled.status,
    0,
    `14 文件 bundle 必须通过 javac --release 21：\n${commandOutput(compiled)}`,
  );

  const harness = spawnSync(
    "java",
    ["-ea", "-cp", outputDir, "example.order.testing.OrderWalkthrough"],
    { encoding: "utf8" },
  );
  assert.equal(
    harness.status,
    0,
    `OrderWalkthrough 必须通过 java -ea：\n${commandOutput(harness)}`,
  );
  const harnessMatch = /^PASS: (\d+) Java 21 DDD checks$/m.exec(harness.stdout);
  assert.ok(harnessMatch, `OrderWalkthrough 缺少成功输出：${commandOutput(harness)}`);
  assert.ok(Number(harnessMatch[1]) >= 8, "OrderWalkthrough 必须保留至少八项行为检查");

  const probePath = path.join(tempDir, "probe", "OrderSubmittedContractProbe.java");
  await fs.mkdir(path.dirname(probePath));
  await fs.writeFile(probePath, `import example.order.domain.DomainEvent;
import example.order.domain.Money;
import example.order.domain.Order;
import example.order.domain.OrderId;
import example.order.domain.OrderStatus;
import example.order.domain.OrderSubmitted;
import example.order.domain.ProductId;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Currency;
import java.util.List;
import java.util.UUID;

public final class OrderSubmittedContractProbe {
    private static final Instant NOW = Instant.parse("2026-08-11T02:00:00Z");
    private static final Currency CNY = Currency.getInstance("CNY");

    public static void main(String[] args) {
        OrderId id = new OrderId(
                UUID.fromString("00000000-0000-0000-0000-000000000099"));
        ProductId book = new ProductId("book");
        ProductId pen = new ProductId("pen");
        Order order = Order.create(id);
        assert order.status() == OrderStatus.DRAFT;
        assert order.pullEvents().isEmpty();

        order.addLine(book, 2, money("10.00"));
        order.addLine(pen, 1, money("5.00"));
        order.submit(NOW);

        assert order.status() == OrderStatus.SUBMITTED;
        List<DomainEvent> events = order.pullEvents();
        assert events.size() == 1;
        assert events.getFirst() instanceof OrderSubmitted;
        OrderSubmitted submitted = (OrderSubmitted) events.getFirst();
        assert submitted.orderId().equals(id);
        assert submitted.occurredAt().equals(NOW);
        assert submitted.total().equals(money("25.00"));
        assert submitted.total().currency().equals(CNY);
        assert submitted.lines().equals(List.of(
                new OrderSubmitted.Line(book, 2),
                new OrderSubmitted.Line(pen, 1)));
        try {
            submitted.lines().add(new OrderSubmitted.Line(book, 1));
            throw new AssertionError("submitted lines must be immutable");
        } catch (UnsupportedOperationException expected) {
            // Expected immutable integration snapshot source.
        }

        Order restored = Order.rehydrate(
                order.id(), order.status(), order.lineSnapshots());
        assert restored.pullEvents().isEmpty();

        Order empty = Order.create(new OrderId(UUID.randomUUID()));
        try {
            empty.submit(NOW);
            throw new AssertionError("empty order must not submit");
        } catch (IllegalStateException expected) {
            assert empty.status() == OrderStatus.DRAFT;
            assert empty.pullEvents().isEmpty();
        }
        System.out.println("PASS: OrderSubmitted immutable snapshot contract");
    }

    private static Money money(String amount) {
        return new Money(new BigDecimal(amount), CNY);
    }
}
`, "utf8");

  const probeCompiled = spawnSync(
    "javac",
    ["--release", "21", "-cp", outputDir, "-d", outputDir, probePath],
    { encoding: "utf8" },
  );
  assert.equal(
    probeCompiled.status,
    0,
    `OrderSubmitted 行为契约探针必须编译：\n${commandOutput(probeCompiled)}`,
  );
  const probe = spawnSync(
    "java",
    ["-ea", "-cp", outputDir, "OrderSubmittedContractProbe"],
    { encoding: "utf8" },
  );
  assert.equal(
    probe.status,
    0,
    `OrderSubmitted 行为契约探针必须通过：\n${commandOutput(probe)}`,
  );
  assert.match(
    probe.stdout,
    /^PASS: OrderSubmitted immutable snapshot contract$/m,
    "OrderSubmitted 行为契约探针缺少成功输出",
  );

  console.log(
    `PASS: 提取 ${files.size} 个 Java 文件；${harnessMatch[1]} 项 walkthrough 检查；OrderSubmitted 契约检查通过`,
  );
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
