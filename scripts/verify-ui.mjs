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
    "workspaces.json": [{ id: "dev-tools", name: "Dev tools", items: items.slice(0, 4) }, { id: "extra-screen", name: "Screen 3", items: [] }],
  };
  for (const [key, value] of Object.entries(initial)) if (localStorage.getItem(`demo:${key}`) === null) localStorage.setItem(`demo:${key}`, JSON.stringify(value));
  window.__demoCalls = [];
  window.__demoFailSave = false;
  window.__demoInvoke = async (command, args) => {
    window.__demoCalls.push(command);
    switch (command) {
      case "status": return { hotkeyOk: true, hotkey: "Ctrl+Alt+Space", version: "0.3.0", codename: "Crown", pinned: true };
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
// The recogniser paints a preview on its second animation frame and cancels it 120 ms after the last wheel event. Headless
// Chrome software-renders the backdrop blur, so a frame can take 60 ms or more and a short burst of events ends before the
// preview is painted. Keep feeding 1 px events, as a trackpad does, and sample the preview in the page on the first frame that
// shows it. `maxEvents` keeps the total below the commit threshold (56 px pinch, 42 px swipe) so nothing navigates.
const wheelPreviewOnce = (selector, { maxEvents, ...eventInit }) => page.evaluate(([target, count, init]) => new Promise((resolve, reject) => {
  const surface = document.querySelector(target);
  let sent = 0;
  const send = () => { if (sent < count) { sent++; surface.dispatchEvent(new WheelEvent("wheel", { ...init, deltaMode: 0, bubbles: true, cancelable: true })); } };
  const feed = setInterval(send, 16);
  send();
  const started = performance.now();
  let frames = 0;
  const sample = () => {
    frames++;
    const cue = document.getElementById("gesture-cue");
    // A swipe moves the Home content inside the panel; a pinch (ctrl + wheel) zooms the whole panel.
    const mover = init.ctrlKey ? surface : surface.querySelector(":scope > .home-motion");
    if (mover?.getAttribute("data-gesture-preview") === "true") {
      clearInterval(feed);
      resolve({ cueVisible: !cue.hidden && cue.getClientRects().length > 0, cueText: cue.textContent, cueKicker: cue.dataset.kicker, cueArrow: Boolean(cue.querySelector(".cue-arrow svg")), cueGlass: getComputedStyle(cue).backdropFilter !== "none", transform: getComputedStyle(surface).transform, moverTransform: getComputedStyle(mover).transform });
      return;
    }
    if (performance.now() - started > 2000) {
      clearInterval(feed);
      const state = { framesSampledIn2s: frames, eventsSent: sent, bodyClasses: document.body.className, page: document.body.dataset.page, transitionDirection: document.documentElement.dataset.gestureDirection ?? null, surfaceHidden: surface.hidden, previewAttribute: surface.querySelector(":scope > .home-motion")?.getAttribute("data-gesture-preview") ?? null, cueHidden: cue.hidden, popupOpen: document.body.classList.contains("popup-open"), pickerHidden: document.getElementById("item-picker").hidden, activeElement: document.activeElement?.id || document.activeElement?.tagName };
      reject(new Error(`The gesture preview never appeared. State: ${JSON.stringify(state)}`));
      return;
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}), [selector, maxEvents, eventInit]);
// After a committed gesture the recogniser has occasionally ignored the next one for over a second in headless Chrome, then
// recovered after a quiet period (root cause not found; see WORKORDER W-51). Retry after silence, as a user lifting their fingers
// would, and warn on every retry so intermittent behaviour stays visible instead of being hidden.
async function wheelPreview(selector, options) {
  for (let attempt = 1; ; attempt++) {
    try { return await wheelPreviewOnce(selector, options); }
    catch (error) {
      if (attempt === 3) throw error;
      console.warn(`Gesture preview attempt ${attempt} failed (${String(error.message).split(" State:")[0]}); retrying after a quiet period.`);
      await wait(1500);
    }
  }
}
const boxOf = (id) => page.evaluate((target) => { const box = document.getElementById(target).getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; }, id);
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
  // Keyboard hints sit in the panel corner on pages steered with the keys.
  assert(await visible("#apps-surface .key-hints"));
  assert.equal(await page.locator("#apps-surface .key-hints kbd").count(), 6);
  // Desktop, the two custom screens and the trailing plus that adds another.
  // Only the Sidebar arrangement shows the sidebar; in every other it must neither show nor take layout space.
  assert(!(await visible("#navigation-sidebar")));
  assert.equal(await page.locator("#navigation-sidebar").evaluate(node => getComputedStyle(node).display), "none");
  assert.equal(await page.locator(".home-footer .home-page-button").count(), 4);
  assert.equal(await page.locator(".home-footer .home-page-button.add").count(), 1);
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
  // Swiping on from the last screen reaches the trailing new-screen page, then wraps to Desktop; and back the same way.
  await page.locator("#workspace-surface").dispatchEvent("wheel", { deltaX: 120, deltaY: 0, deltaMode: 0 });
  await homeNamed("New screen");
  await wait(700);
  await page.locator("#workspace-surface").dispatchEvent("wheel", { deltaX: 120, deltaY: 0, deltaMode: 0 });
  await page.locator("#apps-surface").waitFor({ state: "visible" });
  await wait(700); // the outgoing ghost shares the page ids until its animation ends
  await page.locator("#apps-surface").dispatchEvent("wheel", { deltaX: -120, deltaY: 0, deltaMode: 0 });
  await homeNamed("New screen");
  await wait(700);
  await page.locator("#workspace-surface").dispatchEvent("wheel", { deltaX: -120, deltaY: 0, deltaMode: 0 });
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
  assert(await visible("#workspace-surface"));
  assert.equal(await page.locator("#workspace-title").textContent(), "Dev tools");
  await page.waitForFunction(() => !document.body.classList.contains("gesture-transitioning"));
  // Once the motion ends nothing is left behind: no ghost copy of the old page and no running gesture animation.
  assert.equal(await page.locator("[data-gesture-ghost]").count(), 0);
  assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.id.startsWith("gesture-")).length), 0);
  await page.locator("#workspace-items").dispatchEvent("wheel", { deltaX: 45, deltaY: 0, deltaMode: 0 });
  await homeNamed("Screen 3");
  await page.keyboard.press("Alt+1");
  await wait(600);
  // The page changes at once; the old page carries on as a ghost while the new one arrives, both on live elements.
  const swipeCommit = await page.evaluate(() => {
    document.querySelector("#apps-surface").dispatchEvent(new WheelEvent("wheel", { deltaX: 120, deltaY: 1, deltaMode: 0, bubbles: true, cancelable: true }));
    return {
      title: document.getElementById("workspace-title").textContent,
      transitioning: document.body.classList.contains("gesture-transitioning"),
      animations: document.getAnimations().map(animation => animation.id).filter(id => id.startsWith("gesture-")).sort(),
      ghosts: document.querySelectorAll("[data-gesture-ghost]").length,
    };
  });
  assert.equal(swipeCommit.title, "Dev tools");
  assert(swipeCommit.transitioning);
  assert.deepEqual(swipeCommit.animations, ["gesture-in", "gesture-out"]);
  assert.equal(swipeCommit.ghosts, 1);
  // One forceful physical swipe emits a long inertial tail that streams continuously across the motion.
  // Every tail event must be consumed without producing a second Home navigation.
  for (const deltaX of [96, 78, 61, 46, 36, 27, 18, 12]) {
    await wait(22);
    await page.locator("#workspace-surface").dispatchEvent("wheel", { deltaX, deltaY: 1, deltaMode: 0 });
  }
  await wait(240);
  assert.equal(await page.locator("#workspace-title").textContent(), "Dev tools");
  await page.waitForFunction(() => !document.body.classList.contains("gesture-transitioning"));
  await wait(190);
  await page.locator("#workspace-surface").dispatchEvent("wheel", { deltaX: 90, deltaY: 0, deltaMode: 0 });
  await homeNamed("Screen 3");
  await page.keyboard.press("Alt+1");
  await wait(600);
  const swipePreview = await wheelPreview("#apps-surface", { deltaX: 1, deltaY: 0, maxEvents: 40 }); // at most 40 of the 42 px threshold
  assert(swipePreview.cueVisible);
  assert.equal(swipePreview.transform, "none"); // the glass panel stays put as the clipping frame
  assert.notEqual(swipePreview.moverTransform, "none"); // while the content inside it follows the swipe
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
  await touchSwipe(115); // the previous page from Desktop is the trailing new-screen page
  await homeNamed("New screen");
  await page.locator("#workspace-pages .home-page-button").nth(2).click();
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
  const pinchPreview = await wheelPreview("#apps-surface", { ctrlKey: true, deltaX: 0, deltaY: 1, maxEvents: 50 }); // at most 50 of the 56 px threshold
  assert(pinchPreview.cueVisible);
  assert.equal(pinchPreview.cueText, "Settings");
  // The cue is made of the panel glass, points the way, and names the move.
  assert(pinchPreview.cueArrow && pinchPreview.cueGlass);
  assert.equal(pinchPreview.cueKicker, "Previous page");
  assert.notEqual(pinchPreview.transform, "none"); // a pinch zooms the whole panel
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
  assert((await page.locator("#usage-chart .chart-bars").boundingBox()).width < 400); // a week stays compact; a month fills the page
  // The chart has a labelled value axis (the demo peak is 3 h 17 min, so it tops out at 4 h) and dated, weekday-labelled days.
  assert.deepEqual(await page.locator("#usage-chart .chart-axis span").allTextContents(), ["4h", "3h", "2h", "1h", "0"]);
  assert.equal(await page.locator("#usage-chart .chart-rules span").count(), 5);
  assert.equal(await page.locator("#usage-chart .chart-day-label small").count(), 7);
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
  assert(await page.locator("#focus-advance").isDisabled()); // a session that was never started has nothing to finish
  await page.locator("#focus-start").click();
  assert(await page.locator("#focus-advance").isEnabled());
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
  await page.locator("#focus-custom-minutes").focus();
  assert.equal(await page.locator("#focus-custom-minutes").evaluate(node => getComputedStyle(node).outlineStyle), "solid"); // keyboard focus must be visible
  assert((await page.locator("#focus-chart .chart-bars").boundingBox()).width < 400);
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
  // Settings opens as a panel like any other page; nothing is staged, so neither Cancel nor Done offers to do anything.
  assert.equal(await page.locator("body").getAttribute("data-settings-expanded"), "false");
  assert(await visible("#top") && await visible("#bottom-bar"), "the header and taskbar stay around a panel-sized Settings");
  assert((await boxOf("settings-surface")).width <= 962);
  assert(await page.locator("#settings-cancel").isDisabled() && await page.locator("#settings-done").isDisabled());
  await page.getByRole("switch", { name: "Close when you switch away" }).click();
  assert(await page.locator("#settings-cancel").isEnabled() && await page.locator("#settings-done").isEnabled());
  await page.locator("#settings-cancel").click();
  assert(await page.locator("#settings-cancel").isDisabled(), "Cancel greys out again once it has cancelled");
  assert.equal(await page.getByRole("switch", { name: "Close when you switch away" }).getAttribute("aria-checked"), "true");
  // The corner button opens Settings out to fill the window and back again.
  await page.locator("#settings-expand").click();
  assert.equal(await page.locator("body").getAttribute("data-settings-expanded"), "true");
  assert(!(await visible("#top")) && !(await visible("#bottom-bar")));
  assert((await boxOf("settings-surface")).width > 1200);
  await page.locator("#settings-expand").click();
  assert.equal(await page.locator("body").getAttribute("data-settings-expanded"), "false");
  assert(await visible("#top"));
  await shot("settings.png");
  // A failed save must be reported rather than silently lost, and the message clears once saving works again.
  await page.evaluate(() => {
    window.__realSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "opaline.settings") throw new DOMException("exceeded the quota", "QuotaExceededError");
      return window.__realSetItem.call(this, key, value);
    };
  });
  await page.getByRole("switch", { name: "Close when you switch away" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.match(await page.locator("#navigation-note").textContent(), /Settings could not be saved/);
  await page.evaluate(() => { Storage.prototype.setItem = window.__realSetItem; });
  await page.getByRole("switch", { name: "Close when you switch away" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(await page.locator("#navigation-note").textContent(), "");
  for (const section of ["appearance", "home", "navigation", "behaviour", "help", "about"]) {
    await page.locator(`.nav-item[data-id="${section}"]`).click();
    await shot(`settings-${section}.png`);
    const expectsHomePreview = ["appearance", "home", "navigation"].includes(section);
    assert.equal(await page.locator(".settings-live-simulation").count(), expectsHomePreview ? 1 : 0);
    if (section === "home") assert.equal(await page.locator(".pane-demo-inline #pane-motion-preview").count(), 1);
  }
  // Settings is six sections, not ten, grouped by headings rather than split into ever smaller pages.
  assert.deepEqual(await page.locator(".settings-nav .nav-item").allTextContents(), ["Appearance", "Home", "Navigation & taskbar", "Behaviour", "Shortcuts & help", "About"]);
  await page.locator('.nav-item[data-id="appearance"]').click();
  assert.equal(await page.locator(".appearance-preset-grid").first().locator(".appearance-preset").count(), 5);
  await page.waitForFunction(() => [...document.querySelectorAll(".appearance-preview iframe")].every(frame => frame.contentDocument?.querySelector("#grid .tile")));
  const materialPreviews = await page.locator(".appearance-preset-grid").first().locator(".appearance-preview").evaluateAll(nodes => nodes.map(node => { const root = node.querySelector("iframe")?.contentDocument?.documentElement; return { profile: node.dataset.profile, radius: root?.style.getPropertyValue("--radius"), fill: root?.style.getPropertyValue("--custom-rgb"), opacity: root?.style.getPropertyValue("--custom-opacity"), blur: root?.style.getPropertyValue("--pane-blur"), ghost: getComputedStyle(node, "::after").content }; }));
  assert.equal(new Set(materialPreviews.map(preview => JSON.stringify(preview))).size, 5);
  assert(materialPreviews.every(preview => preview.ghost === "none"));
  assert.equal(await page.locator(".appearance-preview svg").count(), 0);
  assert(await page.locator(".appearance-preview iframe").first().evaluate(frame => frame.contentDocument.querySelectorAll("#grid .tile").length >= 8));
  assert.equal(await page.locator(".appearance-preview iframe").first().evaluate(frame => frame.contentDocument.querySelector("#grid .label")?.textContent), await page.locator("#grid .label").first().textContent());
  // Staging runs on every slider tick: the live preview must update in place, never reload its document.
  // The live preview is its own document: let it finish loading before ticking, or the tick is (correctly) deferred to its load.
  await page.waitForFunction(() => { const frame = document.querySelector("#settings-live-preview iframe"); return frame?.contentDocument?.readyState === "complete" && !!frame.contentDocument.querySelector("#grid .tile"); });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
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
  // A light material must not leave light-on-light controls: the pager dots follow the text colour and the gesture cue is made of
  // the same glass as the panels, so both read on it. There is no built-in light preset, so a light custom material is staged
  // with the same controls a person would use, with Light bending on so the lens check below has something to measure.
  await page.getByRole("button", { name: /^Opaline Original/ }).click();
  await page.evaluate(() => {
    const set = (label, value) => { const input = document.querySelector(`.settings-body input[aria-label="${label}"]`); input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); };
    set("Panel surface colour", "#dce8f5"); set("Panel opacity", "0.56"); set("Light bending", "1");
  });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(await page.locator("body").getAttribute("data-surface-tone"), "light");
  const ink = await page.evaluate(() => {
    const luminance = (colour) => { const [r, g, b] = (colour.match(/-?[\d.]+/g) || []).slice(0, 3).map(Number); const scale = colour.startsWith("color(") ? 1 : 255; return (0.2126 * r + 0.7152 * g + 0.0722 * b) / scale; };
    const dot = getComputedStyle(document.querySelector(".home-page-button:not([aria-current='page'])")).backgroundColor;
    const cue = getComputedStyle(document.getElementById("gesture-cue")).backgroundColor;
    return { dot, dotLuminance: luminance(dot), cue, cueLuminance: luminance(cue) };
  });
  assert(ink.dotLuminance < 0.55, JSON.stringify(ink));
  assert(ink.cueLuminance > 0.6, JSON.stringify(ink));
  // Light bending bends light rather than only frosting it: the panels run a displacement filter (one per colour channel), and behind
  // a sharp grid that filter visibly moves the pixels in the panel's edge band. A material with it at 0% runs no filter at all.
  await page.keyboard.press("Alt+1");
  await page.waitForSelector("#apps-surface:visible");
  await wait(900);
  assert(await page.locator("#lens-defs filter").count() >= 3);
  assert.equal(await page.locator("#lens-defs filter").evaluateAll(nodes => Math.max(...nodes.map(node => node.querySelectorAll("feDisplacementMap").length))), 3);
  assert.match(await page.locator("#apps-surface").evaluate(node => node.style.backdropFilter), /url\(/);
  const original = await page.evaluate(() => {
    const image = document.getElementById("backdrop");
    const saved = { source: image.getAttribute("src"), blur: document.documentElement.style.getPropertyValue("--bd-blur") };
    let squares = "";
    for (let row = 0; row < 20; row++) for (let column = 0; column < 32; column++) if ((row + column) % 2 === 0) squares += `<rect x="${column * 40}" y="${row * 40}" width="40" height="40" fill="#0b1f4d"/>`;
    image.src = "data:image/svg+xml;base64," + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800"><rect width="1280" height="800" fill="#f2c94c"/>${squares}</svg>`);
    document.documentElement.style.setProperty("--bd-blur", "0px");
    return saved;
  });
  await wait(700);
  const corner = { x: 160, y: 106, width: 330, height: 200 };
  // The panel's own blur would smear the 40 px squares the lens is measured against, so it is taken out of both renders.
  const lensFilter = await page.locator("#apps-surface").evaluate(node => node.style.backdropFilter);
  const unblurred = lensFilter.replace(/blur\([^)]*\)/, "blur(0px)");
  await page.locator("#apps-surface").evaluate((node, value) => node.style.setProperty("backdrop-filter", value), unblurred);
  await wait(500);
  const bent = await page.screenshot({ clip: corner });
  await page.locator("#apps-surface").evaluate((node, value) => node.style.setProperty("backdrop-filter", value), unblurred.replace(/url\([^)]*\)/, ""));
  await wait(500);
  const flat = await page.screenshot({ clip: corner });
  await page.locator("#apps-surface").evaluate((node, value) => node.style.setProperty("backdrop-filter", value), lensFilter);
  const moved = await page.evaluate(async ([first, second]) => {
    const load = async (data) => { const bitmap = await createImageBitmap(await (await fetch("data:image/png;base64," + data)).blob()); const canvas = new OffscreenCanvas(bitmap.width, bitmap.height); const context = canvas.getContext("2d"); context.drawImage(bitmap, 0, 0); return context.getImageData(0, 0, bitmap.width, bitmap.height).data; };
    const [a, b] = await Promise.all([load(first), load(second)]);
    let changed = 0;
    for (let index = 0; index < a.length; index += 4) if (Math.abs(a[index] - b[index]) + Math.abs(a[index + 1] - b[index + 1]) + Math.abs(a[index + 2] - b[index + 2]) > 24) changed++;
    return changed;
  }, [bent.toString("base64"), flat.toString("base64")]);
  assert(moved > 2500, `the lens moved only ${moved} pixels of the edge band`);
  await page.evaluate(({ source, blur }) => {
    const image = document.getElementById("backdrop");
    if (source) image.setAttribute("src", source); else image.removeAttribute("src");
    if (blur) document.documentElement.style.setProperty("--bd-blur", blur); else document.documentElement.style.removeProperty("--bd-blur");
  }, original);
  await page.keyboard.press("Alt+5");
  await page.locator('.nav-item[data-id="appearance"]').click();
  await page.getByRole("button", { name: /^Opaline Original/ }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(await page.locator("body").getAttribute("data-style"), "frost");
  assert.equal(await page.locator("#lens-defs filter").count(), 0, "a material that does not bend light runs no lens");
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
  // Sampled once layout has settled: a single read right after the tray opens once caught the box 10 px off mid-transition.
  await page.waitForFunction(() => { const box = document.getElementById("search-wrap").getBoundingClientRect(); return Math.abs(box.x + box.width / 2 - 640) < 2; }, null, { timeout: 1500 });
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
  // Hiding every destination of a header group must not leave an empty glass capsule, and the tray must still reach them.
  for (const name of ["Show All apps", "Show Screen time", "Show Settings"]) await page.getByRole("switch", { name }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(await page.locator("body").getAttribute("data-shortcut-all-apps"), "false");
  assert.equal(await page.locator("body").getAttribute("data-shortcut-settings"), "false");
  await page.keyboard.press("Alt+1"); // the header and bottom bar are not part of the Settings page, so assert on Home
  assert(!(await visible("#header-left")));
  assert(!(await visible("#header-right")));
  assert(await visible("#navigation-overflow"));
  const centredSearch = await page.locator("#search-wrap").boundingBox();
  assert(centredSearch && Math.abs(centredSearch.x + centredSearch.width / 2 - 640) < 2, JSON.stringify(centredSearch));
  await page.keyboard.press("Alt+5"); // Settings stays reachable from the keyboard with every shortcut hidden
  assert(await visible("#settings-surface"));
  for (const name of ["Show All apps", "Show Screen time", "Show Settings"]) await page.getByRole("switch", { name }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(await page.locator("body").getAttribute("data-shortcut-all-apps"), "true");
  assert.equal(await page.locator("body").getAttribute("data-shortcut-settings"), "true");
  await page.locator('.nav-item[data-id="home"]').click();
  await page.getByRole("button", { name: "A–Z" }).click(); await wait(380);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("demo:groups.json"))).layout["group:agents"].x, 0);
  await page.getByRole("textbox", { name: "New workspace name" }).scrollIntoViewIfNeeded(); // Home screens live in the Home section now
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
  // An empty screen offers a real plus as well as the labelled button; both open the picker.
  await page.locator(".workspace-empty button.workspace-empty-mark").click();
  assert(await visible("#item-picker"));
  await page.locator("#picker-close").click();
  await page.locator(".workspace-empty .chip").click();
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
  // Taskbar ends and side rails dock the two header groups at the screen's edges while search stays centred, and controls
  // only minimise when the taskbar mirror is there to bring them back.
  const applyNavigation = async (changes) => {
    await page.evaluate((patch) => { const saved = JSON.parse(localStorage.getItem("opaline.settings") || "{}"); localStorage.setItem("opaline.settings", JSON.stringify({ ...saved, defaultPage: "home", ...patch })); }, changes);
    await page.reload();
    await page.waitForSelector("#grid .tile");
    await page.keyboard.press("Alt+1");
    await page.waitForSelector("#apps-surface:visible");
    await wait(600);
  };
  await applyNavigation({ navigationMode: "ends", compactBar: false, rail: true });
  {
    // One group beside Home on its left and one after the app mirror on its right: together they are the taskbar, nowhere near the corners.
    const [first, last, home, search, rail] = await Promise.all(["navigation-ends-start", "navigation-ends-end", "home-dock", "search-wrap", "rail"].map(boxOf));
    assert(first.x + first.width <= home.x && home.x - (first.x + first.width) < 24, JSON.stringify({ first, home }));
    assert(last.x >= rail.x + rail.width && last.x - (rail.x + rail.width) < 24, JSON.stringify({ rail, last }));
    assert(first.x > 300 && last.x + last.width < 980, "the groups sit with the taskbar, not at the screen's extremes");
    assert(Math.abs(first.y - home.y) < 2 && Math.abs(last.y - rail.y) < 2, "one row");
    assert(Math.abs(search.x + search.width / 2 - 640) < 2 && search.y < 60, JSON.stringify(search));
    assert(!(await visible("#header-left")) && !(await visible("#header-right")) && !(await visible("#navigation-sidebar")));
    assert.equal(await page.locator("#navigation-ends-start .orb").count() + await page.locator("#navigation-ends-end .orb").count(), 4);
    // The destination icons are drawn at Home's size and stroke, so the bar reads as one set.
    const glyphs = await page.evaluate(() => ["#home-dock svg", "#navigation-ends-start .orb svg"].map(selector => { const style = getComputedStyle(document.querySelector(selector)); return [style.width, style.strokeWidth]; }));
    assert.deepEqual(glyphs[0], glyphs[1]);
    await shot("navigation-taskbar-ends.png");
  }
  await applyNavigation({ navigationMode: "sidebar", navigationSide: "left" });
  {
    const [bar, search, panel] = await Promise.all(["navigation-sidebar", "search-wrap", "apps-surface"].map(boxOf));
    // The taskbar turned on its side: a compact pill (not a full-height strip) hugging the left edge, centred vertically.
    assert(bar.x < 24 && bar.width < 60 && bar.height > bar.width * 2 && bar.height < 260, JSON.stringify(bar));
    assert(Math.abs(bar.y + bar.height / 2 - 400) < 4, JSON.stringify(bar));
    assert.equal(await page.locator("#navigation-sidebar .orb").count(), 4);
    assert(Math.abs(search.x + search.width / 2 - 640) < 2, JSON.stringify(search));
    assert(panel.x > bar.x + bar.width, "the page panel keeps clear of the sidebar");
    assert(!(await visible("#header-left")) && !(await visible("#header-right")), "the header groups give way to the sidebar");
    await shot("navigation-sidebar.png");
  }
  await page.locator('#navigation-sidebar [data-page="all-apps"]').click();
  assert(await visible("#app-list-surface"));
  assert.equal(await page.locator('#navigation-sidebar [data-page="all-apps"]').getAttribute("aria-current"), "page");
  await applyNavigation({ navigationMode: "sidebar", navigationSide: "right" });
  {
    const bar = await boxOf("navigation-sidebar");
    assert(bar.x + bar.width > 1256 && bar.height < 260, JSON.stringify(bar));
  }
  // The edge choice shows only while Sidebar is the arrangement.
  await page.keyboard.press("Alt+5");
  await page.locator('.nav-item[data-id="navigation"]').click();
  assert(await page.getByRole("group", { name: "Sidebar edge" }).isVisible());
  await page.getByRole("button", { name: /Split header/ }).click();
  assert(!(await page.getByRole("group", { name: "Sidebar edge" }).isVisible()));
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  // The taskbar docks to any edge, at the start, centre or end of it; its preview opens toward the screen and the page keeps clear.
  for (const [edge, check] of [
    ["top", (bar, card, anchor) => bar.y < 20 && card.y >= anchor.y + anchor.height],
    ["left", (bar, card, anchor) => bar.x < 20 && bar.height > bar.width && card.x >= anchor.x + anchor.width],
    ["right", (bar, card, anchor) => bar.x + bar.width > 1260 && bar.height > bar.width && card.x + card.width <= anchor.x],
  ]) {
    await applyNavigation({ navigationMode: "split", compactBar: false, rail: true, railEdge: edge, railAlign: "center" });
    const dock = page.locator("#rail .dock-item").nth(1);
    const anchor = await dock.boundingBox();
    await page.mouse.move(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2, { steps: 4 });
    await page.waitForSelector("#preview:not([hidden])");
    const [bar, card, panel] = await Promise.all(["bottom-bar", "preview", "apps-surface"].map(boxOf));
    assert(check(bar, card, anchor), JSON.stringify({ edge, bar, card, anchor }));
    assert(card.x >= 0 && card.y >= 0 && card.x + card.width <= 1280 && card.y + card.height <= 800, "the preview stays on screen");
    const barBox = edge === "top" ? { left: bar.x, right: bar.x + bar.width, top: bar.y, bottom: bar.y + bar.height } : null;
    if (barBox) assert(panel.y >= barBox.bottom, "the page moves down out of the top taskbar's way");
    if (edge === "left") assert(panel.x >= bar.x + bar.width, "the page keeps clear of a left taskbar");
    if (edge === "right") assert(panel.x + panel.width <= bar.x, "the page keeps clear of a right taskbar");
    if (edge !== "top") assert(Math.abs(bar.y + bar.height / 2 - 400) < 4, "a side taskbar is centred on its edge");
    await shot(`taskbar-${edge}.png`);
    await page.mouse.move(640, 400, { steps: 4 });
  }
  for (const [align, test] of [["start", bar => bar.x < 40], ["end", bar => bar.x + bar.width > 1240]]) {
    await applyNavigation({ navigationMode: "split", compactBar: false, rail: true, railEdge: "bottom", railAlign: align });
    assert(test(await boxOf("bottom-bar")), `${align} alignment`);
  }
  // A sidebar on the taskbar's own side steps inward instead of landing on it.
  await applyNavigation({ navigationMode: "sidebar", navigationSide: "left", railEdge: "left", railAlign: "center" });
  {
    const [bar, sidebar] = await Promise.all(["bottom-bar", "navigation-sidebar"].map(boxOf));
    assert(sidebar.x >= bar.x + bar.width, JSON.stringify({ bar, sidebar }));
  }
  await applyNavigation({ navigationMode: "split", compactBar: true, rail: false, railEdge: "bottom", railAlign: "center" });
  assert.equal(await page.locator("body").getAttribute("data-compact-bar"), "false", "no taskbar, nothing to bring the controls back: they stay");
  assert(await visible("#header-left"));
  await page.keyboard.press("Alt+5");
  await page.locator('.nav-item[data-id="navigation"]').click();
  assert(await page.getByRole("switch", { name: "Compact navigation" }).isDisabled());
  await page.keyboard.press("Alt+1");
  await page.keyboard.press("Control+b");
  assert.match(await page.locator("#navigation-note").textContent(), /taskbar mirror/);
  assert.equal(await page.locator("body").getAttribute("data-compact-bar"), "false");
  await applyNavigation({ navigationMode: "split", compactBar: false, rail: true });
  // Help: F1 (or ? when nothing is being typed) opens the shortcut list; it covers keys and gestures and Esc leaves it.
  await page.keyboard.press("Alt+1");
  await page.waitForSelector("#apps-surface:visible");
  await page.locator("#shell").focus();
  await page.keyboard.press("F1");
  assert(await visible("#settings-surface"));
  assert.equal(await page.locator(".nav-item[aria-current='page'], .nav-item.active").first().textContent(), "Shortcuts & help");
  assert(await page.locator(".shortcut-group").count() >= 5);
  assert((await page.locator(".shortcut-keys kbd").allTextContents()).includes("Esc"));
  assert(await page.locator(".gesture-name", { hasText: "Pinch in or out" }).isVisible());
  await shot("settings-help.png");
  await page.keyboard.press("Escape");
  assert(await visible("#apps-surface"));
  await page.locator("#shell").focus();
  await page.keyboard.press("?");
  assert(await visible("#settings-surface"));
  await page.keyboard.press("Alt+1");
  // Hover intent: popups follow the pointer's path instead of closing on it, and neighbouring triggers warm up together.
  // Real mouse paths, because the point is how a hand actually travels; moves are chunked so each pointermove is a real event.
  {
    const centre = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
    const displayed = (locator) => locator.evaluate(node => getComputedStyle(node).display !== "none");
    await page.keyboard.press("Alt+1");
    await page.waitForSelector("#apps-surface:visible");
    await wait(600); // let the page finish moving in: the paths below are aimed at where things settle
    // The stage clips its oversize backdrop; it must not be scrollable, or a focus could slide the whole UI sideways.
    assert.deepEqual(await page.evaluate(() => { const stage = document.getElementById("stage"); stage.scrollLeft = 30; stage.scrollTop = 30; return [stage.scrollLeft, stage.scrollTop]; }), [0, 0]);

    // Context-menu submenus: a diagonal path across a sibling row keeps the submenu, switching is instant, leaving closes it.
    const firstTile = page.locator("#grid .item-tile").first();
    await page.mouse.move(centre(await firstTile.boundingBox()).x, centre(await firstTile.boundingBox()).y);
    await firstTile.click({ button: "right" });
    const triggers = page.locator("#menu > .menu-list > .has-submenu");
    assert.equal(await triggers.count(), 2);
    const rowA = await triggers.nth(0).locator(":scope > .menu-item").boundingBox();
    const rowB = await triggers.nth(1).locator(":scope > .menu-item").boundingBox();
    const submenuA = triggers.nth(0).locator(":scope > .submenu");
    const submenuB = triggers.nth(1).locator(":scope > .submenu");
    await page.mouse.move(centre(rowA).x, centre(rowA).y, { steps: 4 });
    await page.waitForFunction(() => [...document.querySelectorAll(".has-submenu > .submenu")].some(node => getComputedStyle(node).display !== "none"));
    const boxA = await submenuA.boundingBox();
    const inside = { x: boxA.x + 40, y: boxA.y + boxA.height - 14 };
    await page.mouse.move(inside.x, inside.y, { steps: 30 }); // down and to the right, across the row below
    await wait(80);
    assert(await displayed(submenuA), "the submenu closed while the pointer was on its way to it");
    assert(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest(".submenu"), [inside.x, inside.y]));
    await page.mouse.move(centre(rowB).x, centre(rowA).y, { steps: 3 });
    await page.mouse.move(centre(rowB).x, centre(rowB).y, { steps: 10 });
    await page.waitForFunction(() => [...document.querySelectorAll(".has-submenu")][1] && getComputedStyle(document.querySelectorAll(".has-submenu")[1].querySelector(":scope > .submenu")).display !== "none", null, { polling: 16, timeout: 600 });
    assert(!(await displayed(submenuA)), "only one submenu stays open");
    await page.mouse.move(1100, 60, { steps: 12 });
    await wait(450);
    assert(!(await displayed(submenuB)) && !(await displayed(submenuA)));
    assert(!(await page.locator("#menu").evaluate(node => node.hidden)), "leaving a submenu must not close the menu");
    await page.keyboard.press("Escape");

    // Taskbar preview: it stays on the hovered app while the pointer crosses the next icon on the way to it, and still
    // switches at once when the pointer moves along the dock.
    const dock = page.locator("#rail .dock-item");
    const iconOne = await dock.nth(1).boundingBox();
    await page.mouse.move(centre(iconOne).x, centre(iconOne).y, { steps: 5 });
    await page.waitForSelector("#preview:not([hidden])");
    const previewTitle = () => page.evaluate(() => document.querySelector("#preview .preview-title")?.firstChild?.textContent ?? null);
    const hovered = await previewTitle();
    const card = await page.locator("#preview").boundingBox();
    const neighbour = await dock.nth(2).boundingBox();
    const from = { x: iconOne.x + iconOne.width - 2, y: iconOne.y + iconOne.height - 3 };
    const to = { x: Math.min(neighbour.x + neighbour.width * 1.4, card.x + card.width - 10), y: card.y + card.height - 6 };
    const crossesNeighbour = Array.from({ length: 41 }, (_, step) => ({ x: from.x + (to.x - from.x) * step / 40, y: from.y + (to.y - from.y) * step / 40 }))
      .some(point => point.x >= neighbour.x && point.x <= neighbour.x + neighbour.width && point.y >= neighbour.y && point.y <= neighbour.y + neighbour.height);
    assert(crossesNeighbour, "the test path must really cross the next icon");
    await page.mouse.move(from.x, from.y, { steps: 3 });
    await page.mouse.move(to.x, to.y, { steps: 14 });
    await wait(500);
    assert.equal(await previewTitle(), hovered, "the preview was taken over by an icon on the way to it");
    await page.mouse.move(centre(iconOne).x, centre(iconOne).y, { steps: 6 });
    await wait(300);
    await page.mouse.move(centre(neighbour).x, centre(neighbour).y, { steps: 8 });
    await wait(120);
    assert.notEqual(await previewTitle(), hovered, "moving along the dock must switch to the neighbour");
    await page.mouse.move(640, 300, { steps: 10 });
    await wait(500);
    assert(await page.locator("#preview").evaluate(node => node.hidden));

    // Pane peek: only the first one waits; sweeping to the next pane shows it at once.
    const panes = page.locator("#grid .pane-tile");
    const paneOne = await panes.nth(0).boundingBox();
    const paneTwo = await panes.nth(1).boundingBox();
    const paneName = (index) => panes.nth(index).locator(".label").textContent();
    const peekFor = (name) => page.waitForFunction(expected => { const peek = document.getElementById("tile-peek"); return !peek.hidden && peek.querySelector(".peek-title")?.textContent === expected; }, name, { timeout: 1500, polling: 16 });
    await page.mouse.move(640, 24, { steps: 6 });
    await wait(1000);
    await page.mouse.move(centre(paneOne).x, centre(paneOne).y, { steps: 4 });
    const coldStart = Date.now();
    await peekFor(await paneName(0));
    const coldMs = Date.now() - coldStart;
    await page.mouse.move(centre(paneTwo).x, centre(paneTwo).y, { steps: 6 });
    const warmStart = Date.now();
    await peekFor(await paneName(1));
    const warmMs = Date.now() - warmStart;
    assert(coldMs > 400 && warmMs < 300, JSON.stringify({ coldMs, warmMs }));
    await page.mouse.move(640, 700, { steps: 8 });
    await wait(700);

    // Navigation tray: opens on resting, survives a diagonal path, closes on leaving, pins on click, and dismisses
    // on an outside press or Escape (which must not also close the launcher).
    await page.evaluate(() => { const saved = JSON.parse(localStorage.getItem("opaline.settings") || "{}"); localStorage.setItem("opaline.settings", JSON.stringify({ ...saved, navigationMode: "tray", compactBar: false, defaultPage: "home" })); });
    await page.reload();
    await page.waitForSelector("#grid .tile");
    await page.keyboard.press("Alt+1");
    await page.waitForSelector("#apps-surface:visible");
    await wait(600);
    const trayOpen = () => page.evaluate(() => document.getElementById("navigation-overflow").open);
    const summaryBox = await page.locator("#navigation-overflow summary").boundingBox();
    assert(!(await trayOpen()));
    await page.mouse.move(centre(summaryBox).x, centre(summaryBox).y, { steps: 4 });
    await wait(40);
    assert(!(await trayOpen()), "hover must wait for a moment of intent");
    await page.waitForFunction(() => document.getElementById("navigation-overflow").open, null, { timeout: 800 });
    const listBox = await page.locator("#navigation-overflow .navigation-tray").boundingBox();
    await page.mouse.move(listBox.x + listBox.width - 14, listBox.y + 14, { steps: 24 });
    await wait(500);
    assert(await trayOpen(), "the tray closed while the pointer was on its way to the list");
    await page.mouse.move(200, 120, { steps: 12 });
    await wait(500);
    assert(!(await trayOpen()), "the tray must close once the pointer leaves for elsewhere");
    await page.mouse.move(centre(summaryBox).x, centre(summaryBox).y, { steps: 4 });
    await page.waitForFunction(() => document.getElementById("navigation-overflow").open, null, { timeout: 800 });
    await page.mouse.down(); await page.mouse.up();
    await page.mouse.move(200, 120, { steps: 12 });
    await wait(600);
    assert(await trayOpen(), "a click must pin a hover-opened tray");
    await page.mouse.click(200, 400);
    await wait(150);
    assert(!(await trayOpen()), "a press outside must dismiss it");
    await page.locator("#navigation-overflow summary").click();
    assert(await trayOpen());
    const hidesBefore = await page.evaluate(() => window.__demoCalls.filter(command => command === "hide").length);
    await page.keyboard.press("Escape");
    await wait(300);
    assert(!(await trayOpen()), "Escape must close the tray first");
    assert.equal(await page.evaluate(() => window.__demoCalls.filter(command => command === "hide").length), hidesBefore, "Escape must not also close the launcher");
    await page.locator("#navigation-overflow summary").click();
    await page.locator("#navigation-overflow .navigation-tray button[data-page='focus']").click();
    await wait(300);
    assert(!(await trayOpen()));
    assert.equal(await page.locator("body").getAttribute("data-page"), "focus");
    await page.evaluate(() => { const saved = JSON.parse(localStorage.getItem("opaline.settings") || "{}"); localStorage.setItem("opaline.settings", JSON.stringify({ ...saved, navigationMode: "split", defaultPage: "all-apps" })); });
    await page.reload();
    await page.waitForSelector("#app-list-surface:visible");
  }
  // Gesture motion, last because it removes the Home screens the earlier checks rely on. Everything here goes through real
  // wheel events and the real recogniser; calling the page modules directly would create a second copy of their state.
  const releasedBy = (selector) => page.evaluate((target) => !document.querySelector(`${target}[data-gesture-preview]`), selector);
  const wheelNow = (selector, init) => page.evaluate(([target, eventInit]) => {
    document.querySelector(target).dispatchEvent(new WheelEvent("wheel", { ...eventInit, deltaMode: 0, bubbles: true, cancelable: true }));
    return {
      page: document.body.dataset.page,
      animations: document.getAnimations().filter(animation => animation.id.startsWith("gesture-")).length,
      ghosts: document.querySelectorAll("[data-gesture-ghost]").length,
    };
  }, [selector, init]);
  await page.keyboard.press("Alt+1");
  await page.waitForSelector("#apps-surface:visible");
  // Reduced motion keeps the cue but nothing moves, and the page still changes without animating.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const calmPreview = await wheelPreview("#apps-surface", { ctrlKey: true, deltaX: 0, deltaY: 1, maxEvents: 50 });
  assert(calmPreview.cueVisible);
  assert.equal(calmPreview.transform, "none");
  await wait(400); // the recogniser releases the preview and its lock
  const calm = await wheelNow("#apps-surface", { ctrlKey: true, deltaX: 0, deltaY: -60 });
  assert.equal(calm.page, "all-apps");
  assert.equal(calm.animations, 0);
  assert.equal(calm.ghosts, 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await wait(400);
  // Home screens work like Android's: a trailing plus page creates the next screen, and a screen can be removed in place.
  await page.keyboard.press("Alt+1");
  await page.waitForSelector("#apps-surface:visible");
  const dots = () => page.locator(".home-footer .home-page-button").count();
  const screensBefore = await dots();
  const titles = await page.locator(".home-footer .home-page-button").evaluateAll(nodes => nodes.map(node => node.title));
  const lastScreen = titles[titles.length - 2];
  // Swiping back from Desktop wraps to the new-screen page, and the cue says so.
  const toNewScreen = await wheelPreview("#apps-surface", { deltaX: -1, deltaY: 0, maxEvents: 40 });
  assert(toNewScreen.cueVisible);
  assert.match(toNewScreen.cueText, /New screen/);
  await wait(400);
  assert(await releasedBy("#apps-surface > .home-motion"));
  await page.locator(".home-footer .home-page-button.add").click();
  await homeNamed("New screen");
  assert.equal(await page.locator("#workspace-remove").isVisible(), false, "the new-screen page has nothing to remove");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Add a Home screen");
  await page.keyboard.press("Enter");
  assert.match(await page.locator("#workspace-title").textContent(), /^Screen \d+$/);
  assert.equal(await dots(), screensBefore + 1);
  assert(await page.locator(".workspace-empty").isVisible());
  // An empty screen has nothing to lose: removing it is immediate and lands on the screen before it.
  await page.locator("#workspace-remove").click();
  await homeNamed(lastScreen);
  assert.equal(await dots(), screensBefore);
  // A screen with items asks first.
  await page.locator("#workspace-pages .home-page-button").nth(1).click();
  await homeNamed("Dev tools");
  await page.locator("#workspace-remove").click();
  assert.equal(await page.locator("#workspace-remove").textContent(), "Confirm removal");
  assert.equal(await page.locator("#workspace-title").textContent(), "Dev tools");
  await page.locator("#workspace-remove").click();
  await page.waitForFunction(() => document.body.dataset.page === "desktop");
  assert.equal(await dots(), screensBefore - 1);
  // Every custom screen can go; the plus page is always still there to start again.
  await page.keyboard.press("Alt+5");
  await page.locator('.nav-item[data-id="home"]').click();
  while (await page.getByRole("button", { name: "Remove", exact: true }).count()) {
    const rows = await page.locator(".workspace-controls .row").count();
    await page.getByRole("button", { name: "Remove", exact: true }).first().click();
    await page.getByRole("button", { name: "Confirm removal" }).click();
    await page.waitForFunction((before) => document.querySelectorAll(".workspace-controls .row").length < before, rows);
  }
  await page.keyboard.press("Alt+1");
  await page.waitForSelector("#apps-surface:visible");
  assert.equal(await dots(), 2, "Desktop and the plus");
  // With Desktop alone a swipe still has somewhere to go: the new-screen page.
  await wheelNow("#apps-surface", { deltaX: 120, deltaY: 1 });
  await wait(700);
  assert.equal(await page.locator("#workspace-title").textContent(), "New screen");
  assert.equal(await page.locator("[data-gesture-ghost]").count(), 0);
  // Pages ease in instead of flicking over, and a Settings toggle turns that off.
  await page.keyboard.press("Alt+1");
  await page.waitForSelector("#apps-surface:visible");
  await wait(500);
  const faded = async () => { await page.keyboard.press("Alt+2"); return page.evaluate(() => document.getElementById("app-list-surface").classList.contains("fade-in")); };
  assert(await faded(), "switching pages fades the incoming page in");
  await wait(500);
  assert(!(await page.evaluate(() => document.getElementById("app-list-surface").classList.contains("fade-in"))), "the fade leaves nothing behind");
  await page.keyboard.press("Alt+5");
  await page.locator('.nav-item[data-id="behaviour"]').click();
  await page.getByRole("switch", { name: "Fade between pages" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(await page.locator("body").getAttribute("data-page-fade"), "false");
  await page.keyboard.press("Alt+1");
  assert(!(await faded()), "with the toggle off pages simply appear");
  await page.keyboard.press("Alt+5");
  await page.locator('.nav-item[data-id="behaviour"]').click();
  await page.getByRole("switch", { name: "Fade between pages" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  assert.equal(await page.locator("body").getAttribute("data-page-fade"), "true");
  // Home starts with one screen and a plus page; the two empty placeholders older versions made are dropped, a real screen is kept.
  const startWith = async (screens) => {
    await page.evaluate((value) => localStorage.setItem("demo:workspaces.json", JSON.stringify(value)), screens);
    await page.reload();
    await page.waitForSelector("#grid .tile", { state: "attached" });
    await page.keyboard.press("Alt+1");
    await page.waitForSelector("#apps-surface:visible");
    await wait(400);
    return page.locator(".home-footer .home-page-button").count();
  };
  assert.equal(await startWith([]), 2, "a fresh profile is Desktop and the plus that adds the next screen");
  assert.equal(await startWith([{ id: "screen-2", name: "Screen 2", items: [] }, { id: "screen-3", name: "Screen 3", items: [] }]), 2, "the empty placeholders are gone");
  assert.equal(await startWith([{ id: "screen-2", name: "Reading", items: [] }]), 3, "a screen the user named is kept");
  assert.deepEqual(errors, []);
  const result = { ui: "passed", cachedPreviewMs: timing.milliseconds, screenshots: screenshotCount, viewport: "1280x800, 1024x600, 800x600, 600x600", errors };
  writeFileSync(new URL("../ui-verification.local.json", import.meta.url), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
