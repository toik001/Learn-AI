#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const pages = [
  "public/notes/codex/2026-09-16-Matt-Pocock-Skills安装与Java练习环境.html",
  "public/notes/codex/2026-09-16-Matt-Pocock-Skills订单取消实战教程.html",
];
const levels = ["starter", "red", "complete"];
const entities = { lt: "<", gt: ">", amp: "&", quot: '"', "#x27": "'", "#39": "'" };
const decode = (value) => value.replace(/&(lt|gt|amp|quot|#x27|#39);/g, (_, key) => entities[key]);

export function extractWorkshop(htmlPages, stage) {
  if (!levels.includes(stage)) throw new Error("stage must be starter, red, or complete");
  const layers = new Map(levels.map((name) => [name, new Map()]));
  for (const html of htmlPages) {
    for (const match of html.matchAll(/<code\b([^>]*)>([\s\S]*?)<\/code>/g)) {
      const layer = /\bdata-stage="([^"]+)"/.exec(match[1])?.[1];
      const name = /\bdata-file="([^"]+)"/.exec(match[1])?.[1];
      if (!layer && !name) continue;
      if (!layers.has(layer) || !name) throw new Error("incomplete example metadata");
      const segments = name.split("/");
      if (!/^[a-zA-Z0-9._/-]+$/.test(name) || name.startsWith("/") ||
          segments.some((part) => !part || part === "." || part === "..")) {
        throw new Error(`unsafe example path: ${name}`);
      }
      if (layers.get(layer).has(name)) throw new Error(`duplicate example: ${layer}/${name}`);
      layers.get(layer).set(name, `${decode(match[2]).trimEnd()}\n`);
    }
  }
  const files = new Map();
  for (const level of levels.slice(0, levels.indexOf(stage) + 1)) {
    for (const entry of layers.get(level)) files.set(...entry);
  }
  if (!files.has("pom.xml")) throw new Error("no workshop pom.xml found");
  return files;
}

export async function writeWorkshop(files, outputDirectory) {
  const output = path.resolve(outputDirectory);
  await fs.mkdir(output, { recursive: true });
  const realOutput = await fs.realpath(output);
  const realRepository = await fs.realpath(repository);
  if (realOutput === realRepository || realOutput.startsWith(`${realRepository}${path.sep}`)) {
    throw new Error("extract into an independent directory outside the knowledge repository");
  }
  if ((await fs.readdir(output)).length !== 0) {
    throw new Error("output directory must be empty; existing work will not be overwritten");
  }
  for (const [name, content] of files) {
    const target = path.join(realOutput, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, { flag: "wx" });
  }
}

async function main() {
  const [stage, output, ...extra] = process.argv.slice(2);
  if (!output || extra.length) {
    throw new Error("usage: node scripts/matt-pocock-java-workshop.mjs <starter|red|complete> <empty-directory>");
  }
  const html = await Promise.all(pages.map((name) => fs.readFile(path.join(repository, name), "utf8")));
  const files = extractWorkshop(html, stage);
  await writeWorkshop(files, output);
  console.log(`EXTRACTED: ${stage}, ${files.size} files → ${path.resolve(output)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
