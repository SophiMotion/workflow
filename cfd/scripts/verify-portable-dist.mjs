import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(projectRoot, "dist");

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const absolutePath = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolutePath) : [relative(distDir, absolutePath)];
  }));
  return files.flat().sort();
}

const files = await listFiles(distDir);
assert.deepEqual(
  files,
  ["index.html"],
  `Portable build must contain only dist/index.html; found: ${files.join(", ")}`,
);

const html = await readFile(join(distDir, "index.html"), "utf8");
assert.match(html, /<div id="root"><\/div>/, "React mount point is missing");
assert.match(html, /<style>[^]*<\/style>/, "CSS must be embedded in index.html");
assert.match(html, /<script type="module">[^]*<\/script>/, "Application JavaScript must be embedded in index.html");
const style = html.match(/<style>([^]*)<\/style>/)?.[1] ?? "";
const script = html.match(/<script type="module">([^]*)<\/script>/)?.[1] ?? "";
const documentShell = html
  .replace(/<style>[^]*<\/style>/, "<style></style>")
  .replace(/<script type="module">[^]*<\/script>/, '<script type="module"></script>');
assert.doesNotMatch(documentShell, /<(?:script|link)\b[^>]+(?:src|href)=/i, "External script or stylesheet references remain");
assert.doesNotMatch(documentShell, /(?:\.\/|\/)assets\//, "The HTML shell still references an assets directory");

const documentResources = [...documentShell.matchAll(
  /<(?:img|source|video|audio|iframe|object|embed)\b[^>]*\b(?:src|srcset|poster|data)=["']([^"']+)["']/gi,
)].map((match) => match[1].trim());
assert.deepEqual(
  documentResources.filter((url) => !url.startsWith("data:") && !url.startsWith("#")),
  [],
  "External media or embedded-document references remain",
);

assert.doesNotMatch(style, /@import\b/i, "An external CSS @import remains in the portable build");
const cssUrls = [...style.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)]
  .map((match) => match[2].trim());
assert.deepEqual(
  cssUrls.filter((url) => !url.startsWith("data:") && !url.startsWith("#")),
  [],
  "An external CSS url() reference remains in the portable build",
);

assert.doesNotMatch(script, /\bimport\s*\(/, "A dynamic import remains in the portable JavaScript bundle");
assert.doesNotMatch(
  script,
  /(?:^|[;\n])\s*import(?:\s*["'{*]|\s+[A-Za-z_$])/,
  "A static import remains in the portable JavaScript bundle",
);

const workerMimeOffset = script.indexOf("text/javascript;charset=utf-8");
assert.notEqual(workerMimeOffset, -1, "The inline CFD worker MIME marker is missing");
const workerBootstrap = script.slice(Math.max(0, workerMimeOffset - 250), workerMimeOffset + 900);
assert.match(workerBootstrap, /new Blob\(/, "The CFD worker source is not embedded in a Blob");
assert.match(workerBootstrap, /createObjectURL\(/, "The CFD worker Blob URL bootstrap is missing");
assert.match(workerBootstrap, /new Worker\(/, "The CFD worker constructor is missing from the embedded bootstrap");
assert.match(
  workerBootstrap,
  /data:text\/javascript;charset=utf-8,/,
  "The inline CFD worker data-URL fallback is missing",
);

console.log(`Portable dist verified: index.html only (${Buffer.byteLength(html).toLocaleString()} bytes).`);
