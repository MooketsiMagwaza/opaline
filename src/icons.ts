import { api } from "./api";
import { el } from "./dom";

const STORAGE = "opaline.icons.v2";
const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();
const queue: (() => Promise<void>)[] = [];
let activeRequests = 0;
let saveTimer: number | undefined;
try {
  const stored = JSON.parse(localStorage.getItem(STORAGE) || "{}");
  if (Date.now() - stored.savedAt < 7 * 86400000 && Array.isArray(stored.icons)) {
    for (const [path, url] of stored.icons.slice(-96)) if (typeof path === "string" && typeof url === "string" && url.startsWith("data:image/")) cache.set(path, url);
  }
} catch { /* A disposable icon cache can be rebuilt without changing user data. */ }

function persistCache() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const icons = [...cache].filter(([path, url]) => !path.startsWith("window:") && url?.startsWith("data:image/")).slice(-96);
    while (icons.length && JSON.stringify(icons).length > 2_000_000) icons.shift();
    try { localStorage.setItem(STORAGE, JSON.stringify({ savedAt: Date.now(), icons })); }
    catch { /* Cache persistence is optional; the source icons remain available. */ }
  }, 1000);
}

function pumpQueue() {
  while (activeRequests < 2 && queue.length) {
    activeRequests++;
    void queue.shift()!().finally(() => { activeRequests--; pumpQueue(); });
  }
}

function requestIcon(key: string, request: () => Promise<string | null>): Promise<string | null> {
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
  const pending = inflight.get(key);
  if (pending) return pending;
  const result = new Promise<string | null>((resolve) => {
    queue.push(async () => {
      let url: string | null = null;
      try { url = await request(); } catch { /* Missing/protected shell icons use the letter fallback. */ }
      cache.set(key, url); inflight.delete(key); resolve(url);
      if (url && !key.startsWith("window:")) persistCache();
    });
  });
  inflight.set(key, result); pumpQueue(); return result;
}

export const loadIcon = (path: string): Promise<string | null> => requestIcon(path, () => api.icon(path));
export function forgetFailedIcons() { for (const [path, url] of cache) if (url === null) cache.delete(path); }
export function forgetClosedWindowIcons(handles: Set<number>) {
  for (const key of cache.keys()) if (key.startsWith("window:") && !handles.has(Number(key.slice(7)))) cache.delete(key);
}

function fill(holder: HTMLElement, name: string, url: string | null | undefined) {
  if (url) {
    const image = new Image(); image.src = url; image.alt = ""; image.draggable = false;
    image.decoding = "async";
    holder.replaceChildren(image);
  } else holder.replaceChildren(el("span", "fallback", [name.trim().charAt(0).toUpperCase() || "?"]));
}

export function iconElement(path: string, name: string): HTMLElement {
  const holder = el("span", "ico"); fill(holder, name, cache.get(path));
  if (!cache.has(path)) void loadIcon(path).then((url) => fill(holder, name, url));
  return holder;
}

export function windowIconElement(hwnd: number, fallbackPath: string, name: string): HTMLElement {
  const key = `window:${hwnd}`;
  const holder = el("span", "ico"); fill(holder, name, cache.get(key) || cache.get(fallbackPath));
  void requestIcon(key, () => api.windowIcon(hwnd)).then(async (url) => fill(holder, name, url || await loadIcon(fallbackPath)));
  return holder;
}
