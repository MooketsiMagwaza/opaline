import { api, type RailItem, type WindowInfo } from "./api";
import { byId, clamp, el } from "./dom";
import { iconElement, windowIconElement, forgetClosedWindowIcons } from "./icons";
import { settings } from "./settings";
import { show as showPage } from "./pages";

const REFRESH_MS = 3000;
const THUMBNAIL_TTL_MS = 5000;
const SHOW_DELAY_MS = 35;
const HIDE_DELAY_MS = 220;

let items: RailItem[] = [];
let signature = "";
let refreshTimer: number | undefined;
let showTimer: number | undefined;
let hideTimer: number | undefined;
let magnifyFrame = 0;
const thumbnails = new Map<number, { url: string | null; at: number }>();
const pendingThumbnails = new Map<number, Promise<string | null>>();
let refreshPending = false;
let active = false;
let generation = 0;
let lastPreview: { cached: boolean; milliseconds: number } | null = null;
export const previewTiming = () => lastPreview;

export async function refreshRail() {
  if (!settings().rail || refreshPending) return;
  refreshPending = true;
  const requestedGeneration = generation;

  let next: RailItem[];
  try { next = await api.rail(); } catch { return; } finally { refreshPending = false; }
  if (!active) return;
  if (requestedGeneration !== generation) { void refreshRail(); return; }
  const nextSignature = JSON.stringify(
    next.map((item) => [item.id, item.pinned, item.windows.map((w) => [w.hwnd, w.title, w.minimized])]),
  );
  items = next;
  const live = new Set(items.flatMap((item) => item.windows.map((window) => window.hwnd)));
  forgetClosedWindowIcons(live);
  for (const hwnd of thumbnails.keys()) if (!live.has(hwnd)) thumbnails.delete(hwnd);

  // only touch the DOM when something changed, so a hover or preview isn't disturbed
  if (nextSignature !== signature) {
    signature = nextSignature;
    renderRail();
  }
  if (settings().railPreviews) void prefetchThumbnails();
}

/** Warms the thumbnail cache so a hover shows its preview at once instead of after a capture. */
async function prefetchThumbnails() {
  const requestedGeneration = generation;
  const windows = items.flatMap((item) => item.windows).filter((w) => !w.minimized);
  for (const window of windows.slice(0, 12)) {
    if (!active || requestedGeneration !== generation || !settings().railPreviews) break;
    await thumbnail(window.hwnd);
  }
}

export function startRail() {
  stopRail();
  active = true;
  void refreshRail();
  refreshTimer = window.setInterval(() => void refreshRail(), REFRESH_MS);
}

export function stopRail() {
  generation++;
  active = false;
  window.clearInterval(refreshTimer);
  hidePreview(true);
}

function renderRail() {
  const rail = byId("rail");
  rail.hidden = false;
  rail.style.setProperty("--count", String(Math.max(items.length, 1)));
  const logo = el("img", "brand-mark"); logo.src = new URL("../assets/logo.svg", import.meta.url).href; logo.alt = "";
  const start = el("button", "dock-item app-list-shortcut", [logo]);
  start.type = "button";
  start.setAttribute("aria-label", "All apps");
  start.title = "All apps (Ctrl+Alt+A)";
  start.addEventListener("click", () => showPage("all-apps"));
  rail.replaceChildren(start, ...items.map(dockButton));
}

function activate(item: RailItem) {
  hidePreview(true);
  if (item.windows.length > 0) void api.focusWindow(item.windows[0].hwnd);
  else if (item.launchPath) void api.launch(item.launchPath);
}

function dockButton(item: RailItem, index: number): HTMLElement {
  const button = el("button", item.windows.length ? "dock-item running" : "dock-item", [
    item.windows.length ? windowIconElement(item.windows[0].hwnd, item.iconPath, item.name) : iconElement(item.iconPath, item.name),
  ]);
  button.type = "button";
  button.dataset.id = item.id;
  button.style.setProperty("--i", String(index));
  button.setAttribute("aria-label", item.name);
  if (!settings().railPreviews) button.title = item.name;
  if (item.windows.length > 1) button.append(el("span", "badge", [String(item.windows.length)]));

  button.addEventListener("click", () => activate(item));
  button.addEventListener("pointerenter", () => schedulePreview(item, button));
  button.addEventListener("pointerleave", scheduleHide);
  button.addEventListener("focus", () => schedulePreview(item, button));
  button.addEventListener("blur", scheduleHide);
  return button;
}

// ---------- previews ----------

async function thumbnail(hwnd: number): Promise<string | null> {
  const cached = thumbnails.get(hwnd);
  if (cached && Date.now() - cached.at < THUMBNAIL_TTL_MS) return cached.url;

  const pending = pendingThumbnails.get(hwnd);
  if (pending) return pending;
  const request = api.thumbnail(hwnd).then(async (url) => {
    if (url) {
      const image = new Image(); image.src = url;
      await image.decode().catch(() => {});
    }
    if (url || !cached) thumbnails.set(hwnd, { url, at: Date.now() });
    while (thumbnails.size > 32) thumbnails.delete(thumbnails.keys().next().value!);
    return url ?? cached?.url ?? null;
  }).catch(() => cached?.url ?? null).finally(() => { pendingThumbnails.delete(hwnd); });
  pendingThumbnails.set(hwnd, request);
  return request;
}

function thumbCard(window: WindowInfo): HTMLElement {
  const image = el("div", "thumb-image");
  const card = el("button", "thumb", [image, el("div", "thumb-title", [window.title])]);
  card.type = "button";
  card.addEventListener("click", () => {
    hidePreview(true);
    void api.focusWindow(window.hwnd);
  });

  if (window.minimized) {
    image.append(el("span", "thumb-note", ["Minimized"]));
  } else {
    const cached = thumbnails.get(window.hwnd)?.url;
    if (cached) image.style.backgroundImage = `url("${cached}")`;
    else image.append(el("span", "thumb-note", ["Loading preview…"]));
    void thumbnail(window.hwnd).then((url) => {
      image.replaceChildren();
      if (url) image.style.backgroundImage = `url("${url}")`;
      else image.append(el("span", "thumb-note", ["Preview unavailable"]));
    });
  }
  return card;
}

function schedulePreview(item: RailItem, anchor: HTMLElement) {
  window.clearTimeout(hideTimer);
  if (!settings().railPreviews) return;

  // moving between icons swaps the preview at once; the first one waits a beat
  const started = performance.now();
  const cached = item.windows.length > 0 && item.windows.every((window) => window.minimized || thumbnails.get(window.hwnd)?.url);
  const delay = byId("preview").hidden && !cached ? SHOW_DELAY_MS : 0;
  window.clearTimeout(showTimer);
  showTimer = window.setTimeout(() => {
    showPreview(item, anchor);
    requestAnimationFrame(() => {
      lastPreview = { cached, milliseconds: performance.now() - started };
      byId("preview").dataset.cached = String(cached);
      byId("preview").dataset.latencyMs = String(lastPreview.milliseconds);
    });
  }, delay);
}

function scheduleHide() {
  window.clearTimeout(showTimer);
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => hidePreview(), HIDE_DELAY_MS);
}

function showPreview(item: RailItem, anchor: HTMLElement) {
  const card = byId("preview");

  const count = item.windows.length;
  const title = el("div", "preview-title", [
    item.name,
    el("span", "preview-sub", [count > 1 ? `${count} windows` : count === 1 ? "1 window" : "not running"]),
  ]);
  const body =
    count > 0
      ? el("div", "preview-row", item.windows.map(thumbCard))
      : el("p", "preview-empty", [item.launchPath ? "Click to open" : "Not running"]);
  card.replaceChildren(title, body);
  card.hidden = false;

  // Sit above the bottom taskbar, centred on the icon.
  const rect = anchor.getBoundingClientRect();
  const box = card.getBoundingClientRect();
  const left = rect.left + rect.width / 2 - box.width / 2;
  card.style.left = `${clamp(left, 12, window.innerWidth - box.width - 12)}px`;
  card.style.top = `${clamp(rect.top - box.height - 16, 12, window.innerHeight - box.height - 12)}px`;
}

export function hidePreview(immediately = false) {
  window.clearTimeout(showTimer);
  window.clearTimeout(hideTimer);

  const card = byId("preview");
  if (immediately || !card.hidden) {
    card.hidden = true;
    card.replaceChildren();
  }
}

// ---------- magnification ----------

function magnify(pointerX: number) {
  const rail = byId("rail");
  const left = rail.getBoundingClientRect().left;

  for (const child of rail.children) {
    const button = child as HTMLElement;
    // layout position, so the scale being applied doesn't feed back into the maths
    const centre = left + button.offsetLeft - rail.scrollLeft + button.offsetWidth / 2;
    const signedDistance = centre - pointerX;
    const distance = Math.abs(signedDistance);
    const scale = 1 + 0.42 * Math.exp(-((distance / 78) ** 2));
    const push = Math.sign(signedDistance) * (scale - 1) * button.offsetHeight * 0.85;
    button.style.setProperty("--s", scale.toFixed(3));
    button.style.setProperty("--push", `${push.toFixed(1)}px`);
    button.style.zIndex = String(Math.round(scale * 100));
  }
}

export function initRail() {
  const rail = byId("rail");
  const preview = byId("preview");

  preview.addEventListener("pointerenter", () => window.clearTimeout(hideTimer));
  preview.addEventListener("pointerleave", scheduleHide);

  rail.addEventListener("pointermove", (event) => {
    if (!settings().railMagnify || !settings().animations || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    cancelAnimationFrame(magnifyFrame);
    magnifyFrame = requestAnimationFrame(() => magnify(event.clientX));
  });
  rail.addEventListener("pointerleave", () => {
    cancelAnimationFrame(magnifyFrame);
    for (const child of rail.children) {
      const button = child as HTMLElement;
      button.style.removeProperty("--s");
      button.style.removeProperty("--push");
      button.style.removeProperty("z-index");
    }
  });
}
