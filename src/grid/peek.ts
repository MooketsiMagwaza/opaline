import type { Item } from "../core/api";
import { byId, clamp, el } from "../core/dom";
import { iconElement } from "../core/icons";
import { HoverGroup } from "../core/hover-intent";

// Only the first peek waits half a second; sweeping across neighbouring tiles then shows each one at once.
const peeks = new HoverGroup(500);
let timer: number | undefined;
let generation = 0;
let shown = false;

export function hidePeek() {
  window.clearTimeout(timer);
  generation++;
  byId("tile-peek").hidden = true;
  if (shown) { shown = false; peeks.closed(); }
}

/** Adds a delayed, read-only folder preview without changing the grid layout. */
export function wirePeek(tile: HTMLElement, title: string, readItems: () => Promise<Item[]>, count?: number) {
  const show = (delay: number) => {
    hidePeek();
    const request = generation;
    timer = window.setTimeout(async () => {
      let entries: Item[];
      try { entries = await readItems(); } catch { entries = []; }
      if (request !== generation || !tile.isConnected) return;

      const peek = byId("tile-peek");
      const rows = entries.slice(0, 6).map(item =>
        el("div", "peek-tile", [iconElement(item.path, item.name), el("span", "peek-name", [item.name])]),
      );
      const previewGrid = el("div", "peek-grid", rows);
      previewGrid.style.setProperty("--peek-columns", String(rows.length <= 2 ? Math.max(1, rows.length) : rows.length <= 4 ? 2 : 3));
      const hasMore = count ? count > 6 : entries.length > 6;
      peek.replaceChildren(
        el("strong", "peek-title", [title]),
        ...(rows.length ? [previewGrid] : [el("span", "peek-empty", ["Empty or unavailable"])]),
        ...(hasMore ? [el("span", "peek-more", ["More inside…"])] : []),
      );
      peek.hidden = false;
      shown = true;
      peeks.opened();

      const anchor = tile.getBoundingClientRect();
      const box = peek.getBoundingClientRect();
      peek.style.left = `${clamp(anchor.left + anchor.width / 2 - box.width / 2, 12, innerWidth - box.width - 12)}px`;
      peek.style.top = `${anchor.bottom + box.height + 16 < innerHeight ? anchor.bottom + 10 : Math.max(12, anchor.top - box.height - 10)}px`;
    }, delay);
  };

  tile.addEventListener("pointerenter", () => show(peeks.delay));
  tile.addEventListener("pointerleave", hidePeek);
  tile.addEventListener("focus", () => show(0));
  tile.addEventListener("blur", hidePeek);
  tile.addEventListener("click", hidePeek);
  tile.addEventListener("dragstart", hidePeek);
}
