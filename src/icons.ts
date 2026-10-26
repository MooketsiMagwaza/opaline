import { api } from "./api";
import { el } from "./dom";

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

export function loadIcon(path: string): Promise<string | null> {
  if (cache.has(path)) return Promise.resolve(cache.get(path) ?? null);

  const pending = inflight.get(path);
  if (pending) return pending;

  const request = api
    .icon(path)
    .catch(() => null)
    .then((url) => {
      cache.set(path, url);
      inflight.delete(path);
      return url;
    });
  inflight.set(path, request);
  return request;
}

/** Failed icons get another chance the next time the overlay opens. */
export function forgetFailedIcons() {
  for (const [path, url] of cache) if (url === null) cache.delete(path);
}

function fill(holder: HTMLElement, name: string, url: string | null | undefined) {
  if (url) {
    const image = new Image();
    image.src = url;
    image.alt = "";
    image.draggable = false;
    holder.replaceChildren(image);
  } else {
    holder.replaceChildren(el("span", "fallback", [name.trim().charAt(0).toUpperCase() || "?"]));
  }
}

/** An icon that shows from the cache at once and fills in when it arrives. */
export function iconElement(path: string, name: string): HTMLElement {
  const holder = el("span", "ico");
  fill(holder, name, cache.get(path));
  if (!cache.has(path)) void loadIcon(path).then((url) => fill(holder, name, url));
  return holder;
}
