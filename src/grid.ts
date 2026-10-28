import { api, type Item } from "./api";
import { byId, clamp, el } from "./dom";
import * as groups from "./groups";
import { iconElement } from "./icons";
import { type MenuEntry, showMenu } from "./menu";
import { settings } from "./settings";
import { workspaceMenu } from "./workspaces";

type Entry = { kind: "group"; group: groups.Group } | { kind: "item"; item: Item };
type Dragged =
  | { kind: "item"; path: string; fromPane: boolean; layoutKey: string }
  | { kind: "group"; groupId: string; layoutKey: string };

let items: Item[] = [];
const known = new Map<string, Item>();
let query = "";
let statusHint = "";
let openId: string | null = null;
let popupReturnFocus: HTMLElement | null = null;
let dragged: Dragged | null = null;
let layoutFrame = 0;
let popupClosingTimer: number | undefined;
let popupOpeningFrame = 0;
let peekTimer: number | undefined;
let peekGeneration = 0;

function hidePeek() {
  window.clearTimeout(peekTimer);
  peekGeneration++;
  byId("tile-peek").hidden = true;
}

export function wirePeek(tile: HTMLElement, title: string, items: () => Promise<Item[]>, count?: number) {
  const show = (delay: number) => {
    hidePeek();
    const generation = peekGeneration;
    peekTimer = window.setTimeout(async () => {
      let entries: Item[];
      try { entries = await items(); } catch { entries = []; }
      if (generation !== peekGeneration || !tile.isConnected) return;
      const peek = byId("tile-peek");
      const rows = entries.slice(0, 6).map(item => el("div", "peek-tile", [iconElement(item.path, item.name), el("span", "peek-name", [item.name])]));
      const previewGrid = el("div", "peek-grid", rows);
      previewGrid.style.setProperty("--peek-columns", String(rows.length <= 2 ? Math.max(1, rows.length) : rows.length <= 4 ? 2 : 3));
      const more = count ? count > 6 : entries.length > 6;
      peek.replaceChildren(el("strong", "peek-title", [title]), ...(rows.length ? [previewGrid] : [el("span", "peek-empty", ["Empty or unavailable"])]), ...(more ? [el("span", "peek-more", ["More inside…"])] : []));
      peek.hidden = false;
      const anchor = tile.getBoundingClientRect();
      const box = peek.getBoundingClientRect();
      peek.style.left = `${clamp(anchor.left + anchor.width / 2 - box.width / 2, 12, innerWidth - box.width - 12)}px`;
      peek.style.top = `${anchor.bottom + box.height + 16 < innerHeight ? anchor.bottom + 10 : Math.max(12, anchor.top - box.height - 10)}px`;
    }, delay);
  };
  tile.addEventListener("pointerenter", () => show(500));
  tile.addEventListener("pointerleave", hidePeek);
  tile.addEventListener("focus", () => show(0));
  tile.addEventListener("blur", hidePeek);
  tile.addEventListener("click", hidePeek);
  tile.addEventListener("dragstart", hidePeek);
}

export const allItems = (): Item[] => items;
export const isPopupOpen = (): boolean => openId !== null;

export function setItems(next: Item[]) {
  items = next;
  known.clear();
  for (const item of next) known.set(item.path, item);
}

export function setStatusHint(hint: string) {
  statusHint = hint;
}

export function setQuery(next: string) {
  query = next;
  render();
}

/** Back to the plain grid: no search, no open pane. Used every time the overlay opens. */
export function reset() {
  hidePeek();
  window.clearTimeout(popupClosingTimer);
  cancelAnimationFrame(popupOpeningFrame);
  query = "";
  openId = null;
  popupReturnFocus = null;
  byId("popup-layer").hidden = true;
  const popup = byId("popup");
  popup.classList.remove("open");
  popup.replaceChildren();
  popup.style.removeProperty("transform-origin");
  document.body.classList.remove("popup-open");
}

const byName = (a: Item, b: Item) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

function entries(): Entry[] {
  const q = query.trim().toLowerCase();

  if (q) {
    // searching flattens the panes: members show up as ordinary results
    const startsWith = (name: string) => (name.toLowerCase().startsWith(q) ? 0 : 1);
    const panes = groups
      .groups()
      .filter((group) => group.name.toLowerCase().includes(q))
      .map((group): Entry => ({ kind: "group", group }));
    const matches = items
      .filter((item) => item.name.toLowerCase().includes(q))
      .sort((a, b) => startsWith(a.name) - startsWith(b.name) || byName(a, b))
      .map((item): Entry => ({ kind: "item", item }));
    return [...panes, ...matches];
  }

  const panes = groups
    .groups()
    .filter((group) => group.items.some((path) => known.has(path)))
    .map((group): Entry => ({ kind: "group", group }));

  const loose = items.filter((item) => !groups.groupOf(item.path));
  if (settings().sortBy === "frequent") {
    loose.sort((a, b) => groups.launchCount(b.path) - groups.launchCount(a.path) || byName(a, b));
  }
  const looseEntries = loose.map((item): Entry => ({ kind: "item", item }));

  return settings().groupsFirst ? [...panes, ...looseEntries] : [...looseEntries, ...panes];
}

export function render() {
  hidePeek();
  const list = entries();
  const grid = byId("grid");
  const searching = query.trim().length > 0;
  grid.classList.toggle("ordered", !searching);
  grid.classList.toggle("searching", searching);
  if (searching) grid.style.removeProperty("height");

  if (list.length === 0) {
    grid.replaceChildren(el("p", "empty", [query ? `Nothing matches “${query}”` : "Nothing on your Desktop yet"]));
  } else {
    grid.replaceChildren(...list.map((entry) => (entry.kind === "group" ? paneTile(entry.group) : itemTile(entry.item))));
  }

  cancelAnimationFrame(layoutFrame);
  if (!searching && list.length > 0) layoutFrame = requestAnimationFrame(layoutOrderedTiles);

  const summary = query
    ? `${list.length} result${list.length === 1 ? "" : "s"}`
    : `${items.length} items  ·  ${groups.groups().length} panes`;
  byId("status").textContent = statusHint ? `${summary}  ·  ${statusHint}` : summary;

  if (openId) refreshPopup();
}

// ---------- launching ----------

export function launchItem(path: string) {
  groups.bumpLaunch(path);
  void api.launch(path);
}

/** Enter in the search box: open the top result. */
export function activateFirst() {
  const first = entries()[0];
  if (!first) return;
  if (first.kind === "group") openGroup(first.group.id);
  else launchItem(first.item.path);
}

// ---------- drag and drop ----------

function layoutKeys(): string[] {
  return [...byId("grid").querySelectorAll<HTMLElement>(":scope > .tile")]
    .map((tile) => tile.dataset.layoutKey)
    .filter((key): key is string => Boolean(key));
}

function insertionIndex(clientX: number, clientY: number, movingKey: string): number {
  const tiles = [...byId("grid").querySelectorAll<HTMLElement>(":scope > .tile")].filter(
    (tile) => tile.dataset.layoutKey !== movingKey,
  );
  const before = tiles.findIndex((tile) => {
    const rect = tile.getBoundingClientRect();
    const middleY = rect.top + rect.height / 2;
    const sameRow = clientY >= rect.top && clientY <= rect.bottom;
    return clientY < middleY || (sameRow && clientX < rect.left + rect.width / 2);
  });
  return before < 0 ? tiles.length : before;
}

function reorderedKeys(movingKey: string, index: number): string[] {
  const keys = layoutKeys().filter((key) => key !== movingKey);
  keys.splice(Math.min(keys.length, Math.max(0, index)), 0, movingKey);
  return keys;
}

function layoutOrderedTiles() {
  layoutFrame = 0;
  const grid = byId("grid");
  if (!grid.classList.contains("ordered")) return;

  const tiles = [...grid.querySelectorAll<HTMLElement>(":scope > .tile")];
  grid.style.removeProperty("height");
  tiles
    .map((tile, index) => ({ tile, index, saved: groups.positionOf(tile.dataset.layoutKey ?? "") }))
    .sort((a, b) => {
      if (!a.saved && !b.saved) return a.index - b.index;
      if (!a.saved) return 1;
      if (!b.saved) return -1;
      return a.saved.y - b.saved.y || a.saved.x - b.saved.x || a.index - b.index;
    })
    .forEach(({ tile }) => {
      tile.style.removeProperty("left");
      tile.style.removeProperty("top");
      grid.append(tile);
    });
}

function endDrag() {
  dragged = null;
  document.body.classList.remove("dragging");
  document.querySelectorAll(".drop-target, .lifted").forEach((node) => node.classList.remove("drop-target", "lifted"));
}

function startDrag(tile: HTMLElement, value: Dragged, event: DragEvent) {
  dragged = value;
  event.dataTransfer?.setData("text/plain", value.layoutKey);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  document.body.classList.add("dragging");
  requestAnimationFrame(() => tile.classList.add("lifted"));
}

function wireDrag(tile: HTMLElement, path: string, fromPane: boolean) {
  const layoutKey = groups.itemPositionKey(path);
  tile.draggable = true;
  tile.addEventListener("dragstart", (event) => {
    startDrag(tile, { kind: "item", path, fromPane, layoutKey }, event);
  });
  tile.addEventListener("dragend", endDrag);
}

function wirePaneDrag(tile: HTMLElement, groupId: string) {
  const layoutKey = groups.groupPositionKey(groupId);
  tile.draggable = true;
  tile.addEventListener("dragstart", (event) => startDrag(tile, { kind: "group", groupId, layoutKey }, event));
  tile.addEventListener("dragend", endDrag);
}

function wireDrop(tile: HTMLElement, onDrop: (path: string) => void, accept: (path: string) => boolean = () => true) {
  const acceptable = () => dragged?.kind === "item" && accept(dragged.path);

  const over = (event: DragEvent) => {
    if (!acceptable()) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    tile.classList.add("drop-target");
  };

  tile.addEventListener("dragenter", over);
  tile.addEventListener("dragover", over);
  tile.addEventListener("dragleave", () => tile.classList.remove("drop-target"));
  tile.addEventListener("drop", (event) => {
    if (!acceptable()) return;
    event.preventDefault();
    event.stopPropagation();

    const path = (dragged as Extract<Dragged, { kind: "item" }>).path;
    endDrag();
    onDrop(path);
  });
}

// ---------- tiles ----------

function itemTile(item: Item, paneId?: string): HTMLElement {
  const tile = el("button", "tile item-tile", [iconElement(item.path, item.name), el("span", "label", [item.name])]);
  tile.type = "button";
  if (!item.isFolder) tile.title = item.name;
  tile.setAttribute("aria-label", item.name);
  tile.dataset.path = item.path;
  tile.dataset.layoutKey = groups.itemPositionKey(item.path);
  if (item.isFolder) wirePeek(tile, item.name, () => api.folderPreview(item.path));

  tile.addEventListener("click", () => launchItem(item.path));
  tile.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showMenu(event.clientX, event.clientY, itemMenu(item));
  });

  wireDrag(tile, item.path, paneId !== undefined);

  // dropping one loose tile on another makes a pane, like the Start menu
  if (paneId === undefined) {
    wireDrop(
      tile,
      (path) => {
        const oldKeys = layoutKeys();
        const targetIndex = Math.max(0, oldKeys.indexOf(groups.itemPositionKey(item.path)));
        const group = groups.createGroup("New pane", [item.path, path]);
        const replaced = oldKeys.filter((key) => key !== groups.itemPositionKey(item.path) && key !== groups.itemPositionKey(path));
        replaced.splice(Math.min(targetIndex, replaced.length), 0, groups.groupPositionKey(group.id));
        groups.setLayoutOrder(replaced);
        render();
        openGroup(group.id, { rename: true });
      },
      (path) => path !== item.path,
    );
  }
  return tile;
}

function paneTile(group: groups.Group): HTMLElement {
  const members = group.items.filter((path) => known.has(path)).slice(0, 9);
  const minis = el(
    "span",
    members.length > 4 ? "minis n9" : "minis n4",
    members.map((path) => iconElement(path, known.get(path)!.name)),
  );

  const tile = el("button", "tile pane-tile", [minis, el("span", "label", [group.name])]);
  tile.type = "button";
  tile.setAttribute("aria-label", group.name);
  tile.dataset.id = group.id;
  tile.dataset.layoutKey = groups.groupPositionKey(group.id);
  wirePeek(tile, group.name, async () => group.items.map(path => known.get(path)).filter((item): item is Item => Boolean(item)), group.items.length);

  tile.addEventListener("click", () => openGroup(group.id, { from: tile }));
  tile.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showMenu(event.clientX, event.clientY, paneMenu(group));
  });

  wireDrop(tile, (path) => {
    groups.addToGroup(group.id, path);
    render();
  });
  wirePaneDrag(tile, group.id);
  return tile;
}

// ---------- menus ----------

function newPaneWith(path: string) {
  const group = groups.createGroup("New pane", [path]);
  render();
  openGroup(group.id, { rename: true });
}

function itemMenu(item: Item): MenuEntry[] {
  const current = groups.groupOf(item.path);
  const targets = groups
    .groups()
    .filter((group) => group.id !== current?.id)
    .map(
      (group): MenuEntry => ({
        label: group.name,
        action: () => {
          groups.addToGroup(group.id, item.path);
          render();
        },
      }),
    );

  const menu: MenuEntry[] = [
    { label: "Open", action: () => launchItem(item.path) },
    workspaceMenu(item),
    { label: "Open file location", action: () => void api.reveal(item.path) },
    { label: "Copy path", action: () => void navigator.clipboard.writeText(item.path).catch(() => {}) },
    { separator: true },
    {
      label: "Add to pane",
      items: [
        ...targets,
        ...(targets.length ? [{ separator: true } as MenuEntry] : []),
        { label: "New pane…", action: () => newPaneWith(item.path) },
      ],
    },
  ];

  const positionKey = groups.itemPositionKey(item.path);
  if (groups.positionOf(positionKey)) {
    menu.push({
      label: "Return to automatic order",
      action: () => {
        groups.forgetPosition(positionKey);
        render();
      },
    });
  }

  if (current) {
    menu.push({
      label: `Remove from “${current.name}”`,
      action: () => {
        groups.removeFromGroup(item.path);
        render();
      },
    });
  }
  return menu;
}

function paneMenu(group: groups.Group): MenuEntry[] {
  const menu: MenuEntry[] = [
    { label: "Open", action: () => openGroup(group.id) },
    { label: "Rename", action: () => openGroup(group.id, { rename: true }) },
  ];

  const positionKey = groups.groupPositionKey(group.id);
  if (groups.positionOf(positionKey)) {
    menu.push({
      label: "Return to automatic order",
      action: () => {
        groups.forgetPosition(positionKey);
        render();
      },
    });
  }

  menu.push(
    { separator: true },
    {
      label: "Ungroup",
      action: () => {
        groups.ungroup(group.id);
        if (openId === group.id) closePopup();
        render();
      },
    },
  );
  return menu;
}

// ---------- pane popup ----------

function members(group: groups.Group): HTMLElement[] {
  return group.items.filter((path) => known.has(path)).map((path) => itemTile(known.get(path)!, group.id));
}

function buildPopup(group: groups.Group) {
  const name = el("input", "pane-name");
  name.value = group.name;
  name.maxLength = 40;
  name.spellcheck = false;
  name.setAttribute("aria-label", "Pane name");
  name.addEventListener("change", () => {
    groups.renameGroup(group.id, name.value);
    name.value = groups.groups().find((candidate) => candidate.id === group.id)?.name ?? name.value;
    render();
  });
  name.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      name.blur();
    }
  });

  const ungroup = el("button", "chip", ["Ungroup"]);
  ungroup.type = "button";
  ungroup.addEventListener("click", () => {
    groups.ungroup(group.id);
    closePopup();
    render();
  });

  byId("popup").replaceChildren(name, el("div", "pane-grid", members(group)), el("div", "pane-actions", [ungroup]));
}

/** Rebuilds just the members, so a name being typed keeps its focus. */
function refreshPopup() {
  const group = groups.groups().find((candidate) => candidate.id === openId);
  const holder = byId("popup").querySelector<HTMLElement>(".pane-grid");

  if (!group || !holder || !group.items.some((path) => known.has(path))) {
    closePopup();
    return;
  }
  holder.replaceChildren(...members(group));
}

export function openGroup(id: string, options: { rename?: boolean; from?: HTMLElement } = {}) {
  const group = groups.groups().find((candidate) => candidate.id === id);
  if (!group) return;

  window.clearTimeout(popupClosingTimer);
  cancelAnimationFrame(popupOpeningFrame);
  const source = options.from ?? document.querySelector<HTMLElement>(`.pane-tile[data-id="${CSS.escape(id)}"]`);
  // Measure before the Home surface steps back; that transform would shift the source geometry.
  const sourceRect = source?.getBoundingClientRect();
  openId = id;
  buildPopup(group);

  const layer = byId("popup-layer");
  const panel = byId("popup");
  layer.hidden = false;
  document.body.classList.add("popup-open");

  // grow out of the tile it was opened from, like an iOS folder
  popupReturnFocus = source ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  panel.classList.add("measuring", "initial");
  const destination = panel.getBoundingClientRect();
  panel.style.setProperty("--pane-from-x", sourceRect ? `${sourceRect.left + sourceRect.width / 2 - destination.left - destination.width / 2}px` : "0px");
  panel.style.setProperty("--pane-from-y", sourceRect ? `${sourceRect.top + sourceRect.height / 2 - destination.top - destination.height / 2}px` : "0px");
  panel.style.setProperty("--pane-from-scale", sourceRect ? String(Math.min(sourceRect.width / destination.width, sourceRect.height / destination.height)) : ".35");
  panel.classList.remove("open");
  panel.classList.remove("measuring");
  void panel.offsetWidth;
  popupOpeningFrame = requestAnimationFrame(() => { panel.classList.remove("initial"); panel.classList.add("open"); });

  if (options.rename) {
    const input = panel.querySelector<HTMLInputElement>(".pane-name")!;
    input.focus();
    input.select();
  } else panel.querySelector<HTMLButtonElement>(".tile")?.focus();
}

export function closePopup() {
  if (openId === null) return;

  openId = null;
  cancelAnimationFrame(popupOpeningFrame);
  const popup = byId("popup");
  popup.classList.remove("open");
  document.body.classList.remove("popup-open");
  const duration = settings().animations && !matchMedia("(prefers-reduced-motion: reduce)").matches ? settings().paneMotionMs : 0;
  popupClosingTimer = window.setTimeout(() => {
    if (openId !== null) return;
    byId("popup-layer").hidden = true;
    popup.replaceChildren();
    popup.style.removeProperty("transform-origin");
    if (popupReturnFocus?.isConnected) popupReturnFocus.focus();
    popupReturnFocus = null;
  }, duration);
}

/** Wires the popup backdrop: click to close, drop a member on it to take it out of the pane. */
export function initGrid() {
  const layer = byId("popup-layer");
  const grid = byId("grid");

  grid.addEventListener("dragover", (event) => {
    if (!dragged || query.trim()) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  });
  grid.addEventListener("drop", (event) => {
    if (!dragged || query.trim()) return;
    event.preventDefault();

    const moving = dragged;
    if (moving.kind === "item" && moving.fromPane) groups.removeFromGroup(moving.path);
    groups.setLayoutOrder(reorderedKeys(moving.layoutKey, insertionIndex(event.clientX, event.clientY, moving.layoutKey)));
    endDrag();
    render();
  });

  window.addEventListener("resize", () => {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(layoutOrderedTiles);
  });

  layer.addEventListener("click", (event) => {
    if (event.target !== layer) return;
    event.stopPropagation();
    closePopup();
  });

  const takeOut = () => dragged?.kind === "item" && dragged.fromPane;
  layer.addEventListener("dragover", (event) => {
    if (takeOut() && event.target === layer) event.preventDefault();
  });
  layer.addEventListener("drop", (event) => {
    if (!takeOut() || event.target !== layer) return;
    event.preventDefault();

    const moving = dragged as Extract<Dragged, { kind: "item" }>;
    const path = moving.path;
    endDrag();
    groups.removeFromGroup(path);
    groups.setLayoutOrder([...layoutKeys(), moving.layoutKey]);
    render();
  });
}

// ---------- keyboard ----------

export function focusFirstTile(): boolean {
  const scope = openId ? byId("popup") : byId("grid");
  const first = scope.querySelector<HTMLElement>(".tile");
  first?.focus();
  return first !== undefined && first !== null;
}

/** Arrow keys move through tiles. Returns true when the key was used. */
export function handleArrow(event: KeyboardEvent): boolean {
  if (byId("apps-surface").hidden && !openId) return false;
  const active = document.activeElement as HTMLElement | null;
  const search = byId("search");

  if (active === search) {
    if (event.key !== "ArrowDown") return false;
    return focusFirstTile();
  }
  if (!active?.classList.contains("tile")) return false;

  const scope = active.parentElement!;
  const tiles = [...scope.querySelectorAll<HTMLElement>(".tile")];
  const index = tiles.indexOf(active);
  if (index < 0) return false;

  const firstTop = tiles[0].offsetTop;
  const columns = Math.max(1, tiles.filter((tile) => tile.offsetTop === firstTop).length);
  const steps: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
  const step = steps[event.key];
  if (step === undefined) return false;

  const next = index + step;
  if (next < 0) return true;
  tiles[Math.min(next, tiles.length - 1)].focus();
  return true;
}
