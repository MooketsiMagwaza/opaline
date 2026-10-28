import { api, type AppEntry, type Item } from "./api";
import { byId, el } from "./dom";
import * as grid from "./grid";
import { iconElement } from "./icons";
import { closeMenu, showMenu } from "./menu";
import { settings, updateSettings } from "./settings";
import { onWorkspacesChange, reportWorkspaceError, unpinItem, workspaceMenu, workspaces } from "./workspaces";
import { initUsage, refreshUsage, renderUsage, setUsageQuery } from "./usage";
import { refreshFocus } from "./focus";
import { refreshPanel } from "./panel";
import { itemPicker } from "./item-picker";

let current = "desktop";
let homeScreen = 0;
let apps: AppEntry[] = [];
let appsReady = false;
let query = "";
let usageTimer: number | undefined;

const pages = () => [
  { id: "desktop", label: "Home", surface: "apps-surface" },
  { id: "all-apps", label: "All apps", surface: "app-list-surface" },
  { id: "screen-time", label: "Screen time", surface: "screen-time-surface" },
  { id: "focus", label: "Focus", surface: "focus-surface" },
  { id: "settings", label: "Settings", surface: "settings-surface" },
];
const activeWorkspace = () => workspaces()[homeScreen - 1];
function renderHomePages() {
  for (const host of [byId("home-pages"), byId("workspace-pages")]) {
    host.replaceChildren(...["Desktop", ...workspaces().map(space => space.name)].map((name, index) => {
      const button = el("button", "home-page-button");
      button.type = "button";
      button.title = name;
      button.setAttribute("aria-label", `Home screen ${index + 1}: ${name}`);
      button.setAttribute("aria-current", homeScreen === index ? "page" : "false");
      button.addEventListener("click", () => { homeScreen = index; show("desktop"); });
      return button;
    }));
  }
}

function appButton(item: AppEntry & Partial<Pick<Item, "isFolder">>, spaceId?: string): HTMLElement {
  const open = el("button", "app-list-item", [iconElement(item.path, item.name), el("span", "app-list-name", [item.name])]);
  open.type = "button";
  open.title = item.name;
  if (item.isFolder) { open.removeAttribute("title"); grid.wirePeek(open, item.name, () => api.folderPreview(item.path)); }
  open.addEventListener("click", () => grid.launchItem(item.path));
  const menu = spaceId ? [{ label: "Remove from screen", action: () => { void unpinItem(spaceId, item.path).catch(reportWorkspaceError); } }]
    : [workspaceMenu({ ...item, isFolder: false })];
  const more = el("button", "item-more", ["•••"]);
  more.type = "button";
  more.setAttribute("aria-label", `Options for ${item.name}`);
  const options = (event: MouseEvent) => { event.preventDefault(); showMenu(event.clientX, event.clientY, menu); };
  more.addEventListener("click", options);
  open.addEventListener("contextmenu", options);
  return el("div", "library-row", [open, more]);
}

function renderList() {
  const needle = query.trim().toLocaleLowerCase();
  const matches = apps.filter((item) => item.name.toLocaleLowerCase().includes(needle))
    .sort((a, b) => Number(!a.name.toLocaleLowerCase().startsWith(needle)) - Number(!b.name.toLocaleLowerCase().startsWith(needle)) || a.name.localeCompare(b.name));
  const empty = appsReady ? (query ? `Nothing matches “${query}”` : "No applications found") : "Loading installed applications…";
  byId("app-list").replaceChildren(...(matches.length ? matches.map((item) => appButton(item)) : [el("p", "page-empty", [empty])]));
  byId("app-list-count").textContent = appsReady ? `${matches.length} apps` : "Loading";
}

function renderWorkspace() {
  const space = activeWorkspace();
  if (!space) return;
  byId("workspace-title").textContent = space.name;
  byId("workspace-add-trigger").hidden = space.items.length === 0;
  const matches = space.items.filter((item) => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  byId("workspace-items").replaceChildren(...(matches.length ? matches.map((item) => appButton(item, space.id)) : [
    query ? el("p", "page-empty", [`Nothing matches “${query}”`]) : emptyWorkspace(space.id),
  ]));
}

function emptyWorkspace(workspaceId: string) {
  const add = el("button", "chip", ["Add an app or folder"]);
  add.type = "button";
  add.addEventListener("click", () => itemPicker.open(workspaceId));
  return el("div", "workspace-empty", [el("span", "workspace-empty-mark", ["+"]), el("strong", "", ["Make this screen yours"]), el("p", "", ["Search installed Windows apps or choose a folder or file."]), add]);
}

function renderNav() {
  byId("page-edges").setAttribute("aria-label", "Home screen navigation");
  document.querySelectorAll<HTMLButtonElement>(".header-nav [data-page]").forEach(button => {
    button.setAttribute("aria-current", button.dataset.page === current ? "page" : "false");
  });
  byId("home-dock").setAttribute("aria-current", current === "desktop" ? "page" : "false");
  renderHomePages();
}

export function show(id: string, focus = true) {
  const next = pages().find((page) => page.id === id) ?? pages()[0];
  closeMenu(); grid.reset();
  current = next.id;
  document.body.dataset.page = current === "desktop" && homeScreen > 0 ? "custom-screen" : current;
  itemPicker.close();
  const surface = current === "desktop" && homeScreen > 0 ? "workspace-surface" : next.surface;
  for (const id of ["apps-surface", "workspace-surface", "app-list-surface", "screen-time-surface", "focus-surface", "settings-surface"]) byId(id).hidden = surface !== id;
  renderNav(); renderWorkspace();
  if (current === "desktop") grid.setQuery(query);
  if (current === "all-apps") renderList();
  if (current === "screen-time") { renderUsage(); void refreshUsage(); }
  if (current === "focus") refreshFocus();
  if (current === "settings") refreshPanel();
  byId<HTMLInputElement>("search").placeholder = `Search ${next.label.toLocaleLowerCase()}`;
  if (focus) byId("search").focus();
}

export function cycle(direction = 1) {
  const list = pages();
  show(list[(list.findIndex((page) => page.id === current) + direction + list.length) % list.length].id);
}
export function selectPage(index: number): boolean {
  const id = pages()[index]?.id;
  if (!id) return false;
  if (id === "desktop") homeScreen = 0;
  show(id); return true;
}
export function isHome() { return current === "desktop"; }
export function cycleHome(direction = 1) {
  homeScreen = (homeScreen + direction + workspaces().length + 1) % (workspaces().length + 1);
  show("desktop");
}
export function toggleBar() { updateSettings({ compactBar: !settings().compactBar }); }
export function setApps(next: AppEntry[]) { apps = [...next]; appsReady = true; itemPicker.setApps(next); if (current === "all-apps") renderList(); }
export function setQuery(next: string) { query = next; if (current === "desktop" && homeScreen === 0) grid.setQuery(next); if (current === "all-apps") renderList(); renderWorkspace(); setUsageQuery(next); }
export function reset() { query = ""; homeScreen = 0; show("desktop"); }
export function activateFirst(): boolean {
  if (current === "desktop" && homeScreen === 0) return false;
  if (current === "all-apps" || (current === "desktop" && homeScreen > 0)) byId(current === "all-apps" ? "app-list" : "workspace-items").querySelector<HTMLButtonElement>(".app-list-item")?.click();
  return true;
}
export function handleArrow(event: KeyboardEvent): boolean {
  if (current === "desktop" && homeScreen === 0 || current === "screen-time" || current === "focus" || current === "settings") return false;
  const holder = byId(current === "all-apps" ? "app-list" : "workspace-items");
  const buttons = [...holder.querySelectorAll<HTMLButtonElement>(".app-list-item")];
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (document.activeElement === byId("search") && event.key === "ArrowDown") { buttons[0]?.focus(); return buttons.length > 0; }
  if (index < 0) return false;
  const columns = Math.max(1, [...holder.children].filter((row) => (row as HTMLElement).offsetTop === (holder.firstElementChild as HTMLElement)?.offsetTop).length);
  const delta = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns } as Record<string, number>)[event.key];
  if (!delta) return false;
  if (index + delta < 0) byId("search").focus();
  else buttons[Math.min(buttons.length - 1, index + delta)]?.focus();
  return true;
}
export function startPages() {
  stopPages();
  usageTimer = window.setInterval(() => { if (current === "screen-time") void refreshUsage(); }, 5000);
}
export function stopPages() { window.clearInterval(usageTimer); usageTimer = undefined; }
export function initPages() {
  itemPicker.init();
  byId("workspace-add-trigger").addEventListener("click", () => { const space = activeWorkspace(); if (space) itemPicker.open(space.id); });
  byId("page-prev").addEventListener("click", () => cycleHome(-1));
  byId("page-next").addEventListener("click", () => cycleHome(1));
  document.querySelectorAll<HTMLButtonElement>(".header-nav [data-page]").forEach(button => button.addEventListener("click", () => show(button.dataset.page!)));
  byId("home-dock").addEventListener("click", () => { homeScreen = 0; show("desktop"); });
  initUsage();
  onWorkspacesChange(() => {
    if (homeScreen > workspaces().length) { homeScreen = 0; show("desktop", false); }
    else { renderNav(); renderWorkspace(); }
  });
  show("desktop");
}
