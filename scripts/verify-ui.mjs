// Run against Vite. All OS calls use demo fixtures in a fresh browser context; no real user data.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.OPALINE_PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true, executablePath: process.env.OPALINE_BROWSER_PATH || chromium.executablePath() });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const verifyUrl = process.env.OPALINE_VERIFY_URL || "http://127.0.0.1:1420";
const errors = [];
page.on("pageerror", (error) => { errors.push(error.stack || error.message); console.error("UI error:", error.stack || error.message); });
page.on("console", (message) => { if (message.type() === "error") console.error("Browser console:", message.text()); });
page.on("requestfailed", (request) => {
  // A Settings preview replaced while its icons are still loading aborts those loads; that is expected.
  if (request.failure()?.errorText === "net::ERR_ABORTED" && request.frame() !== page.mainFrame()) return;
  console.error("Request failed:", request.url(), request.failure()?.errorText);
});
const output = new URL("../docs/images/", import.meta.url);
mkdirSync(output, { recursive: true });

const iconManifest = JSON.parse(readFileSync(new URL("../docs/demo-icons/manifest.json", import.meta.url), "utf8"));
assert.equal(JSON.parse(readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8")).app.windows[0].zoomHotkeysEnabled, true);
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
      case "status": return { hotkeyOk: true, hotkey: "Ctrl+Alt+Space", version: "0.2.2", codename: "Borosilicate", pinned: true };
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
await page.route(/\/src\/app\/launcher\.ts(?:\?.*)?$/, async (route) => {
  const response = await route.fetch();
  await route.fulfill({ response, body: `const { mockIPC } = await import('/node_modules/@tauri-apps/api/mocks.js'); mockIPC(window.__demoInvoke, { shouldMockEvents: true });\n${await response.text()}` });
});
const wait = (milliseconds) => page.waitForTimeout(milliseconds);
const visible = (selector) => page.locator(selector).isVisible();
// The wheel recogniser cancels a gesture preview after 120 ms without input, which a Playwright round trip (or one
// slow frame) can outlast. Stream a few small events the way a trackpad does and sample the preview in the page,
// on the first frame that shows it. `maxEvents` keeps the total below the commit threshold so nothing navigates.
const wheelPreview = (selector, { maxEvents, ...eventInit }) => page.evaluate(([target, count, init]) => new Promise((resolve, reject) => {
  const surface = document.querySelector(target);
  let sent = 0;
  const send = () => { if (sent < count) { sent++; surface.dispatchEvent(new WheelEvent("wheel", { ...init, deltaMode: 0, bubbles: true, cancelable: true })); } };
  const feed = setInterval(send, 16);
  send();
  const started = performance.now();
  const sample = () => {
    const cue = document.getElementById("gesture-cue");
    if (surface.querySelector(":scope > .home-motion")?.getAttribute("data-gesture-preview") === "true") {
      clearInterval(feed);
      resolve({ cueVisible: !cue.hidden && cue.getClientRects().length > 0, cueText: cue.textContent, transform: getComputedStyle(surface).transform });
      return;
    }
    if (performance.now() - started > 2000) { clearInterval(feed); reject(new Error("The gesture preview never appeared.")); return; }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}), [selector, maxEvents, eventInit]);
const homeNamed = (name) => page.waitForFunction(expected => {
  const surface = document.getElementById("workspace-surface");
  return !surface.hidden && document.getElementById("workspace-title").textContent === expected;
}, name);
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
  await page.goto(verifyUrl);
  await page.waitForSelector("#grid .tile"); await wait(1000);
  assert(await visible("#apps-surface"));
  assert.equal(await page.evaluate(() => document.activeElement?.id), "shell");
  await page.keyboard.press("s");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "search");
  assert.equal(await page.locator("#search").inputValue(), "s");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Alt+2");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "shell");
  await page.keyboard.press("Alt+1");
  await page.keyboard.press("a");
  assert.equal(await page.evaluate(() => document.activeElement?.id), "search");
  assert.equal(await page.locator("#search").inputValue(), "a");
  await page.keyboard.press("Escape");
  assert(await page.locator("#search").evaluate(node => !node.dispatchEvent(new WheelEvent("wheel", { ctrlKey: true, deltaY: 40, bubbles: true, cancelable: true }))));
  assert.equal(await page.locator("#page-edges .edge-arrow").count(), 2);
  assert.equal(await page.locator(".home-footer .home-page-button").count(), 3);
  assert.equal(await page.locator("#home-add-trigger").count(), 0);
  assert(!(await visible("#status")));
  assert.equal(await page.locator("#page-nav, #quit-button").count(), 0);
  assert.equal(await page.locator("#top .header-nav .orb").count(), 4);
  assert(await page.evaluate(() => {
    const search = getComputedStyle(document.getElementById("search-wrap"));
    const left = getComputedStyle(document.getElementById("header-left"));
    const button = getComputedStyle(document.querySelector("#header-left .orb"));
    return left.backgroundImage === search.backgroundImage && left.height === search.height && button.backgroundColor === "rgba(0, 0, 0, 0)";
  }));
  await page.locator('#header-left [data-page="all-apps"]').click(); assert(await visible("#app-list-surface"));
  assert(!(await visible("#page-edges")));
  await page.locator("#app-list-surface").dispatchEvent("wheel", { deltaX: 120, deltaY: 0, deltaMode: 0 });
  assert(await visible("#app-list-surface"));
  assert(!(await visible("#gesture-cue")));
  await shot("all-apps.png");
  await page.locator('#header-left [data-page="screen-time"]').click(); assert(await visible("#screen-time-surface"));
  await page.locator('#header-right [data-page="focus"]').click(); assert(await visible("#focus-surface"));
  await page.locator("#home-dock").click(); assert(await visible("#apps-surface"));
  await page.keyboard.press("Tab"); assert(await visible("#workspace-surface"));
  await page.keyboard.press("Tab"); assert.equal(await page.locator("#workspace-title").textContent(), "Screen 3");
  assert(await visible("#page-edges"));
  assert(!(await visible("#workspace-add-trigger")));
  await shot("screen-3.png");
  await page.locator("#workspace-surface").dispatchEvent("wheel", { deltaX: 120, deltaY: 0, deltaMode: 0 });
  await page.locator("#apps-surface").waitFor({ state: "visible" });
  await wait(400);
  await page.locator("#apps-surface").dispatchEvent("wheel", { deltaX: -120, deltaY: 0, deltaMode: 0 });
  await homeNamed("Screen 3");
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
  await page.locator("#apps-surface").dispatchEvent("wheel", {deltaX: 45, deltaY: 2, deltaMode: 0});
  await homeNamed("Dev tools");
  assert.equal(await page.locator("html").getAttribute("data-gesture-direction"), "next");
  assert(await page.evaluate(() => document.body.classList.contains("home-gesture-transitioning")));
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement, "::view-transition-new(launcher-page)").animationTimingFunction), "cubic-bezier(0.16, 1, 0.3, 1)");
  assert(await visible("#workspace-surface"));
  assert.equal(await page.locator("#workspace-title").textContent(), "Dev tools");
  await page.waitForFunction(() => !document.body.classList.contains("gesture-transitioning"));
  await page.locator("#workspace-items").dispatchEvent("wheel", { deltaX: 45, deltaY: 0, deltaMode: 0 });
  await homeNamed("Screen 3");
  await page.keyboard.press("Alt+1");
  await wait(600);
  // One forceful physical swipe may emit a long inertial tail across the view transition.
  // Every tail event must be consumed without producing a second Home navigation.
  await page.locator("#apps-surface").dispatchEvent("wheel", { deltaX: 120, deltaY: 1, deltaMode: 0 });
  await homeNamed("Dev tools");
  for (const deltaX of [96, 78, 61, 46]) {
    await wait(20);
    await page.locator("#workspace-surface").dispatchEvent("wheel", { deltaX, deltaY: 1, deltaMode: 0 });
  }
  await page.waitForFunction(() => !document.body.classList.contains("gesture-transitioning"));
  for (const deltaX of [36, 27, 18, 12]) {
    await wait(24);
    await page.locator("#workspace-surface").dispatchEvent("wheel", { deltaX, deltaY: 1, deltaMode: 0 });
  }
  await wait(240);
  assert.equal(await page.locator("#workspace-title").textContent(), "Dev tools");
  await wait(190);
  await page.locator("#workspace-surface").dispatchEvent("wheel", { deltaX: 90, deltaY: 0, deltaMode: 0 });
  await homeNamed("Screen 3");
  await page.keyboard.press("Alt+1");
  await wait(600);
  const swipePreview = await wheelPreview("#apps-surface", { deltaX: 5, deltaY: 0, maxEvents: 7 }); // at most 35 of the 42 px threshold
  assert(swipePreview.cueVisible);
  assert.equal(swipePreview.transform, "none");
  await wait(400);
  assert(await visible("#apps-surface"));
  await touchSwipe(-60);
  await homeNamed("Dev tools");
  assert.equal(await page.locator("#workspace-title").textContent(), "Dev tools");
  const launchesBeforeTouchRelease = await page.evaluate(() => window.__demoCalls.filter(command => command === "launch").length);
  await page.locator("#workspace-items .app-list-item").first().evaluate(node => node.dispatchEvent(new PointerEvent("click", { pointerType: "touch", bubbles: true, cancelable: true })));
  assert.equal(await page.evaluate(() => window.__demoCalls.filter(command => command === "launch").length), launchesBeforeTouchRelease);
  await wait(350);
  await page.locator("#workspace-surface").dispatchEvent("wheel", { ctrlKey: true, deltaY: -60, deltaMode: 0 });
  await page.locator("#app-list-surface").waitFor({ state: "visible" });
  await page.keyboard.press("Alt+1");
  await wait(600);
  await touchSwipe(115);
  await homeNamed("Screen 3");
  assert.equal(await page.locator("#workspace-title").textContent(), "Screen 3");
  await page.keyboard.press("Alt+1");
  await wait(600);
  await touchPinch(720);
  await page.locator("#app-list-surface").waitFor({ state: "visible" });
  assert(await visible("#app-list-surface"));
  await page.keyboard.press("Alt+1");
  await wait(600);
  await touchPinch(560);
  await page.locator("#settings-surface").waitFor({ state: "visible" });
  assert(await visible("#settings-surface"));
  await page.waitForFunction(() => !document.body.classList.contains("gesture-transitioning"));
  await page.locator("#settings-surface").dispatchEvent("wheel", { ctrlKey: true, deltaY: -60, deltaMode: 0 });
  await page.locator("#apps-surface").waitFor({ state: "visible" });
  assert(await visible("#apps-surface"));
  await page.keyboard.press("Alt+1");
  await wait(600);
  const pinchPreview = await wheelPreview("#apps-surface", { ctrlKey: true, deltaX: 0, deltaY: 5, maxEvents: 8 }); // at most 40 of the 56 px threshold
  assert(pinchPreview.cueVisible);
  assert.equal(pinchPreview.cueText, "Settings");
  assert.equal(pinchPreview.transform, "none");
  await page.locator("#apps-surface").dispatchEvent("wheel", {ctrlKey: true, deltaX: 0, deltaY: 60, deltaMode: 0});
  await page.locator("#settings-surface").waitFor({ state: "visible" });
  assert(await visible("#settings-surface"));
  await page.keyboard.press("Alt+1");
  await wait(600);
  await page.locator("#apps-surface").dispatchEvent("wheel", {ctrlKey: true, deltaX: 0, deltaY: -60, deltaMode: 0});
  await page.locator("#app-list-surface").waitFor({ state: "visible" });
  assert(await visible("#app-list-surface"));
  await page.keyboard.press("Alt+1");
  await wait(600);
  await page.locator("#apps-surface").dispatchEvent("wheel", {ctrlKey: true, deltaX: 0, deltaY: -20, deltaMode: 0});
  await page.waitForSelector("#gesture-cue:visible");
  assert(await visible("#gesture-cue"));
  await wait(450);
  assert(!(await visible("#gesture-cue")));
  assert(!(await page.locator("#apps-surface").getAttribute("data-gesture-preview")));
  assert(await visible("#apps-surface"));
  await page.locator("#apps-surface").evaluate(node => {
    const touch = (type, id, x) => node.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: x, clientY: 400, bubbles: true, cancelable: true }));
    touch("pointerdown", 1, 480); touch("pointerdown", 2, 600);
    touch("pointermove", 1, 470); touch("pointermove", 2, 610);
  });
  await page.waitForSelector("#gesture-cue:visible");
  await page.locator("#apps-surface").evaluate(node => node.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, pointerType: "touch", clientX: 470, clientY: 400, bubbles: true })));
  await page.locator("#gesture-cue").waitFor({ state: "hidden" });
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
  await page.waitForFunction(() => {
    const bars = document.querySelector("#usage-chart .chart-bars");
    return bars && getComputedStyle(bars).columnGap === "3px";
  });
  await shot("screen-time-chart.png");
  await page.keyboard.press("Control+Alt+f");
  assert(await visible("#focus-surface"));
  await page.locator("#focus-intention").fill("Finish the release notes");
  assert.equal(await page.locator("#focus-title").textContent(), "Finish the release notes");
  await page.locator("#focus-start").click();
  assert.equal(await page.locator("#focus-start").textContent(), "Pause");
  await wait(250);
  assert.notEqual(await page.locator("#focus-start").evaluate(node => getComputedStyle(node).backgroundColor), "rgba(0, 0, 0, 0)");
  await page.keyboard.press("Space");
  assert.equal(await page.locator("#focus-start").textContent(), "Resume");
  await page.keyboard.press("Space");
  assert.equal(await page.locator("#focus-start").textContent(), "Pause");
  assert(await visible("#focus-capsule"));
  await shot("focus.png");
  // Space belongs to a focused button; the page-level timer shortcut must not swallow it.
  await page.locator("#focus-reset").focus();
  await page.keyboard.press("Space");
  assert.equal(await page.locator("#focus-start").textContent(), "Start");
  assert.match(await page.locator("#focus-note").textContent(), /Session reset/);
  await page.locator("#focus-start").click();
  await page.locator("#focus-advance").focus();
  await page.keyboard.press("Space");
  assert.match(await page.locator("#focus-note").textContent(), /Finish this session now/);
  assert.equal(await page.locator("#focus-start").textContent(), "Pause");
  await page.locator('[data-focus-preset="50"]').focus();
  await page.keyboard.press("Space");
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("opaline.settings"))).focusMinutes, 50);
  await page.locator('[data-focus-preset="25"]').focus();
  await page.keyboard.press("Space");
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("opaline.settings"))).focusMinutes, 25);
  assert((await page.locator("#focus-chart .chart-bars").boundingBox()).width < 260);
  await page.locator("#focus-chart").scrollIntoViewIfNeeded();
  assert(await page.locator("#focus-chart").isVisible());
  await page.locator(".focus-preferences summary").click();
  await page.locator("#focus-short-break").fill("7");
  await page.locator("#focus-short-break").press("Enter");
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("opaline.settings"))).shortBreakMinutes, 7);
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
  const firstMember = page.locator("#popup .pane-grid .tile").nth(0);
  const secondMember = page.locator("#popup .pane-grid .tile").nth(1);
  const firstBox = await firstMember.boundingBox(), secondBox = await secondMember.boundingBox();
  assert(firstBox && secondBox);
  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(secondBox.x + secondBox.width / 2 + 8, secondBox.y + secondBox.height / 2, { steps: 3 });
  await page.mouse.move(firstBox.x + 2, firstBox.y + firstBox.height / 2, { steps: 8 });
  await wait(120);
  assert.equal(await page.locator("#popup .insert-before, #popup .insert-after").count(), 1);
  assert.equal(await page.locator("#popup .pane-grid .tile").first().getAttribute("data-path"), "demo:0");
  await page.mouse.up(); await wait(380);
  assert.equal(await page.locator("#popup .pane-grid .tile").first().getAttribute("data-path"), "demo:20");
  assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem("demo:groups.json"))).groups.find(group => group.id === "ides").items, ["demo:20", "demo:0"]);
  await page.keyboard.press("Shift+Tab");
  assert(await visible("#popup"));
  assert(await page.evaluate(() => document.getElementById("popup").contains(document.activeElement)));
  await page.keyboard.press("Escape"); await wait(380);
  assert(!(await visible("#popup-layer")));
  await page.locator("#settings-button").click();
  assert(await visible("#settings-surface"));
  await page.locator('.nav-item[data-id="behaviour"]').click();
  await shot("settings.png");
  for (const section of ["appearance", "home-layout", "navigation", "rail", "screen-time", "panes", "about"]) {
    await page.locator(`.nav-item[data-id="${section}"]`).click();
    await shot(`settings-${section}.png`);
    const expectsHomePreview = ["appearance", "home-layout", "navigation", "rail"].includes(section);
    assert.equal(await page.locator(".settings-live-simulation").count(), expectsHomePreview ? 1 : 0);
    if (section === "panes") assert.equal(await page.locator("#pane-motion-preview").count(), 1);
  }
  await page.locator('.nav-item[data-id="appearance"]').click();
  assert.equal(await page.locator(".appearance-preset-grid").first().locator(".appearance-preset").count(), 6);
  await page.waitForFunction(() => [...document.querySelectorAll(".appearance-preview iframe")].every(frame => frame.contentDocument?.querySelector("#grid .tile")));
  const materialPreviews = await page.locator(".appearance-preset-grid").first().locator(".appearance-preview").evaluateAll(nodes => nodes.map(node => { const root = node.querySelector("iframe")?.contentDocument?.documentElement; return { profile: node.dataset.profile, radius: root?.style.getPropertyValue("--radius"), fill: root?.style.getPropertyValue("--custom-rgb"), opacity: root?.style.getPropertyValue("--custom-opacity"), blur: root?.style.getPropertyValue("--pane-blur"), ghost: getComputedStyle(node, "::after").content }; }));
  assert.equal(new Set(materialPreviews.map(preview => JSON.stringify(preview))).size, 6);
  assert(materialPreviews.every(preview => preview.ghost === "none"));
  assert.equal(await page.locator(".appearance-preview svg").count(), 0);
  assert(await page.locator(".appearance-preview iframe").first().evaluate(frame => frame.contentDocument.querySelectorAll("#grid .tile").length >= 8));
  assert.equal(await page.locator(".appearance-preview iframe").first().evaluate(frame => frame.contentDocument.querySelector("#grid .label")?.textContent), await page.locator("#grid .label").first().textContent());
  // Staging runs on every slider tick: the live preview must update in place, never reload its document.
  const sliderTick = await page.evaluate(async () => {
    const live = document.querySelector("#settings-live-preview iframe");
    let rewrites = 0;
    // Two narrow observers: any srcdoc write anywhere in Settings, and any rebuild (child swap) of the live preview host.
    const watcher = new MutationObserver(records => { rewrites += records.length; });
    watcher.observe(document.getElementById("settings"), { subtree: true, attributes: true, attributeFilter: ["srcdoc"] });
    watcher.observe(document.getElementById("settings-live-preview"), { childList: true });
    const slider = document.querySelector('.settings-body input[type="range"]');
    const original = slider.value;
    const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    slider.value = String(Number(original) + 3); slider.dispatchEvent(new Event("input", { bubbles: true })); await nextFrame();
    const updated = live.contentDocument.documentElement.style.getPropertyValue("--bd-blur");
    slider.value = original; slider.dispatchEvent(new Event("input", { bubbles: true })); await nextFrame();
    watcher.disconnect();
    return { rewrites, sameFrame: document.querySelector("#settings-live-preview iframe") === live, updated, original };
  });
  assert.equal(sliderTick.rewrites, 0);
  assert(sliderTick.sameFrame);
  assert.equal(sliderTick.updated, `${Number(sliderTick.original) + 3}px`);
  await page.locator(".preset-name").fill("Workspace Glass");
  await page.getByRole("button", { name: "Save current", exact: true }).click();
  await page.getByRole("button", { name: /^Workspace Glass/ }).waitFor();
  assert.match(await page.getByRole("button", { name: /^Workspace Glass/ }).textContent(), /Rail (on|off).*panel.*(header|taskbar|tray)/s);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("opaline.appearance.profiles")))[0].name, "Workspace Glass");
  await page.locator('.preset-transfer input[type="file"]').setInputFiles({
    name: "opaline-visual-presets.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ schema: "opaline-visual-presets", version: 1, presets: [{ id: "portable", name: "Portable Glass", createdAt: new Date(0).toISOString(), settings: { backdropBlur: 12, tintColor: "#182238", tintStrength: .18, rail: false, surfaceWidth: 840 } }] })),
  });
  await page.getByRole("button", { name: /^Portable Glass/ }).waitFor();
  assert(await page.getByRole("button", { name: "Export presets", exact: true }).isEnabled());
  await page.getByRole("button", { name: /^Portable Glass/ }).scrollIntoViewIfNeeded();
  await shot("settings-appearance-presets.png");
  await page.getByRole("button", { name: /^Windows Mica/ }).click();
  assert.equal(await page.locator("body").getAttribute("data-style"), "frost");
  assert.equal(await page.locator(".settings-live-simulation").getAttribute("data-profile"), "mica");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(await page.locator("body").getAttribute("data-style"), "custom");
  assert.equal(await page.locator("body").getAttribute("data-material"), "mica");
  assert.equal(await page.locator("html").evaluate(node => node.style.getPropertyValue("--radius")), "12px");
  assert.equal(await page.locator("html").evaluate(node => node.style.getPropertyValue("--custom-opacity")), "0.9");
  await shot("settings-windows-mica.png");
  await page.getByRole("button", { name: /^Opaline Original/ }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(await page.locator("body").getAttribute("data-style"), "frost");
  await page.locator('.nav-item[data-id="navigation"]').click();
  assert.equal(await page.locator(".navigation-preview svg").count(), 0);
  assert(await page.locator(".navigation-preview iframe").first().evaluate(frame => frame.contentDocument.querySelectorAll("#grid .tile").length >= 8));
  await page.getByRole("button", { name: /Navigation taskbar/ }).click();
  assert.equal(await page.locator("body").getAttribute("data-navigation"), "split");
  assert.equal(await page.getByRole("button", { name: /Navigation taskbar/ }).getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator(".settings-live-simulation").getAttribute("data-navigation"), "taskbar");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(await page.locator("body").getAttribute("data-navigation"), "taskbar");
  assert.equal(await page.locator("#navigation-dock").count(), 1);
  await page.getByRole("switch", { name: "Show Focus" }).click();
  assert.equal(await page.locator("body").getAttribute("data-shortcut-focus"), "true");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(await page.locator("body").getAttribute("data-shortcut-focus"), "false");
  assert.equal(await page.locator("body").getAttribute("data-navigation-overflow"), "true");
  await page.getByRole("button", { name: /Dropdown tray/ }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(await page.locator("body").getAttribute("data-navigation"), "tray");
  await page.keyboard.press("Alt+1");
  assert(!(await visible("#navigation-dock")));
  await page.locator("#navigation-overflow summary").click();
  const trayBox = await page.locator(".navigation-tray").boundingBox();
  const trayTriggerBox = await page.locator("#navigation-overflow summary").boundingBox();
  assert(trayBox && trayTriggerBox && trayBox.y >= 0 && trayBox.y + trayBox.height < trayTriggerBox.y, JSON.stringify({ trayBox, trayTriggerBox }));
  const searchBox = await page.locator("#search-wrap").boundingBox();
  assert(searchBox && Math.abs(searchBox.x + searchBox.width / 2 - 640) < 2, JSON.stringify(searchBox));
  await shot("settings-navigation-variants.png");
  await page.keyboard.press("Alt+5");
  await page.getByRole("button", { name: /Split header/ }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal(await page.locator("body").getAttribute("data-navigation"), "tray");
  await page.getByRole("button", { name: /Split header/ }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  // A change made outside Settings (Ctrl+B) while an edit is staged must survive Done.
  await page.getByRole("switch", { name: "Show Screen time" }).click();
  await page.keyboard.press("Control+b");
  assert.equal(await page.locator("body").getAttribute("data-compact-bar"), "true");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(await page.locator("body").getAttribute("data-shortcut-screen-time"), "false");
  assert.equal(await page.locator("body").getAttribute("data-compact-bar"), "true");
  await page.keyboard.press("Control+b");
  assert.equal(await page.locator("body").getAttribute("data-compact-bar"), "false");
  await page.getByRole("switch", { name: "Show Screen time" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(await page.locator("body").getAttribute("data-shortcut-screen-time"), "true");
  await page.locator('.nav-item[data-id="home-layout"]').click();
  await page.getByRole("button", { name: "A–Z" }).click(); await wait(380);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("demo:groups.json"))).layout["group:agents"].x, 0);
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
  assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 800 && bounds.y + bounds.height <= 600, JSON.stringify(bounds));
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
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("opaline.settings") || "{}");
    localStorage.setItem("opaline.settings", JSON.stringify({ ...saved, defaultPage: "all-apps" }));
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload();
  await page.waitForSelector("#app-list-surface:visible");
  assert.equal(await page.locator("body").getAttribute("data-page"), "all-apps");
  await page.waitForFunction(() => document.activeElement?.id === "search");
  assert.deepEqual(errors, []);
  const result = { ui: "passed", cachedPreviewMs: timing.milliseconds, screenshots: screenshotCount, viewport: "1280x800, 1024x600, 800x600, 600x600", errors };
  writeFileSync(new URL("../ui-verification.local.json", import.meta.url), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
