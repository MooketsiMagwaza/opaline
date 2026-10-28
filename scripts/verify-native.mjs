// Read-only shell checks and optional isolated-profile persistence checks over local WebView2 CDP.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const target = targets.find((page) => page.type === "page" && !page.url.startsWith("devtools"));
assert(target, "Start the debug app with WebView2 debugging on port 9222.");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let sequence = 0;
const pending = new Map();
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); }
};
const send = (method, params) => new Promise((resolve) => { const id = ++sequence; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })); });
async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.exception?.description || response.result.exceptionDetails.text);
  return response.result?.result?.value;
}
try {
  const result = await evaluate(`(async () => {
    const { api } = await import('/src/api.ts');
    const status = await api.status();
    const apps = await api.listApps();
    const rail = await api.rail();
    const usage = await api.screenTime();
    const start = await api.startMenuStatus();
    const windows = rail.flatMap(item => item.windows).filter(window => !window.minimized).slice(0, 3);
    const coldCaptureMs = [];
    let captured = 0;
    for (const window of windows) { const before = performance.now(); const image = await api.thumbnail(window.hwnd); coldCaptureMs.push(Math.round((performance.now() - before) * 10) / 10); if (image) captured++; }
    return { hotkeyOk: status.hotkeyOk, installedApps: apps.length, railItems: rail.length, previewAttempts: windows.length, captured, coldCaptureMs, usageSupported: usage.supported, startKeyAvailable: start.available, startKeyEnabled: start.enabled };
  })()`);
  assert(result.hotkeyOk);
  assert(result.installedApps > 0);
  assert(result.usageSupported);
  if (process.argv.includes("--isolated-persistence")) {
    const saved = await evaluate(`(async () => {
      const { api } = await import('/src/api.ts');
      const marker = JSON.parse(await api.loadStore('config.json') || '{}');
      if (marker.testProfile !== true) throw new Error('Persistence checks require the isolated test profile marker.');
      const json = JSON.stringify([{id:'verify',name:'Native check',items:[]}]);
      await api.saveStore('workspaces.json', json);
      const workspaceRoundtrip = await api.loadStore('workspaces.json') === json;
      const before = await api.screenTime();
      await api.setScreenTime(false); const paused = !(await api.screenTime()).enabled;
      await api.setScreenTime(before.enabled);
      const validFolder = (await api.workspaceItem(${JSON.stringify(process.cwd())})).isFolder;
      let rejectedTraversal = false;
      try { await api.saveStore('../bad.json', '{}'); } catch { rejectedTraversal = true; }
      return { workspaceRoundtrip, paused, validFolder, rejectedTraversal };
    })()`);
    for (const value of Object.values(saved)) assert.equal(value, true);
    result.persistence = saved;
  }
  if (process.argv.includes("--export-demo-icons")) {
    const icons = await evaluate(`(async () => {
      const { api } = await import('/src/api.ts'); const apps = await api.listApps();
      const names = ['Visual Studio Code','Terminal','Docker Desktop','Firefox','Microsoft Edge','Discord','WhatsApp','Obsidian','Notion','Spotify','Steam','Krita','OBS Studio','Notion Calendar','ChatGPT','Claude','Codex','Android Studio'];
      const result = {};
      for (const name of names) { const app = apps.find(app => app.name === name); if (app) { const icon = await api.icon(app.path); if (icon) result[name] = icon; } }
      return result;
    })()`);
    const folder = new URL("../docs/demo-icons/", import.meta.url);
    mkdirSync(folder, { recursive: true });
    const manifest = {};
    for (const [name, data] of Object.entries(icons)) {
      const file = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
      writeFileSync(new URL(file, folder), Buffer.from(data.split(",")[1], "base64"));
      manifest[name] = `/docs/demo-icons/${file}`;
    }
    writeFileSync(new URL("manifest.json", folder), JSON.stringify(manifest, null, 2));
    result.demoIconCount = Object.keys(manifest).length;
  }
  writeFileSync(new URL("../native-verification.local.json", import.meta.url), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { socket.close(); }
