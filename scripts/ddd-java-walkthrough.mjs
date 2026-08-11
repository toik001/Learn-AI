#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const EXPECTED_JAVA_FILES = 14;

const entity = Object.freeze({
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'",
  "#39": "'",
});

const decodeHtmlCode = (text) => text.replace(
  /&(lt|gt|amp|quot|apos|#39);/g,
  (_, name) => entity[name],
);

const attribute = (attributes, name) => {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escapedName}=(['"])(.*?)\\1`, "i")
    .exec(attributes)?.[2];
};

const addFile = (files, sourcePath, source) => {
  if (!/^src\/example\/order\/[A-Za-z0-9/]+\.java$/.test(sourcePath)) {
    throw new Error(`unsafe source path: ${sourcePath}`);
  }
  if (files.has(sourcePath)) {
    throw new Error(`duplicate source path: ${sourcePath}`);
  }
  files.set(sourcePath, `${source.trimEnd()}\n`);
};

export function extractFrameworkFreeJava(html) {
  const blockPattern = /<pre>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi;
  const files = new Map();

  for (const match of html.matchAll(blockPattern)) {
    const [, attributes, encodedBody] = match;
    if (attribute(attributes, "data-bundle") !== "framework-free") continue;

    const singleSourcePath = attribute(attributes, "data-source");
    const body = decodeHtmlCode(encodedBody);
    if (singleSourcePath) {
      addFile(files, singleSourcePath, body);
      continue;
    }

    const markers = [...body.matchAll(
      /^\/\/ (src\/example\/order\/[A-Za-z0-9/]+\.java)\n/gm,
    )];
    if (markers.length === 0) {
      throw new Error("tagged multi-file block has no source markers");
    }
    markers.forEach((marker, index) => {
      const start = marker.index + marker[0].length;
      const end = index + 1 < markers.length ? markers[index + 1].index : body.length;
      addFile(files, marker[1], body.slice(start, end));
    });
  }

  if (files.size !== EXPECTED_JAVA_FILES) {
    throw new Error(
      `expected ${EXPECTED_JAVA_FILES} Java files, extracted ${files.size}`,
    );
  }
  return files;
}

export async function writeJavaBundle(files, bundleDirectory) {
  const bundleDir = path.resolve(bundleDirectory);
  for (const [sourcePath, source] of files) {
    const target = path.resolve(bundleDir, ...sourcePath.split("/"));
    if (!target.startsWith(`${bundleDir}${path.sep}`)) {
      throw new Error(`path escapes bundle directory: ${sourcePath}`);
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, source, "utf8");
  }
}

async function main() {
  const [pagePath, bundleDirectory] = process.argv.slice(2);
  if (!pagePath || !bundleDirectory || process.argv.length !== 4) {
    throw new Error(
      "usage: node scripts/ddd-java-walkthrough.mjs <page.html> <bundle-directory>",
    );
  }
  const html = await fs.readFile(pagePath, "utf8");
  const files = extractFrameworkFreeJava(html);
  await writeJavaBundle(files, bundleDirectory);
  console.log(`EXTRACTED: ${files.size} Java files`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
