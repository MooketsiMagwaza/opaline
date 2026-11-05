import { byId } from "../core/dom";
import * as groups from "./groups";
import { insertionIndexForPoint, isCentralDrop } from "./order";

type Dragged =
  | { kind: "item"; path: string; fromPane: boolean; layoutKey: string }
  | { kind: "group"; groupId: string; layoutKey: string };

let dragged: Dragged | null = null;
let layoutFrame = 0;

const directTiles = (container: HTMLElement): HTMLElement[] =>
  [...container.querySelectorAll<HTMLElement>(":scope > .tile")];

const tileKeys = (container: HTMLElement): string[] =>
  directTiles(container).map(tile => tile.dataset.layoutKey).filter((key): key is string => Boolean(key));

export const getLayoutKeys = (): string[] => tileKeys(byId("grid"));

function clearFeedback() {
  document.querySelectorAll(".drop-target, .insert-before, .insert-after")
    .forEach(node => node.classList.remove("drop-target", "insert-before", "insert-after"));
}

/** Shows a stable insertion slot without moving the grid beneath the pointer. */
function previewInsertion(container: HTMLElement, clientX: number, clientY: number, movingKey: string): number {
  const otherTiles = directTiles(container).filter(tile => tile.dataset.layoutKey !== movingKey);
  const index = insertionIndexForPoint(otherTiles.map(tile => tile.getBoundingClientRect()), clientX, clientY);
  const reference = otherTiles[index] ?? null;
  clearFeedback();
  if (reference) reference.classList.add("insert-before");
  else otherTiles[otherTiles.length - 1]?.classList.add("insert-after");
  return index;
}

function reorderedKeys(container: HTMLElement, movingKey: string, index: number): string[] {
  const keys = tileKeys(container).filter(key => key !== movingKey);
  keys.splice(Math.min(keys.length, Math.max(0, index)), 0, movingKey);
  return keys;
}

function nudgeScroll(scroller: HTMLElement, clientY: number) {
  const rect = scroller.getBoundingClientRect();
  const edge = Math.min(56, rect.height * 0.16);
  if (clientY < rect.top + edge) scroller.scrollTop -= 18;
  else if (clientY > rect.bottom - edge) scroller.scrollTop += 18;
}

function layoutOrderedTiles() {
  layoutFrame = 0;
  const grid = byId("grid");
  if (!grid.classList.contains("ordered")) return;
  const tiles = directTiles(grid);
  grid.style.removeProperty("height");
  tiles.map((tile, index) => ({ tile, index, saved: groups.positionOf(tile.dataset.layoutKey ?? "") }))
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

export function scheduleOrderedLayout() {
  cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(layoutOrderedTiles);
}

function endDrag() {
  dragged = null;
  document.body.classList.remove("dragging");
  clearFeedback();
  document.querySelectorAll(".lifted").forEach(node => node.classList.remove("lifted"));
}

function startDrag(tile: HTMLElement, value: Dragged, event: DragEvent) {
  dragged = value;
  event.dataTransfer?.setData("text/plain", value.layoutKey);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  document.body.classList.add("dragging");
  requestAnimationFrame(() => tile.classList.add("lifted"));
}

export function wireItemDrag(tile: HTMLElement, path: string, fromPane: boolean) {
  const layoutKey = groups.itemPositionKey(path);
  tile.draggable = true;
  tile.addEventListener("dragstart", event => startDrag(tile, { kind: "item", path, fromPane, layoutKey }, event));
  tile.addEventListener("dragend", endDrag);
}

export function wireGroupDrag(tile: HTMLElement, groupId: string) {
  const layoutKey = groups.groupPositionKey(groupId);
  tile.draggable = true;
  tile.addEventListener("dragstart", event => startDrag(tile, { kind: "group", groupId, layoutKey }, event));
  tile.addEventListener("dragend", endDrag);
}

export function wireDrop(tile: HTMLElement, onDrop: (path: string) => void, accept: (path: string) => boolean = () => true) {
  const acceptable = () => dragged?.kind === "item" && accept(dragged.path);
  const isTarget = (event: DragEvent) => acceptable() && isCentralDrop(tile.getBoundingClientRect(), event.clientX, event.clientY);
  tile.addEventListener("dragover", event => {
    if (!isTarget(event)) { tile.classList.remove("drop-target"); return; }
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    clearFeedback();
    tile.classList.add("drop-target");
  });
  tile.addEventListener("dragleave", () => tile.classList.remove("drop-target"));
  tile.addEventListener("drop", event => {
    if (!isTarget(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const path = (dragged as Extract<Dragged, { kind: "item" }>).path;
    endDrag();
    onDrop(path);
  });
}

export function wirePaneGrid(holder: HTMLElement, groupId: string, render: () => void) {
  const canReorder = () => dragged?.kind === "item" && dragged.fromPane && groups.groupOf(dragged.path)?.id === groupId;
  holder.addEventListener("dragover", event => {
    if (!canReorder() || !dragged) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    nudgeScroll(holder, event.clientY);
    previewInsertion(holder, event.clientX, event.clientY, dragged.layoutKey);
  });
  holder.addEventListener("drop", event => {
    if (!canReorder() || dragged?.kind !== "item") return;
    event.preventDefault();
    event.stopPropagation();
    const moving = dragged;
    const index = previewInsertion(holder, event.clientX, event.clientY, moving.layoutKey);
    endDrag();
    groups.reorderGroupItem(groupId, moving.path, index);
    render();
  });
}

export function initGridDrag(isSearching: () => boolean, render: () => void) {
  const grid = byId("grid");
  const layer = byId("popup-layer");
  grid.addEventListener("dragover", event => {
    if (!dragged || isSearching()) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    nudgeScroll(byId("grid-layer"), event.clientY);
    previewInsertion(grid, event.clientX, event.clientY, dragged.layoutKey);
  });
  grid.addEventListener("drop", event => {
    if (!dragged || isSearching()) return;
    event.preventDefault();
    const moving = dragged;
    const index = previewInsertion(grid, event.clientX, event.clientY, moving.layoutKey);
    if (moving.kind === "item" && moving.fromPane) groups.removeFromGroup(moving.path);
    const ordered = reorderedKeys(grid, moving.layoutKey, index);
    endDrag();
    groups.setLayoutOrder(ordered);
    render();
  });
  window.addEventListener("resize", scheduleOrderedLayout);

  const takeOut = () => dragged?.kind === "item" && dragged.fromPane;
  layer.addEventListener("dragover", event => {
    if (takeOut() && event.target === layer) { event.preventDefault(); clearFeedback(); }
  });
  layer.addEventListener("drop", event => {
    if (!takeOut() || event.target !== layer) return;
    event.preventDefault();
    const moving = dragged as Extract<Dragged, { kind: "item" }>;
    endDrag();
    groups.removeFromGroup(moving.path);
    groups.setLayoutOrder([...getLayoutKeys(), moving.layoutKey]);
    render();
  });
}
