// Local test driver: talks to the running Opaline webview over the Chrome DevTools Protocol.
// Usage: node cdp.mjs <script.json>   — a JSON array of steps, each one of:
//   { "eval": "js expression" }              evaluate and print the result
//   { "shot": "name" }                       save a screenshot of the page to <outDir>/<name>.png
//   { "key": "Escape" }                      dispatch a key press
//   { "wait": 500 }                          sleep (ms)
import { readFileSync, writeFileSync } from "node:fs";

const [, , scriptPath, outDir] = process.argv;
const steps = JSON.parse(readFileSync(scriptPath, "utf8"));

const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = targets.find((t) => t.type === "page" && !t.url.startsWith("devtools"));
if (!page) throw new Error("no page target found: " + JSON.stringify(targets.map((t) => t.url)));

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});

let nextId = 1;
const pending = new Map();
const consoleLines = [];

socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  } else if (message.method === "Runtime.consoleAPICalled") {
    const text = message.params.args.map((a) => a.value ?? a.description ?? "").join(" ");
    consoleLines.push(`[${message.params.type}] ${text}`);
  } else if (message.method === "Runtime.exceptionThrown") {
    const d = message.params.exceptionDetails;
    consoleLines.push(`[exception] ${d.text} ${d.exception?.description ?? ""}`);
  }
};

const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });

await send("Runtime.enable");
await send("Page.enable");

for (const step of steps) {
  if ("eval" in step) {
    const result = await send("Runtime.evaluate", {
      expression: step.eval,
      awaitPromise: true,
      returnByValue: true,
    });
    const value = result.result?.exceptionDetails
      ? "EXCEPTION: " + (result.result.exceptionDetails.exception?.description ?? result.result.exceptionDetails.text)
      : JSON.stringify(result.result?.result?.value);
    console.log("eval>", step.eval.slice(0, 80).replace(/\s+/g, " "), "=>", value);
  } else if ("shot" in step) {
    const result = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${outDir}/${step.shot}.png`, Buffer.from(result.result.data, "base64"));
    console.log("shot>", step.shot);
  } else if ("key" in step) {
    const key = step.key;
    await send("Input.dispatchKeyEvent", { type: "keyDown", key, code: key });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key, code: key });
    console.log("key>", key);
  } else if ("wait" in step) {
    await new Promise((r) => setTimeout(r, step.wait));
  }
}

await new Promise((r) => setTimeout(r, 200));
if (consoleLines.length) console.log("--- console\n" + consoleLines.join("\n"));
socket.close();
