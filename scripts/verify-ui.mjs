// Run against Vite. All OS calls use demo fixtures in a fresh browser context; no real user data.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.OPALINE_PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true, executablePath: process.env.OPALINE_BROWSER_PATH || chromium.executablePath() });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => { errors.push(error.message); console.error("UI error:", error.message); });
const output = new URL("../docs/images/", import.meta.url);
mkdirSync(output, { recursive: true });

const iconManifest = JSON.parse(readFileSync(new URL("../docs/demo-icons/manifest.json", import.meta.url), "utf8"));
await page.addInitScript((manifest) => {
  const names = ["Visual Studio Code", "Terminal", "Docker Desktop", "Client portal", "Design assets", "OBS Studio", "Design references", "Firefox", "Obsidian", "Spotify", "Documents", "Notion Calendar", "Microsoft Edge", "Discord", "WhatsApp", "Notion", "Steam", "ChatGPT", "Claude", "Prompts", "Android Studio", "Coursework", "Lecture notes", "Assignments", "Design system", "Open-source", "Developer notes", "2024", "2025", "Previous builds", "Samples", "Resources", "Templates", "Downloads", "Reference library"];
  const folderIndices = [3, 4, 6, 10, 19, ...Array.from({ length: names.length - 21 }, (_, index) => index + 21)];
  const items = names.map((name, index) => ({ name, path: `demo:${index}`, isFolder: folderIndices.includes(index) }));
  if (!localStorage.getItem("opaline.settings")) localStorage.setItem("opaline.settings", JSON.stringify({backdropBlur:10,tintStrength:.16,tintColor:"#0b1226",iconSize:"small",rail:true,railMagnify:false,quoteIntervalSeconds:5}));
  const data = (svg) => `data:image/svg+xml;base64,${btoa(svg)}`;
  const colours = ["#6ea7ff", "#ad8cff", "#f18c9b", "#e4b875", "#66c6bb", "#db9be8"];
  const icon = (path) => {
    const index = path.startsWith("demo:") ? Number(path.slice(5)) : -1;
    if (index >= 0 && manifest[names[index]]) return manifest[names[index]];
    if (index < 0 || folderIndices.includes(index)) return data('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><path d="M5 13h23l7 7h24v35H5z" fill="#eebc36"/><path d="M5 24h54v31H5z" fill="#ffdc69"/><path d="M5 25h54" stroke="#ffe99c" stroke-width="2"/></svg>');
    const shape = '<rect x="17" y="16" width="30" height="32" rx="5" fill="none" stroke="white" stroke-width="4"/><path d="M24 26h16m-16 9h10" stroke="white" stroke-width="3"/>';
    return data(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="16" fill="${colours[index % colours.length]}"/>${shape}</svg>`);
  };
  const backdrop = data('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800"><defs><linearGradient id="b" x2="1" y2="1"><stop stop-color="#222833"/><stop offset=".5" stop-color="#161c2a"/><stop offset="1" stop-color="#0d1422"/></linearGradient></defs><path fill="url(#b)" d="M0 0h1280v800H0z"/></svg>');
  const initial = {
    "groups.json": { version: 1, organized: true, groups: [
      { id: "ides", name: "IDEs", items: [items[0],items[20]].map((item) => item.path) },
      { id: "devtools", name: "Dev tools", items: [items[1],items[2]].map((item) => item.path) },
      { id: "design", name: "Creative", items: items.slice(4, 7).map((item) => item.path) },
      { id: "browsers", name: "Browsers", items: [items[7].path,items[12].path] },
      { id: "chat", name: "Chat", items: [items[13].path,items[14].path] },
      { id: "notes", name: "Notes & planning", items: [items[8].path,items[10].path,items[11].path,items[15].path] },
      { id: "games", name: "Games & music", items: [items[9].path,items[16].path] },
      { id: "agents", name: "AI & code agents", items: items.slice(17,20).map(item=>item.path) },
      { id: "university", name: "University", items: items.slice(21,24).map(item=>item.path) },
      { id: "code", name: "Code projects", items: [items[3],...items.slice(24,27)].map(item=>item.path) },
      { id: "archive", name: "Archive", items: items.slice(27,30).map(item=>item.path) },
      { id: "reference", name: "Reference", items: [items[31],items[32],items[34]].map(item=>item.path) },
    ], launches: {}, layout: {} },
    "workspaces.json": [{ id: "dev-tools", name: "Dev tools", items: items.slice(0, 4) }, { id: "screen-3", name: "Screen 3", items: [] }],
  };
  for (const [key, value] of Object.entries(initial)) if (localStorage.getItem(`demo:${key}`) === null) localStorage.setItem(`demo:${key}`, JSON.stringify(value));
  window.__demoCalls = [];
  window.__demoFailSave = false;
  window.__demoInvoke = async (command, args) => {
    window.__demoCalls.push(command);
    switch (command) {
      case "status": return { hotkeyOk: true, hotkey: "Ctrl+Alt+Space", version: "0.2.1", codename: "Borosilicate", pinned: true };
      case "load_store": return localStorage.getItem(`demo:${args.name}`);
      case "save_store": if (window.__demoFailSave) throw new Error("Demo disk full"); localStorage.setItem(`demo:${args.name}`, args.json); return;
      case "list_items": return items;
      case "list_apps": return items.filter(item=>!item.isFolder);
      case "get_icon": return icon(args.path);
      case "workspace_item": return { name: "Example folder", path: args.path, isFolder: true };
      case "pick_workspace_item": return { name: args.kind === "folder" ? "Example folder" : "Example file", path: args.kind === "folder" ? "C:\\Example\\Project" : "C:\\Example\\Notes.txt", isFolder: args.kind === "folder" };
      case "folder_preview": return ["Overview.md", "Screenshots", "Notes", "Assets"].map((name, index) => ({ name, path: `preview:${index}`, isFolder: index > 0 }));
      case "rail_items": return [7, 0, 1, 5, 8].map((index, order) => ({ id: `app-${index}`, name: names[index], iconPath: items[index].path, launchPath: items[index].path, pinned: order < 4, windows: order < 3 ? [{ hwnd: order + 101, title: `${names[index]} — Example project`, minimized: false }] : [] }));
      case "thumbnail": await new Promise((resolve) => setTimeout(resolve, 180)); return data('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220"><rect width="360" height="220" fill="#202a3e"/><path d="M0 0h360v25H0z" fill="#3b4964"/><circle cx="13" cy="13" r="4" fill="#f59c9c"/><circle cx="27" cy="13" r="4" fill="#f1d08a"/><path d="M20 55h180M20 80h260M20 105h220M20 130h130" stroke="#98b9ed" stroke-width="8"/><path d="M20 160h290M20 185h250" stroke="#b4a1dd" stroke-width="8"/></svg>');
      case "screen_time": return { enabled: true, supported: true, saveError: null, entries: [0, 7, 12, 1].map((index, order) => { const day = new Date(); const key = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,"0")}-${String(day.getDate()).padStart(2,"0")}`; return { id: `usage-${index}`, name: names[index], path: items[index].path, totalSeconds: [18900, 7800, 4200, 2700][order], todaySeconds: [6480, 3120, 1680, 540][order], dailySeconds: { [key]: [6480, 3120, 1680, 540][order] } }; }) };
      case "start_menu_status": return { enabled: false, available: true };
      case "plugin:autostart|is_enabled": return false;
      case "ready": setTimeout(() => window.__TAURI_INTERNALS__.invoke("plugin:event|emit", { event: "launcher-prepare", payload: { snapshot: backdrop, reuseSnapshot: false, page: "desktop" } }), 20); return;
      default: return null;
    }
  };
}, iconManifest);
await page.route(/\/src\/launcher\.ts(?:\?.*)?$/, async (route) => {
  const response = await route.fetch();
  await route.fulfill({ response, body: `const { mockIPC } = await import('/node_modules/@tauri-apps/api/mocks.js'); mockIPC(window.__demoInvoke, { shouldMockEvents: true });\n${await response.text()}` });
});
const wait = (milliseconds) => page.waitForTimeout(milliseconds);
const visible = (selector) => page.locator(selector).isVisible();
const touchPinch = (endX) => page.locator("#apps-surface").evaluate((node, endX) => {
  const touch = (type, pointerId, clientX) => node.dispatchEvent(new PointerEvent(type, { pointerId, pointerType: "touch", clientX, clientY: 400, bubbles: true, cancelable: true }));
  const firstEnd = endX > 600 ? 420 : 520;
  touch("pointerdown", 1, 480); touch("pointerdown", 2, 600);
  touch("pointermove", 1, firstEnd); touch("pointermove", 2, endX);
  touch("pointerup", 1, firstEnd); touch("pointerup", 2, endX);
}, endX);
const touchSwipe = (distance) => page.locator("#apps-surface").evaluate((node, distance) => {
  const touch = (type, pointerId, clientX) => node.dispatchEvent(new PointerEvent(type, { pointerId, pointerType: "touch", clientX, clientY: 400, bubbles: true, cancelable: true }));
  touch("pointerdown", 1, 480); touch("pointerdown", 2, 600);
  touch("pointermove", 1, 480 + distance); touch("pointermove", 2, 600 + distance);
  touch("pointerup", 1, 480 + distance); touch("pointerup", 2, 600 + distance);
}, distance);
let screenshotCount = 0;
const shot = async (name) => {
  await wait(400);
  const path = new URL(name, output).pathname.replace(/^\/(.:)/, "$1");
  for (let attempt = 0; attempt < 4; attempt++) {
    try { await page.screenshot({ path }); screenshotCount++; return; }
    catch (error) { if (error.code !== "UNKNOWN" || attempt === 3) throw error; await wait(300); }
  }
};
try {
  await page.goto("http://127.0.0.1:1420");
  await page.waitForSelector("#grid .tile"); await wait(1000);
  assert(await visible("#apps-surface"));
  assert.equal(await page.locator("#page-edges .edge-arrow").count(), 2);
  assert.equal(await page.locator(".home-footer .home-page-button").count(), 3);
  assert.equal(await page.locator("#home-add-trigger").count(), 0);
  assert(!(await visible("#status")));
  assert.equal(await page.locator("#page-nav, #quit-button").count(), 0);
  assert.equal(await page.locator(".header-nav .orb").count(), 4);
  assert(await page.evaluate(() => {
    const search = getComputedStyle(document.getElementById("search-wrap"));
    const left = getComputedStyle(document.getElementById("header-left"));
    const button = getComputedStyle(document.querySelector("#header-left .orb"));
    return left.backgroundImage === search.backgroundImage && left.height === search.height && button.backgroundColor === "rgba(0, 0, 0, 0)";
  }));
  await page.locator('#header-left [data-page="all-apps"]').click(); assert(await visible("#app-list-surface"));
  assert(!(await visible("#page-edges")));
  await shot("all-apps.png");
  await page.locator('#header-left [data-page="screen-time"]').click(); assert(await visible("#screen-time-surface"));
  await page.locator('#header-right [data-page="focus"]').click(); assert(await visible("#focus-surface"));
  await page.locator("#home-dock").click(); assert(await visible("#apps-surface"));
  await page.keyboard.press("Tab"); assert(await visible("#workspace-surface"));
  await page.keyboard.press("Tab"); assert.equal(await page.locator("#workspace-title").textContent(), "Screen 3");
  assert(await visible("#page-edges"));
  assert(!(await visible("#workspace-add-trigger")));
  await shot("screen-3.png");
  await page.keyboard.press("Alt+1");
  await page.mouse.move(640, 450);
  assert.equal(await page.locator("#rail .app-list-shortcut").count(), 0);
  assert.equal(await page.locator("#rail").evaluate(node => getComputedStyle(node).scrollbarWidth), "none");
  assert.equal(await page.locator("#rail").evaluate(node => node.getBoundingClientRect().height), await page.locator("#search-wrap").evaluate(node => node.getBoundingClientRect().height));
  assert.equal(await page.locator("#grid-layer").evaluate(node=>getComputedStyle(node).maskImage), "none");
  assert(await page.locator("#grid .label").evaluateAll(nodes=>nodes.every(node=>node.getBoundingClientRect().height >= 30)));
  await shot("desktop.png");
  await page.locator("#page-next").click(); assert(await visible("#workspace-surface"));
  assert.equal(await page.locator("#workspace-title").textContent(), "Dev tools");
  await page.locator("#page-prev").click(); assert(await visible("#apps-surface"));
  await page.locator("#apps-surface").dispatchEvent("wheel", {deltaX: 120, deltaY: 2, deltaMode: 0});
  assert(await visible("#workspace-surface"));
  assert.equal(await page.locator("#workspace-title").textContent(), "Dev tools");
  await page.keyboard.press("Alt+1");
  await wait(600);
  await touchSwipe(-115);
  assert.equal(await page.locator("#workspace-title").textContent(), "Dev tools");
  await page.keyboard.press("Alt+1");
  await wait(600);
  await touchSwipe(115);
  assert.equal(await page.locator("#workspace-title").textContent(), "Screen 3");
  await page.keyboard.press("Alt+1");
  await wait(600);
  await touchPinch(720);
  assert(await visible("#workspace-surface"));
  assert.equal(await page.locator("#workspace-title").textContent(), "Dev tools");
  await page.keyboard.press("Alt+1");
  await wait(600);
  await touchPinch(560);
  assert(await visible("#workspace-surface"));
  assert.equal(await page.locator("#workspace-title").textContent(), "Screen 3");
  await page.keyboard.press("Alt+1");
  await wait(600);
  await page.locator("#apps-surface").dispatchEvent("wheel", {ctrlKey: true, deltaX: 0, deltaY: 20, deltaMode: 0});
  assert(await visible("#gesture-cue"));
  assert.equal(await page.locator("#apps-surface").getAttribute("data-gesture-preview"), "true");
  assert.notEqual(await page.locator("#apps-surface").evaluate(node => getComputedStyle(node).transform), "none");
  await page.locator("#apps-surface").dispatchEvent("wheel", {ctrlKey: true, deltaX: 0, deltaY: 40, deltaMode: 0});
  assert(await visible("#workspace-surface"));
  assert.equal(await page.locator("#workspace-title").textContent(), "Screen 3");
  await page.keyboard.press("Alt+1");
  await wait(600);
  await page.locator("#apps-surface").dispatchEvent("wheel", {ctrlKey: true, deltaX: 0, deltaY: -60, deltaMode: 0});
  assert(await visible("#workspace-surface"));
  assert.equal(await page.locator("#workspace-title").textContent(), "Dev tools");
  await page.keyboard.press("Alt+1");
  await wait(600);
  await page.locator("#apps-surface").dispatchEvent("wheel", {ctrlKey: true, deltaX: 0, deltaY: -20, deltaMode: 0});
  assert(await visible("#gesture-cue"));
  await wait(450);
  assert(!(await visible("#gesture-cue")));
  assert(!(await page.locator("#apps-surface").getAttribute("data-gesture-preview")));
  assert(await visible("#apps-surface"));
  await page.keyboard.press("Alt+1");
  await page.locator('.pane-tile[data-id="ides"]').hover(); await wait(300);
  assert(!(await visible("#tile-peek")));
  await wait(280);
  assert(await visible("#tile-peek"));
  assert.equal(await page.locator("#tile-peek .peek-tile").count(), 2);
  assert.match(await page.locator("#tile-peek").textContent(), /Visual Studio Code.*Android Studio/s);
  await shot("folder-peek.png");
  await page.locator('.item-tile[data-path="demo:30"]').hover(); await wait(580);
  assert.match(await page.locator("#tile-peek").textContent(), /Overview.md/);
  assert.equal(await page.locator("#tile-peek .peek-tile").count(), 4);
  await page.locator('.item-tile[data-path="demo:30"]').click({button:"right"});
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('demo:workspaces.json'))[0].items.length === 5);
  await page.keyboard.press("Alt+1");
  await page.keyboard.press("Tab");
  assert(await visible("#workspace-surface"));
  assert.equal(await page.locator("#workspace-title").textContent(), "Dev tools");
  await shot("workspaces.png");
  await page.keyboard.press("Alt+2");
  assert(await visible("#app-list-surface"));
  await page.locator("#search").fill("visual");
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.evaluate(() => document.activeElement?.className), "app-list-item");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#app-list .app-list-item").count(), 16);
  await page.keyboard.press("Control+Alt+t");
  assert(await visible("#screen-time-surface"));
  await page.waitForSelector(".usage-row");
  assert.equal(await page.locator("#usage-total").textContent(), "3 hr 17 min");
  await shot("screen-time.png");
  assert.equal(await page.locator("#usage-chart .chart-day").count(), 7);
  assert((await page.locator("#usage-chart .chart-bars").boundingBox()).width < 260);
  await page.locator("#usage-period").click();
  await page.getByRole("menuitemradio", { name: "Last 30 days" }).click();
  assert.equal(await page.locator("#usage-chart .chart-day").count(), 30);
  assert.equal(await page.locator("#usage-chart .chart-bars").evaluate(node => getComputedStyle(node).columnGap), "3px");
  await shot("screen-time-chart.png");
  await page.keyboard.press("Control+Alt+f");
  assert(await visible("#focus-surface"));
  await page.locator("#focus-start").click();
  assert.equal(await page.locator("#focus-start").textContent(), "Pause");
  await wait(250);
  assert.equal(await page.locator("#focus-start").evaluate(node => getComputedStyle(node).backgroundColor), "rgb(216, 233, 255)");
  await shot("focus.png");
  assert((await page.locator("#focus-chart .chart-bars").boundingBox()).width < 260);
  await page.locator("#focus-chart").scrollIntoViewIfNeeded();
  assert(await page.locator("#focus-chart").isVisible());
  await page.locator("#focus-zen").click();
  assert(await visible("#ambient"));
  assert.equal(await page.locator("#ambient").getAttribute("data-mode"), "zen");
  assert.equal(await page.locator("#ambient").evaluate(node => getComputedStyle(node).backgroundColor), "rgba(0, 0, 0, 0)");
  assert(await page.locator("#ambient-content").evaluate(node => node.classList.contains("glass")));
  await shot("zen.png");
  await page.keyboard.press("Escape");
  await page.locator("#focus-saver").click();
  assert.equal(await page.locator("#ambient").getAttribute("data-mode"), "saver");
  assert.notEqual(await page.locator("#ambient-clock").textContent(), "");
  assert.match(await page.locator("#zen-quote").textContent(), /Look away/);
  await shot("screen-saver.png");
  await page.waitForFunction(() => document.getElementById("zen-quote").textContent !== "Look away from the screen for a moment.", null, { timeout: 7000 });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Alt+1");
  const origin = await page.locator('.pane-tile[data-id="ides"]').boundingBox();
  const start = await page.evaluate(() => {
    document.querySelector('.pane-tile[data-id="ides"]').click();
    const rect = document.getElementById("popup").getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  assert(Math.abs((start.x + start.width / 2) - (origin.x + origin.width / 2)) < 3);
  assert(Math.abs((start.y + start.height / 2) - (origin.y + origin.height / 2)) < 3);
  await shot("pane.png");
  await page.keyboard.press("Shift+Tab");
  assert(await visible("#popup"));
  assert(await page.evaluate(() => document.getElementById("popup").contains(document.activeElement)));
  await page.keyboard.press("Escape"); await wait(380);
  assert(!(await visible("#popup-layer")));
  await page.locator("#settings-button").click();
  assert(await visible("#settings-surface"));
  await page.locator('.nav-item[data-id="behaviour"]').click();
  await shot("settings.png");
  for (const section of ["appearance", "layout", "rail", "screen-time", "focus", "panes", "about"]) {
    await page.locator(`.nav-item[data-id="${section}"]`).click();
    await shot(`settings-${section}.png`);
  }
  await page.locator('.nav-item[data-id="workspaces"]').click();
  await shot("settings-workspaces.png");
  await page.getByRole("textbox", { name: "New workspace name" }).fill("Projects");
  await page.getByRole("button", { name: "Add screen", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll(".workspace-controls .row").length === 3);
  await page.keyboard.press("Alt+1");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  assert.equal(await page.locator("#workspace-title").textContent(), "Projects");
  await shot("empty-home-screen.png");
  await page.locator(".workspace-empty button").click();
  await page.locator("#workspace-app-search").fill("Visual Studio Code");
  await shot("workspace-picker.png");
  await page.keyboard.press("Tab");
  assert(await visible("#item-picker"));
  assert.equal(await page.evaluate(() => document.activeElement?.className), "workspace-app-choice");
  await page.getByRole("button", { name: "Add Visual Studio Code" }).click();
  await page.getByRole("button", { name: "Already in this space: Visual Studio Code" }).waitFor();
  assert(await page.getByRole("button", { name: "Already in this space: Visual Studio Code" }).isDisabled());
  await page.locator("#workspace-browse-folder").click();
  await page.waitForFunction(() => document.querySelectorAll("#workspace-items .app-list-item").length === 2);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+b");
  assert.equal(await page.locator("body").getAttribute("data-compact-bar"), "true");
  assert(!(await visible("#page-edges")));
  assert.equal(await page.locator("#rail .dock-expand").count(), 1);
  await shot("compact-taskbar.png");
  await page.reload(); await page.waitForSelector("#grid .tile"); await wait(1400);
  await page.keyboard.press("Alt+1");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  assert.equal(await page.locator("#workspace-title").textContent(), "Projects");
  assert.equal(await page.locator("#workspace-items .app-list-item").count(), 2);
  assert.equal(await page.locator("body").getAttribute("data-compact-bar"), "true");
  await page.keyboard.press("Alt+1");
  await page.locator("#rail .dock-item.running").first().focus();
  await page.waitForFunction(() => !document.getElementById("preview").hidden);
  await wait(40);
  const timing = await page.locator("#preview").evaluate((node) => ({ cached: node.dataset.cached === "true", milliseconds: Number(node.dataset.latencyMs) }));
  assert(timing?.cached && timing.milliseconds < 50, JSON.stringify(timing));
  await shot("taskbar-preview.png");
  await page.locator("#search").hover(); await wait(300);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator(".pane-tile").first().click();
  assert.equal(await page.locator("#popup").evaluate((node) => getComputedStyle(node).transitionDuration), "0s");
  await page.keyboard.press("Escape"); await wait(30);
  await page.setViewportSize({ width: 800, height: 600 });
  await page.keyboard.press("Alt+5");
  const bounds = await page.locator("#settings-surface").boundingBox();
  assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 800 && bounds.y + bounds.height <= 600);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+b");
  for (const width of [1024,800,600]) {
    await page.setViewportSize({width,height:600});
    const geometry = await page.evaluate(()=>{
      const prev=document.getElementById('page-prev').getBoundingClientRect(), next=document.getElementById('page-next').getBoundingClientRect(), search=document.getElementById('search-wrap').getBoundingClientRect(), left=document.getElementById('header-left').getBoundingClientRect(), right=document.getElementById('header-right').getBoundingClientRect();
      const overlaps=(a,b)=>a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top;
      return {inBounds:prev.left>=0&&next.right<=innerWidth&&left.left>=0&&right.right<=innerWidth,overlaps:overlaps(prev,search)||overlaps(next,search)||overlaps(left,search)||overlaps(right,search)};
    });
    assert(geometry.inBounds && !geometry.overlaps, JSON.stringify({width,...geometry}));
  }
  assert.deepEqual(errors, []);
  const result = { ui: "passed", cachedPreviewMs: timing.milliseconds, screenshots: screenshotCount, viewport: "1280x800, 1024x600, 800x600, 600x600", errors };
  writeFileSync(new URL("../ui-verification.local.json", import.meta.url), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
