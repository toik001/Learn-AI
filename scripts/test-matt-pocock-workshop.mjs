#!/usr/bin/env node
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pages, extractWorkshop, writeWorkshop } from "./matt-pocock-java-workshop.mjs";

const html = await Promise.all(pages.map((name) => fs.readFile(name, "utf8")));
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "matt-workshop-extractor-"));
try {
  for (const stage of ["starter", "red", "complete"]) {
    const files = extractWorkshop(html, stage);
    const directory = path.join(temporary, stage);
    await writeWorkshop(files, directory);
    for (const [name, content] of files) {
      assert.equal(await fs.readFile(path.join(directory, name), "utf8"), content);
    }
    assert.ok(files.get("pom.xml").includes('<project xmlns="http://maven.apache.org/POM/4.0.0"'));
    assert.ok(files.get("src/main/resources/static/index.html").startsWith("<!doctype html>"));
  }
  const files = extractWorkshop(html, "starter");
  const occupied = path.join(temporary, "occupied");
  await fs.mkdir(occupied);
  await fs.writeFile(path.join(occupied, "keep.txt"), "user work");
  await assert.rejects(writeWorkshop(files, occupied), /must be empty/);
  assert.equal(await fs.readFile(path.join(occupied, "keep.txt"), "utf8"), "user work");
  const fixture = '<pre><code data-stage="starter" data-file="../escape.txt">bad</code></pre>';
  assert.throws(() => extractWorkshop([fixture], "starter"), /unsafe example path/);
  await fs.symlink(process.cwd(), path.join(temporary, "repository-link"));
  await assert.rejects(writeWorkshop(files, path.join(temporary, "repository-link")), /independent directory/);
  assert.throws(() => extractWorkshop(html, "unknown"), /stage must be/);
  console.log("PASS: Matt Pocock 三阶段示例可无损提取，拒绝目录穿越、覆盖与知识库内写入");
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}
