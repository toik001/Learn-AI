#!/usr/bin/env node

import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const notesDir = path.join(rootDir, "public", "notes", "coding-agent");

const pages = {
  overview: {
    file: "2026-08-10-Pi项目总览与学习路线.html",
    sections: ["项目定位", "学习路线", "能力地图", "术语表"],
    phrases: ["pi-mono", "earendil-works/pi", "Pi Coding Agent", "七篇", "0.74.0"],
  },
  philosophy: {
    file: "2026-08-10-Pi设计理念与边界.html",
    sections: ["核心理念", "取舍分析", "不是什么", "适用边界"],
    phrases: ["极简", "组合", "模型中立", "扩展"],
  },
  architecture: {
    file: "2026-08-10-Pi源码架构与运行机制.html",
    sections: ["package地图", "请求路径", "agent-loop", "事件系统", "会话模型"],
    phrases: ["pi-telemetry", "pi-ai", "pi-agent-core", "pi-coding-agent", "pi-tui"],
  },
  usage: {
    file: "2026-08-10-Pi安装配置与使用教程.html",
    sections: ["环境与安装", "认证与模型", "日常工作流", "会话管理", "常见问题"],
    phrases: ["Node.js", "Provider", "session", "未执行外部端到端验证"],
  },
  extension: {
    file: "2026-08-10-Pi扩展开发与系统集成.html",
    sections: ["扩展点选择", "extension", "自定义工具", "prompt与skill", "sdk", "rpc"],
    phrases: ["Extension", "TypeScript", "SDK", "RPC", "@earendil-works/"],
  },
  comparison: {
    file: "2026-08-10-Pi与主流编码Agent对比.html",
    sections: ["比较方法", "事实矩阵", "逐项分析", "场景选择", "比较局限"],
    phrases: ["Pi", "Claude Code", "Codex CLI", "OpenCode", "Aider", "Goose"],
  },
  selection: {
    file: "2026-08-10-Pi选型建议与实践路线.html",
    sections: ["决策树", "场景建议", "采用风险", "实践路线", "验收标准"],
    phrases: ["优先试 Pi", "短期 PoC", "不要选择 Pi", "退出策略"],
  },
};

const args = process.argv.slice(2);
let requestedKey = null;
if (args.length > 0) {
  assert.equal(args.length, 2, "用法：node scripts/test-pi-mono-series.mjs [--page <key>]");
  assert.equal(args[0], "--page", "唯一可选参数是 --page <key>");
  assert.ok(pages[args[1]], `未知页面键：${args[1]}`);
  requestedKey = args[1];
}

const readRequired = async (filePath, label) => {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    assert.fail(`${label}不存在：${path.relative(rootDir, filePath)}（${error.code}）`);
  }
};

const keys = requestedKey ? [requestedKey] : Object.keys(pages);
const documents = new Map();

for (const key of keys) {
  const page = pages[key];
  const html = await readRequired(path.join(notesDir, page.file), `${key} 页面`);
  documents.set(key, html);

  for (const tag of ["header", "nav", "main", "article"]) {
    assert.match(html, new RegExp(`<${tag}\\b`, "i"), `${key} 页面缺少 <${tag}>`);
  }

  for (const marker of [
    '<meta charset="utf-8">',
    'name="viewport"',
    'name="description"',
    'name="study-category" content="编码 Agent"',
    'name="study-date" content="2026-08-10"',
    'href="../../assets/style.css"',
    'src="../../assets/app.js"',
    '<h2 id="核心结论">核心结论</h2>',
    '<h2 id="参考资料">参考资料</h2>',
    '检索于 <strong>2026-08-10</strong>',
  ]) {
    assert.ok(html.includes(marker), `${key} 页面缺少公共契约：${marker}`);
  }

  for (const section of page.sections) {
    assert.match(html, new RegExp(`\\bid="${section}"`), `${key} 页面缺少章节：${section}`);
  }
  for (const phrase of page.phrases) {
    assert.ok(html.includes(phrase), `${key} 页面缺少必讲内容：${phrase}`);
  }

  assert.doesNotMatch(html, /Java 25|Spring Boot|Spring AI/, `${key} 页面不得加入 Java 全栈视角`);
  assert.match(html, /<table\b/i, `${key} 页面至少需要一个比较或速查表`);
  assert.match(html, /role="img"|class="diagram-text"/, `${key} 页面需要可访问图示或等价文字`);

  const externalLinks = [
    ...html.matchAll(/<a\b([^>]*\bhref="https?:\/\/[^\"]+"[^>]*)>/gi),
  ];
  assert.ok(externalLinks.length >= 4, `${key} 页面至少需要四个一手外链`);
  for (const [, attributes] of externalLinks) {
    assert.match(attributes, /\btarget="_blank"/, `${key} 页面外链缺少 target=_blank`);
    assert.match(
      attributes,
      /\brel="noopener noreferrer"/,
      `${key} 页面外链缺少 rel=noopener noreferrer`,
    );
  }
}

if (!requestedKey) {
  for (const [key, page] of Object.entries(pages)) {
    const html = documents.get(key);
    for (const [otherKey, otherPage] of Object.entries(pages)) {
      if (otherKey === key) continue;
      assert.ok(html.includes(`href="${otherPage.file}"`), `${key} 页面缺少专题互链：${otherPage.file}`);
    }
  }
}

console.log(`PASS: Pi 七篇专题契约完整${requestedKey ? `（${requestedKey}）` : ""}`);
