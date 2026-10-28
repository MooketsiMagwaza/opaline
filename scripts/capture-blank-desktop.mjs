// Render the original, synthetic blank-desktop illustration as a PNG for GitHub docs.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.OPALINE_PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true, executablePath: process.env.OPALINE_BROWSER_PATH || chromium.executablePath() });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const svg = readFileSync(new URL("../docs/images/blank-desktop.svg", import.meta.url), "utf8");
  await page.setContent(`<html><body style="margin:0"><img width="1280" height="800" src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"/></body></html>`);
  await page.locator("img").evaluate(image => image.decode());
  await page.screenshot({ path: new URL("../docs/images/blank-desktop.png", import.meta.url).pathname.replace(/^\/(.:)/, "$1") });
} finally { await browser.close(); }
