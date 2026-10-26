import type { AppEntry } from "./api";
import { byId, el } from "./dom";
import * as grid from "./grid";
import { iconElement } from "./icons";

const PAGES = [
  { id: "apps-surface", label: "Home" },
  { id: "app-list-surface", label: "All apps" },
] as const;

let current = 0;
let apps: AppEntry[] = [];
let appsReady = false;
let query = "";

function appRows(): HTMLElement[] {
  const needle = query.trim().toLocaleLowerCase();
  return apps
    .filter((item) => !needle || item.name.toLocaleLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    .map((item) => {
      const button = el("button", "app-list-item", [iconElement(item.path, item.name), el("span", "app-list-name", [item.name])]);
      button.type = "button";
      button.title = item.name;
      button.addEventListener("click", () => grid.launchItem(item.path));
      return button;
    });
}

function renderList() {
  const list = byId("app-list");
  const rows = appRows();
  const empty = appsReady ? (query ? `Nothing matches “${query}”` : "No applications found") : "Loading installed applications…";
  list.replaceChildren(...(rows.length ? rows : [el("p", "page-empty", [empty])]));
  byId("app-list-count").textContent = appsReady ? `${rows.length} app${rows.length === 1 ? "" : "s"}` : "Loading";
}

function show(index: number) {
  current = (index + PAGES.length) % PAGES.length;
  PAGES.forEach((page, pageIndex) => {
    byId(page.id).hidden = pageIndex !== current;
  });
  byId("page-label").textContent = PAGES[current].label;
  byId("page-dots").textContent = PAGES.map((_, index) => (index === current ? "●" : "○")).join(" ");
  byId("page-prev").setAttribute("aria-label", `Previous page, ${PAGES[(current - 1 + PAGES.length) % PAGES.length].label}`);
  byId("page-next").setAttribute("aria-label", `Next page, ${PAGES[(current + 1) % PAGES.length].label}`);
}

export function setApps(next: AppEntry[]) {
  apps = [...next];
  appsReady = true;
  renderList();
}

export function setQuery(next: string) {
  query = next;
  renderList();
}

export function reset() {
  query = "";
  show(0);
}

export function activateFirst(): boolean {
  if (current !== 1) return false;
  byId("app-list").querySelector<HTMLButtonElement>(".app-list-item")?.click();
  return true;
}

export function initPages() {
  byId("page-prev").addEventListener("click", () => show(current - 1));
  byId("page-next").addEventListener("click", () => show(current + 1));
  show(0);
  renderList();
}
