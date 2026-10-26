// Rasterises assets/logo.svg to assets/logo-1024.png. `npm run icons` then feeds that to
// `tauri icon`, which generates every size and format the app bundle needs.
import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const svg = readFileSync(new URL("../assets/logo.svg", import.meta.url));
const png = new Resvg(svg, { fitTo: { mode: "width", value: 1024 } }).render().asPng();

writeFileSync(new URL("../assets/logo-1024.png", import.meta.url), png);
console.log("wrote assets/logo-1024.png");
