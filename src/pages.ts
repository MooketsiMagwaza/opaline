import { api, type AppEntry, type Item } from "./api";
import { byId, el } from "./dom";
import * as grid from "./grid";
import { iconElement } from "./icons";
import { closeMenu, showMenu } from "./menu";
import { settings, updateSettings } from "./settings";
import { onWorkspacesChange, pinItem, reportWorkspaceError, unpinItem, workspaceMenu, workspaces } from "./workspaces";
import { initUsage, refreshUsage, renderUsage, setUsageQuery } from "./usage";
import { refreshFocus } from "./focus";

let current = "desktop";
let apps: AppEntry[] = [];
let appsReady = false;
let query = "";
let usageTimer: number | undefined;

const pages = () => [
  { id: "desktop", label: "Desktop", surface: "apps-surface" },
  ...workspaces().map((space) => ({ id: space.id, label: space.name, surface: "workspace-surface" })),
  { id: "all-apps", label: "All apps", surface: "app-list-surface" },
  { id: "screen-time", label: "Screen time", surface: "screen-time-surface" },
  { id: "focus", label: "Focus", surface: "focus-surface" },
];

function appButton(item: AppEntry & Partial<Pick<Item, "isFolder">>, spaceId?: string): HTMLElement {
  const open = el("button", "app-list-item", [iconElement(item.path, item.name), el("span", "app-list-name", [item.name])]);
  open.type = "button";
  open.title = item.name;
  if (item.isFolder) { open.removeAttribute("title"); grid.wirePeek(open, item.name, () => api.folderPreview(item.path)); }
  open.addEventListener("click", () => grid.launchItem(item.path));
  const menu = spaceId ? [{ label: "Remove from workspace", action: () => { void unpinItem(spaceId, item.path).catch(reportWorkspaceError); } }]
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
  const space = workspaces().find((space) => space.id === current);
  if (!space) return;
  byId("workspace-title").textContent = space.name;
  const matches = space.items.filter((item) => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  byId("workspace-count").textContent = `${matches.length} items · Alt+${workspaces().indexOf(space) + 2}`;
  byId("workspace-items").replaceChildren(...(matches.length ? matches.map((item) => appButton(item, space.id)) : [
    el("p", "page-empty", [query ? `Nothing matches “${query}”` : "Add apps or folders through their Options menu on Desktop or All apps. Manage spaces in Settings → Workspaces."]),
  ]));
}

function renderNav() {
  byId("page-tabs").replaceChildren(...pages().slice(0, workspaces().length + 1).map((page, index) => {
    const shortcut = `Alt+${index + 1}`;
    const button = el("button", "page-tab", [String(index + 1)]);
    button.type = "button";
    button.setAttribute("aria-current", page.id === current ? "page" : "false");
    button.title = `${page.label} (${shortcut})`;
    button.setAttribute("aria-label", `${page.label} (${shortcut})`);
    button.addEventListener("click", () => show(page.id));
    return button;
  }));
  document.querySelectorAll<HTMLButtonElement>("#section-links [data-page]").forEach(button => {
    button.setAttribute("aria-current", button.dataset.page === current ? "page" : "false");
  });
}

export function show(id: string, focus = true) {
  const next = pages().find((page) => page.id === id) ?? pages()[0];
  closeMenu(); grid.reset();
  current = next.id;
  for (const surface of ["apps-surface", "workspace-surface", "app-list-surface", "screen-time-surface", "focus-surface"]) byId(surface).hidden = next.surface !== surface;
  byId("page-label").textContent = next.label;
  renderNav(); renderWorkspace();
  if (current === "desktop") grid.setQuery(query);
  if (current === "all-apps") renderList();
  if (current === "screen-time") { renderUsage(); void refreshUsage(); }
  if (current === "focus") refreshFocus();
  byId<HTMLInputElement>("search").placeholder = `Search ${next.label.toLocaleLowerCase()}`;
  if (focus) byId("search").focus();
}

export function cycle(direction = 1) {
  const list = pages();
  show(list[(list.findIndex((page) => page.id === current) + direction + list.length) % list.length].id);
}
export function selectSpace(index: number): boolean {
  const id = index === 0 ? "desktop" : workspaces()[index - 1]?.id;
  if (!id) return false;
  show(id); return true;
}
export function toggleBar() { updateSettings({ compactBar: !settings().compactBar }); }
export function syncBar() {
  const compact = settings().compactBar;
  byId("bar-toggle").textContent = compact ? "⌃" : "⌄";
  byId("bar-toggle").setAttribute("aria-expanded", String(!compact));
  byId("bar-toggle").setAttribute("aria-label", compact ? "Expand navigation bar (Ctrl+B)" : "Collapse to taskbar view (Ctrl+B)");
}
export function setApps(next: AppEntry[]) { apps = [...next]; appsReady = true; if (current === "all-apps") renderList(); }
export function setQuery(next: string) { query = next; if (current === "desktop") grid.setQuery(next); if (current === "all-apps") renderList(); renderWorkspace(); setUsageQuery(next); }
export function reset() { query = ""; show("desktop"); }
export function activateFirst(): boolean {
  if (current === "desktop") return false;
  if (current !== "screen-time" && current !== "focus") byId(current === "all-apps" ? "app-list" : "workspace-items").querySelector<HTMLButtonElement>(".app-list-item")?.click();
  return true;
}
export function handleArrow(event: KeyboardEvent): boolean {
  if (current === "desktop" || current === "screen-time" || current === "focus") return false;
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
  byId("workspace-path-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const spaceId = current;
    const input = byId<HTMLInputElement>("workspace-path");
    const button = byId("workspace-path-form").querySelector<HTMLButtonElement>("button")!;
    button.disabled = true;
    void api.workspaceItem(input.value).then((item) => pinItem(spaceId, item)).then(() => { input.value = ""; byId("workspace-path-note").className = "note ok"; byId("workspace-path-note").textContent = "Added to workspace."; })
      .catch((error) => { byId("workspace-path-note").className = "note"; byId("workspace-path-note").textContent = String(error); }).finally(() => { button.disabled = false; });
  });
  byId("page-prev").addEventListener("click", () => cycle(-1));
  byId("page-next").addEventListener("click", () => cycle());
  byId("bar-toggle").addEventListener("click", toggleBar);
  document.querySelectorAll<HTMLButtonElement>("#section-links [data-page]").forEach(button => button.addEventListener("click", () => show(button.dataset.page!)));
  initUsage();
  onWorkspacesChange(() => {
    if (!pages().some((page) => page.id === current)) show("desktop", false);
    else { renderNav(); renderWorkspace(); }
  });
  show("desktop"); syncBar();
}
