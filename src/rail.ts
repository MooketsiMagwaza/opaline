import { api, type RailItem, type WindowInfo } from "./api";
import { byId, clamp, el } from "./dom";
import { iconElement } from "./icons";
import { settings } from "./settings";

const REFRESH_MS = 3000;
const THUMBNAIL_TTL_MS = 5000;
const SHOW_DELAY_MS = 140;
const HIDE_DELAY_MS = 220;

let items: RailItem[] = [];
let signature = "";
let refreshTimer: number | undefined;
let showTimer: number | undefined;
let hideTimer: number | undefined;
let magnifyFrame = 0;
const thumbnails = new Map<number, { url: string | null; at: number }>();

export async function refreshRail() {
  if (!settings().rail) return;

  const next = await api.rail().catch(() => [] as RailItem[]);
  const nextSignature = JSON.stringify(
    next.map((item) => [item.id, item.pinned, item.windows.map((w) => [w.hwnd, w.title, w.minimized])]),
  );
  items = next;

  // only touch the DOM when something changed, so a hover or preview isn't disturbed
  if (nextSignature !== signature) {
    signature = nextSignature;
    renderRail();
  }
}

/** Warms the thumbnail cache so a hover shows its preview at once instead of after a capture. */
async function prefetchThumbnails() {
  const windows = items.flatMap((item) => item.windows).filter((w) => !w.minimized);
  for (const window of windows.slice(0, 10)) await thumbnail(window.hwnd);
}

export function startRail() {
  stopRail();
  void prefetchThumbnails();
  refreshTimer = window.setInterval(() => void refreshRail(), REFRESH_MS);
}

export function stopRail() {
  window.clearInterval(refreshTimer);
  hidePreview(true);
}

function renderRail() {
  const rail = byId("rail");
  rail.hidden = items.length === 0;
  rail.style.setProperty("--count", String(Math.max(items.length, 1)));
  rail.replaceChildren(...items.map(dockButton));
}

function activate(item: RailItem) {
  hidePreview(true);
  if (item.windows.length > 0) void api.focusWindow(item.windows[0].hwnd);
  else if (item.launchPath) void api.launch(item.launchPath);
}

function dockButton(item: RailItem, index: number): HTMLElement {
  const button = el("button", item.windows.length ? "dock-item running" : "dock-item", [
    iconElement(item.iconPath, item.name),
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

  const url = await api.thumbnail(hwnd).catch(() => null);
  thumbnails.set(hwnd, { url, at: Date.now() });
  return url;
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
    void thumbnail(window.hwnd).then((url) => {
      if (url) image.style.backgroundImage = `url("${url}")`;
    });
  }
  return card;
}

function schedulePreview(item: RailItem, anchor: HTMLElement) {
  window.clearTimeout(hideTimer);
  if (!settings().railPreviews) return;

  // moving between icons swaps the preview at once; the first one waits a beat
  const delay = byId("preview").hidden ? SHOW_DELAY_MS : 0;
  window.clearTimeout(showTimer);
  showTimer = window.setTimeout(() => showPreview(item, anchor), delay);
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

  // sit beside the rail, centred on the icon, and stay on screen
  const rect = anchor.getBoundingClientRect();
  const box = card.getBoundingClientRect();
  const onRight = document.body.dataset.railSide !== "left";
  const left = onRight ? rect.left - box.width - 18 : rect.right + 18;
  card.style.left = `${clamp(left, 12, window.innerWidth - box.width - 12)}px`;
  card.style.top = `${clamp(rect.top + rect.height / 2 - box.height / 2, 12, window.innerHeight - box.height - 12)}px`;
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

function magnify(pointerY: number) {
  const rail = byId("rail");
  const top = rail.getBoundingClientRect().top;

  for (const child of rail.children) {
    const button = child as HTMLElement;
    // layout position, so the scale being applied doesn't feed back into the maths
    const centre = top + button.offsetTop + button.offsetHeight / 2;
    const signedDistance = centre - pointerY;
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
    if (!settings().railMagnify) return;
    cancelAnimationFrame(magnifyFrame);
    magnifyFrame = requestAnimationFrame(() => magnify(event.clientY));
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
