import { api } from "./api";
import { el } from "./dom";

// Icons are images served by the `opaline` protocol, so the browser decodes, caches and evicts them. Only a failure is remembered
// (until the next open), so an app without an icon is not asked for again on every redraw.
const failed = new Set<string>();

// Earlier versions kept up to 2 MB of base64 icons here and parsed it at every start.
try { localStorage.removeItem("opaline.icons.v2"); } catch { /* Storage can be unavailable; there is then nothing to clean up. */ }

export function forgetFailedIcons() { failed.clear(); }

const letter = (name: string) => el("span", "fallback", [name.trim().charAt(0).toUpperCase() || "?"]);

function picture(url: string, onFailure: () => void): HTMLImageElement {
  const image = new Image();
  image.alt = ""; image.draggable = false; image.decoding = "async";
  image.addEventListener("error", onFailure, { once: true });
  image.src = url;
  return image;
}

function showItemIcon(holder: HTMLElement, path: string, name: string) {
  if (failed.has(path)) { holder.replaceChildren(letter(name)); return; }
  holder.replaceChildren(picture(api.iconUrl(path), () => { failed.add(path); holder.replaceChildren(letter(name)); }));
}

/** An item's icon, or its first letter when Windows has none. */
export function iconElement(path: string, name: string): HTMLElement {
  const holder = el("span", "ico");
  showItemIcon(holder, path, name);
  return holder;
}

/** A window's own icon, falling back to the app's icon and then to a letter. */
export function windowIconElement(hwnd: number, fallbackPath: string, name: string): HTMLElement {
  const holder = el("span", "ico");
  holder.replaceChildren(picture(api.windowIconUrl(hwnd), () => showItemIcon(holder, fallbackPath, name)));
  return holder;
}
