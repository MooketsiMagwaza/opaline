// Fails when the documentation no longer matches the repository: broken links and images, paths that do not exist, version, test-count and
// size-budget claims that disagree with the code, and modules, commands or settings sections the docs forgot. Dependency-free.
// Run with `npm run docs:check`. CHANGELOG.md and DEVLOG.md are histories, so their old paths and numbers are left alone.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skippedFolders = new Set(["node_modules", "target", ".git", "dist", "archive", "coverage", "scratchpad"]);
const historyFiles = new Set(["CHANGELOG.md", "DEVLOG.md"]);
const plannedFiles = new Set(["docs/V0_4_WORKORDER.md"]); // a plan: it names files that do not exist yet
const problems = [];
const report = (file, message, line) => problems.push(`${file}${line ? `:${line}` : ""}  ${message}`);

const walk = (folder) => readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
  if (skippedFolders.has(entry.name)) return [];
  const path = join(folder, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});
const text = (path) => readFileSync(join(root, path), "utf8");
const exists = (path) => existsSync(join(root, path));
const rel = (path) => relative(root, path).replaceAll("\\", "/");

const allFiles = walk(root).map(rel);
const markdown = allFiles.filter(file => file.endsWith(".md"));
const docs = new Map(markdown.map(file => [file, text(file)]));
const lineOf = (source, index) => source.slice(0, index).split("\n").length;
const everyDoc = [...docs.values()].join("\n");

// ---- 1. links and images resolve, anchors included -------------------------------------------------------------------
const slug = (heading) => heading.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[`*_]/g, "").toLowerCase().trim()
  .replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s/g, "-");
const anchorsOf = (source) => {
  let fenced = false;
  const anchors = new Set();
  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith("```")) fenced = !fenced;
    const heading = !fenced && line.match(/^#{1,6}\s+(.*)$/);
    if (heading) anchors.add(slug(heading[1]));
  }
  return anchors;
};
for (const [file, source] of docs) {
  const targets = [...source.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\b(?:src|href)="([^"]+)"/g)];
  for (const match of targets) {
    const target = match[1] ?? match[2];
    if (/^(https?:|mailto:|data:)/.test(target)) continue;
    const [path, anchor] = target.split("#");
    const resolved = path ? rel(resolve(root, dirname(file), decodeURIComponent(path))) : file;
    const at = lineOf(source, match.index);
    if (!exists(resolved)) { report(file, `link target does not exist: ${target}`, at); continue; }
    if (anchor && resolved.endsWith(".md") && !anchorsOf(docs.get(resolved) ?? "").has(anchor)) report(file, `no heading for anchor: ${target}`, at);
  }
}

// ---- 2. repository paths named in backticks exist --------------------------------------------------------------------
for (const [file, source] of docs) {
  if (historyFiles.has(file) || plannedFiles.has(file)) continue;
  for (const match of source.matchAll(/`((?:src|src-tauri|scripts|docs|tests|assets|\.github)\/[A-Za-z0-9_.\/-]+)`/g)) {
    const path = match[1].replace(/\/$/, "");
    if (!exists(path)) report(file, `names a path that does not exist: ${match[1]}`, lineOf(source, match.index));
  }
}

// ---- 3. every screenshot is used, and every script is documented ------------------------------------------------------
const scriptText = allFiles.filter(file => file.startsWith("scripts/")).map(text).join("\n");
for (const image of allFiles.filter(file => file.startsWith("docs/images/"))) {
  const name = basename(image);
  if (!everyDoc.includes(name) && !scriptText.includes(name)) report(image, "is not referenced by any document or script (delete it, or regenerate the suite)");
}
for (const script of allFiles.filter(file => file.startsWith("scripts/") && file.endsWith(".mjs"))) {
  if (!everyDoc.includes(basename(script))) report(script, "is not mentioned in any document");
}

// ---- 4. versions agree everywhere the release checklist lists --------------------------------------------------------
const version = JSON.parse(text("package.json")).version;
const codename = text("src-tauri/src/lib.rs").match(/const CODENAME: &str = "([^"]+)"/)?.[1];
const lock = JSON.parse(text("package-lock.json"));
const versions = {
  "package-lock.json": lock.version,
  "package-lock.json packages[\"\"]": lock.packages?.[""]?.version,
  "src-tauri/tauri.conf.json": JSON.parse(text("src-tauri/tauri.conf.json")).version,
  "src-tauri/Cargo.toml": text("src-tauri/Cargo.toml").match(/^version = "([^"]+)"/m)?.[1],
  "src-tauri/Cargo.lock": text("src-tauri/Cargo.lock").match(/name = "opaline"\r?\nversion = "([^"]+)"/)?.[1],
  "scripts/verify-ui.mjs": text("scripts/verify-ui.mjs").match(/version: "([^"]+)", codename: "([^"]+)"/)?.[1],
};
for (const [where, found] of Object.entries(versions)) if (found !== version) report(where, `version ${found} does not match package.json ${version}`);
if (text("scripts/verify-ui.mjs").match(/version: "[^"]+", codename: "([^"]+)"/)?.[1] !== codename) report("scripts/verify-ui.mjs", `codename does not match CODENAME ${codename}`);
if (!text("CHANGELOG.md").includes(`## [${version}]`)) report("CHANGELOG.md", `has no [${version}] heading`);
if (!text("README.md").includes(`v${version}`)) report("README.md", `does not mention v${version}`);
if (!text("WORKORDER.md").includes(`v${version}`)) report("WORKORDER.md", `does not mention v${version}`);
const [major, minor] = version.split(".");
if (!text("docs/NAMING.md").includes(`| ${major}.${minor} | ${codename} |`)) report("docs/NAMING.md", `codename table has no "${major}.${minor} | ${codename}" row`);

// ---- 5. test counts and size budgets quoted in prose match the code --------------------------------------------------
const count = (files, pattern) => files.reduce((sum, file) => sum + (text(file).match(pattern) ?? []).length, 0);
const frontendTests = count(allFiles.filter(file => /^tests\/.*\.test\.ts$/.test(file)), /^\s*(?:it|test)\(/gm);
const rustTests = count(allFiles.filter(file => /^src-tauri\/src\/.*\.rs$/.test(file)), /#\[test\]/g);
for (const [file, source] of docs) {
  if (historyFiles.has(file)) continue;
  for (const match of source.matchAll(/(?<![\d.])(\d+) ((?:[A-Za-z]+ ){0,2})tests\b/g)) {
    const words = match[2];
    const expected = /Rust/.test(words) ? rustTests : /frontend|Vitest|unit/.test(words) ? frontendTests : null;
    if (expected !== null && Number(match[1]) !== expected) report(file, `says ${match[0]}, but the code has ${expected}`, lineOf(source, match.index));
  }
}
const budget = text("scripts/measure-build.mjs").match(/codeBudget = \{ raw: (\d+) \* 1024, gzip: (\d+) \* 1024 \}/);
if (!budget) report("scripts/measure-build.mjs", "codeBudget not found; update scripts/check-docs.mjs");
else for (const [file, source] of docs) {
  if (historyFiles.has(file)) continue;
  for (const match of source.matchAll(/(?<![\d.])(\d+) KiB raw(?: \/ | and | or |, )(\d+) KiB gzip/g)) {
    if (match[1] !== budget[1] || match[2] !== budget[2]) report(file, `quotes a ${match[1]} / ${match[2]} KiB budget; the build enforces ${budget[1]} / ${budget[2]}`, lineOf(source, match.index));
  }
}

// ---- 6. modules, commands and settings sections are documented -------------------------------------------------------
for (const module of allFiles.filter(file => /^src-tauri\/src\/[a-z_]+\.rs$/.test(file) && !file.endsWith("main.rs")).map(file => basename(file))) {
  for (const file of ["AGENTS.md", "WORKORDER.md"]) if (!docs.get(file).includes(module.replace(/\.rs$/, ""))) report(file, `does not mention the Rust module ${module}`);
}
for (const folder of readdirSync(join(root, "src"), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)) {
  if (!docs.get("src/README.md").includes(`\`${folder}/\``)) report("src/README.md", `directory map does not list src/${folder}/`);
  if (folder !== "data" && !exists(`src/${folder}/README.md`)) report(`src/${folder}`, "has no README.md");
}
const handlers = text("src-tauri/src/lib.rs").match(/generate_handler!\[([\s\S]*?)\]/)?.[1].split(",").map(name => name.trim()).filter(Boolean) ?? [];
const contract = text("WORKORDER.md").split("## 8.")[1]?.split("## 9.")[0] ?? "";
for (const command of handlers) if (!new RegExp(`\\b${command}\\b`).test(contract)) report("WORKORDER.md", `§8 does not list the command ${command}`);
const presetNames = [...text("src/appearance/presets.ts").matchAll(/\{ id: "[a-z-]+", name: "([^"]+)"/g)].map(match => match[1]);
for (const name of presetNames) for (const file of ["README.md", "docs/ARCHITECTURE.md"]) if (!docs.get(file).includes(name)) report(file, `does not mention the built-in preset "${name}"`);
for (const [file, source] of docs) {
  if (historyFiles.has(file)) continue;
  const words = { 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven" };
  for (const match of source.matchAll(/\b(Three|Four|Five|Six|Seven|three|four|five|six|seven) (?:named |built-in )?presets\b/g)) {
    if (match[1].toLowerCase() !== words[presetNames.length]?.toLowerCase()) report(file, `says "${match[0]}", but there are ${presetNames.length} built-in presets`, lineOf(source, match.index));
  }
}
const sectionTitles =[...text("src/settings/panel.ts").matchAll(/\bid: "\w+",\s*title: "([^"]+)"/g)].map(match => match[1]);
for (const title of sectionTitles) for (const file of ["README.md", "src/settings/README.md"]) if (!docs.get(file).includes(title)) report(file, `does not mention the Settings section "${title}"`);

if (problems.length) {
  console.error(`Documentation check failed (${problems.length}):\n${problems.map(problem => `  ${problem}`).join("\n")}`);
  process.exit(1);
}
console.log(`Documentation check passed: ${markdown.length} Markdown files, version ${version} "${codename}", ${frontendTests} frontend and ${rustTests} Rust tests, ${handlers.length} commands.`);
