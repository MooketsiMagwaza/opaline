// Reports distributable sizes without loading application code or adding a build dependency.
import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1");
const codeBudget = { raw: 180 * 1024, gzip: 60 * 1024 };
const packageBudget = 420 * 1024;

function filesBelow(path) {
  if (!existsSync(path)) return [];
  const entry = statSync(path);
  if (entry.isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap(child => filesBelow(join(path, child.name)));
}

function format(bytes) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

const dist = filesBelow(join(root, "dist"));
if (!dist.length) throw new Error("dist is missing; run npm run build first");
const compressible = new Set([".html", ".css", ".js", ".json", ".svg"]);
const raw = dist.reduce((sum, file) => sum + statSync(file).size, 0);
const gzip = dist.reduce((sum, file) => sum + (compressible.has(extname(file)) ? gzipSync(readFileSync(file)).length : statSync(file).size), 0);
const codeFiles = dist.filter(file => compressible.has(extname(file)));
const codeRaw = codeFiles.reduce((sum, file) => sum + statSync(file).size, 0);
const codeGzip = codeFiles.reduce((sum, file) => sum + gzipSync(readFileSync(file)).length, 0);

console.log(`Frontend package: ${format(raw)} raw · ${format(gzip)} transfer · ${dist.length} files`);
console.log(`Code and UI: ${format(codeRaw)} raw · ${format(codeGzip)} gzip`);
for (const file of dist.sort((left, right) => statSync(right).size - statSync(left).size)) {
  console.log(`  ${relative(join(root, "dist"), file)}  ${format(statSync(file).size)}`);
}

for (const artifact of [
  "src-tauri/target/release/opaline.exe",
  "src-tauri/target/debug/opaline.exe",
]) {
  const path = join(root, ...artifact.split("/"));
  if (existsSync(path)) console.log(`${artifact}: ${format(statSync(path).size)}`);
}
for (const directory of ["src-tauri/target/release/bundle/nsis", "src-tauri/target/release/bundle/msi"]) {
  for (const file of filesBelow(join(root, ...directory.split("/")))) console.log(`${relative(root, file)}: ${format(statSync(file).size)}`);
}

if (codeRaw > codeBudget.raw || codeGzip > codeBudget.gzip) throw new Error(`Code budget exceeded (limits: ${format(codeBudget.raw)} raw, ${format(codeBudget.gzip)} gzip)`);
if (raw > packageBudget) throw new Error(`Frontend package budget exceeded (limit: ${format(packageBudget)})`);
