import { api, type Item } from "../core/api";
import { byId, el } from "../core/dom";
import * as groups from "./groups";
import { iconElement } from "../core/icons";
import { hidePeek, wirePeek } from "./peek";
import { getLayoutKeys, initGridDrag, scheduleOrderedLayout, wireDrop, wireGroupDrag, wireItemDrag, wirePaneGrid } from "./drag";
import { type MenuEntry, showMenu } from "../core/menu";
import { settings } from "../settings/store";
import { workspaceMenu } from "./workspaces";

export { wirePeek } from "./peek";

type Entry = { kind: "group"; group: groups.Group } | { kind: "item"; item: Item };
export type QuickSort = "name-asc" | "name-desc" | "frequent";

let items: Item[] = [];
const known = new Map<string, Item>();
let query = "";
let statusHint = "";
let openId: string | null = null;
let popupReturnFocus: HTMLElement | null = null;
let popupClosingTimer: number | undefined;
let popupOpeningFrame = 0;

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

const entryName = (entry: Entry): string => entry.kind === "group" ? entry.group.name : entry.item.name;
const entryLaunches = (entry: Entry): number => entry.kind === "group"
  ? entry.group.items.reduce((total, path) => total + groups.launchCount(path), 0)
  : groups.launchCount(entry.item.path);
const entryLayoutKey = (entry: Entry): string => entry.kind === "group"
  ? groups.groupPositionKey(entry.group.id)
  : groups.itemPositionKey(entry.item.path);

function compareEntries(mode: QuickSort) {
  return (first: Entry, second: Entry) => {
    const names = entryName(first).localeCompare(entryName(second), undefined, { sensitivity: "base" });
    if (mode === "name-desc") return -names;
    if (mode === "frequent") return entryLaunches(second) - entryLaunches(first) || names;
    return names;
  };
}

/** One-shot Home ordering. Manual dragging remains available immediately afterwards. */
export function sortHome(mode: QuickSort) {
  const panes = groups.groups()
    .filter((group) => group.items.some((path) => known.has(path)))
    .map((group): Entry => ({ kind: "group", group }))
    .sort(compareEntries(mode));
  const loose = items
    .filter((item) => !groups.groupOf(item.path))
    .map((item): Entry => ({ kind: "item", item }))
    .sort(compareEntries(mode));
  const ordered = settings().groupsFirst ? [...panes, ...loose] : [...loose, ...panes];
  groups.setLayoutOrder(ordered.map(entryLayoutKey));
  render();
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

  if (!searching && list.length > 0) scheduleOrderedLayout();

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

  wireItemDrag(tile, item.path, paneId !== undefined);

  // dropping one loose tile on another makes a pane, like the Start menu
  if (paneId === undefined) {
    wireDrop(
      tile,
      (path) => {
        const oldKeys = getLayoutKeys();
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
  wireGroupDrag(tile, group.id);
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

  const holder = el("div", "pane-grid", members(group));
  wirePaneGrid(holder, group.id, render);
  byId("popup").replaceChildren(name, holder, el("div", "pane-actions", [ungroup]));
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
  initGridDrag(() => Boolean(query.trim()), render);

  layer.addEventListener("click", (event) => {
    if (event.target !== layer) return;
    event.stopPropagation();
    closePopup();
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
