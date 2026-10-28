import { listen } from "@tauri-apps/api/event";
import { type Status, api } from "./api";
import { byId, sleep } from "./dom";
import * as grid from "./grid";
import * as groups from "./groups";
import { forgetFailedIcons } from "./icons";
import { closeMenu, isMenuOpen } from "./menu";
import { organize } from "./organize";
import * as pages from "./pages";
import { initPanel, isRecordingHotkey, syncPanel } from "./panel";
import { hidePreview, initRail, refreshRail, startRail, stopRail, syncRailCompact } from "./rail";
import { RAIL_AVAILABLE, applySettings, onSettingsChange, settings } from "./settings";
import { loadWorkspaces } from "./workspaces";
import { closeAmbient, handleFocusKey, initFocus, openAmbient } from "./focus";
import { initPageGestures } from "./gestures";
import { itemPicker } from "./item-picker";

const stage = byId("stage");
const backdrop = byId<HTMLImageElement>("backdrop");
const search = byId<HTMLInputElement>("search");

let status: Status = { hotkeyOk: true, hotkey: "Ctrl+Alt+Space", version: "", codename: "", pinned: false };
let leaving = false;
let itemsLoaded = false;
let itemsRequest: Promise<void> | null = null;
let appsLoaded = false;
let appsRequest: Promise<void> | null = null;
let refreshTimer: number | undefined;

function hint(): string {
  return status.hotkeyOk ? `Esc to close  ·  ${status.hotkey}` : `${status.hotkey} is taken — pick another in Settings`;
}
function reportLoadError(area: string, error: unknown) {
  byId("navigation-note").textContent = `${area} could not load: ${String(error)}`;
}

// ---------- opening and closing ----------

async function setBackdrop(url: string | null) {
  if (!url) {
    backdrop.hidden = true;
    backdrop.removeAttribute("src");
    return;
  }

  backdrop.hidden = false;
  backdrop.src = url;
  try {
    await backdrop.decode(); // no frame should show before the image is ready
  } catch {
    // a failed decode just means a plain tinted backdrop
  }
}

async function loadItems() {
  if (itemsRequest) return itemsRequest;
  itemsRequest = (async () => {
    const items = await api.listItems();
    grid.setItems(items);
    groups.prune(new Set(items.map(item => item.path)));
    grid.render();

    if (!groups.isOrganized()) {
      organize(items);
      groups.markOrganized();
    }

    grid.setStatusHint(hint());
    grid.render();
    itemsLoaded = true;
  })();
  try { await itemsRequest; } finally { itemsRequest = null; }
}

async function loadApplications() {
  if (appsLoaded) return;
  if (appsRequest) return appsRequest;
  appsRequest = api.listApps().then(applications => { pages.setApps(applications); appsLoaded = true; });
  try { await appsRequest; } finally { appsRequest = null; }
}

/** Keep work that does not affect the first visible frame outside the open path. */
function refreshAfterPresent() {
  window.clearTimeout(refreshTimer);
  // Replacing the tile DOM during the entrance causes a visible hitch. Refresh after motion has
  // settled; the prewarmed content is already correct enough for the first frame.
  const delay = settings().animations ? 210 : 70;
  refreshTimer = window.setTimeout(() => {
    if (leaving) return;
    void loadItems().catch((error) => reportLoadError("Desktop", error));
    void loadApplications().catch((error) => reportLoadError("All apps", error));
    if (RAIL_AVAILABLE && settings().rail) startRail();
  }, delay);
}

function resetUi() {
  closeAmbient(false);
  closeMenu();
  if (RAIL_AVAILABLE) hidePreview(true);
  grid.reset();
  pages.reset();
  search.value = "";
}

async function onPrepare(snapshot: string | null, reuseSnapshot: boolean, page = "desktop") {
  resetUi();
  stage.classList.remove("leaving");
  stage.classList.remove("overlay-enter");
  stage.classList.add("pre");
  leaving = false;
  pages.show(page);
  if (page === "screen-saver") openAmbient("saver", true);
  forgetFailedIcons();

  // A warm open reuses the existing grid. Only the new snapshot belongs on the
  // critical path; Desktop and taskbar changes can arrive just after first paint.
  const backdropReady = reuseSnapshot ? Promise.resolve() : setBackdrop(snapshot);
  if (itemsLoaded) await backdropReady;
  else await Promise.all([backdropReady, loadItems()]);
  stage.classList.toggle("overlay-enter", settings().animations);
  await api.present();

  requestAnimationFrame(() => stage.classList.remove("pre"));
  window.setTimeout(() => stage.classList.remove("overlay-enter"), 220);
  if (page !== "screen-saver") search.focus();
  pages.startPages();
  if (page !== "screen-saver") refreshAfterPresent();
}

async function closeLauncher() {
  if (leaving) return;
  leaving = true;
  window.clearTimeout(refreshTimer);

  if (settings().animations) {
    stage.classList.add("leaving");
    await sleep(160);
  }
  if (RAIL_AVAILABLE) stopRail();
  pages.stopPages();
  await api.hide();
  // Keep the hidden window prepared so a subsequent native show can never
  // expose the previous fully-open frame before launcher-prepare reaches the webview.
  stage.classList.add("pre");
}

// ---------- input ----------

function trapPopupTab(event: KeyboardEvent): boolean {
  if (!grid.isPopupOpen() || event.key !== "Tab" || event.ctrlKey || event.altKey || event.metaKey) return false;
  const popup = byId("popup");
  const controls = [...popup.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex='0']")]
    .filter(node => node.getClientRects().length > 0);
  const first = controls[0], last = controls[controls.length - 1];
  if (!popup.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
    event.preventDefault(); (event.shiftKey ? last : first)?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first?.focus();
  }
  return true;
}

function dismissCurrentLayer() {
  if (isMenuOpen()) { closeMenu(); return; }
  if (!byId("item-picker").hidden) { byId("item-picker").hidden = true; return; }
  if (grid.isPopupOpen()) { grid.closePopup(); return; }
  if (search.value) { search.value = ""; grid.setQuery(""); pages.setQuery(""); return; }
  if (!byId("settings-surface").hidden) { pages.show("desktop"); return; }
  void closeLauncher();
}

function handlePageKeys(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement;
  const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
  if (editing && target !== search || grid.isPopupOpen() || isMenuOpen() || itemPicker.isOpen()) return false;
  if (event.key === "Tab" && !event.ctrlKey && !event.altKey && !event.metaKey && pages.isHome()) {
    event.preventDefault();
    if (!event.repeat) pages.cycleHome(event.shiftKey ? -1 : 1);
    return true;
  }
  if (event.key === "Tab" && event.ctrlKey && !event.altKey && !event.metaKey) {
    event.preventDefault();
    if (!event.repeat) pages.cycle(event.shiftKey ? -1 : 1);
    return true;
  }
  if (event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey && /^[1-9]$/.test(event.key)) {
    if (pages.selectPage(Number(event.key) - 1)) event.preventDefault();
    return true;
  }
  const legacyPages: Record<string, string> = { a: "all-apps", t: "screen-time", f: "focus" };
  if (event.ctrlKey && event.altKey && !event.metaKey && legacyPages[event.key.toLowerCase()]) {
    event.preventDefault(); pages.show(legacyPages[event.key.toLowerCase()]);
    return true;
  }
  if (event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === "b") {
    event.preventDefault();
    if (!event.repeat) pages.toggleBar();
    return true;
  }
  return false;
}

function focusSearchOnType(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey || editing || !byId("settings-surface").hidden) return;
  if (grid.isPopupOpen()) grid.closePopup();
  search.focus();
}

function onKey(event: KeyboardEvent) {
  if (handleFocusKey(event) || isRecordingHotkey() || trapPopupTab(event)) return;
  if (event.key === "Escape") { event.preventDefault(); dismissCurrentLayer(); return; }
  if (event.ctrlKey && event.key.toLowerCase() === "q") { event.preventDefault(); void api.quit(); return; }
  if (handlePageKeys(event)) return;
  if (event.key.startsWith("Arrow") && (pages.handleArrow(event) || grid.handleArrow(event))) { event.preventDefault(); return; }
  focusSearchOnType(event);
}

function onShellClick(event: MouseEvent) {
  const target = event.target as HTMLElement;

  if (isMenuOpen()) return;
  if (!settings().closeOnClickOff) return;
  if (target.closest(".tile, .glass, input, button")) return;

  void closeLauncher();
}

// ---------- start ----------

function setupPanel() {
  initPanel({
    status: () => status,
    organizeNow: () => {
      const moved = organize(grid.allItems());
      groups.markOrganized();
      grid.render();
      return moved;
    },
    resetPanes: () => {
      groups.resetGroups();
      grid.reset();
      grid.render();
    },
    resetGrid: () => {
      groups.resetLayout();
      grid.render();
    },
    hotkeyChanged: (label) => {
      status = { ...status, hotkey: label, hotkeyOk: true };
      grid.setStatusHint(hint());
      grid.render();
    },
  });
}

function watchSettings() {
  let previousSettings = settings();
  onSettingsChange((next) => {
    const previous = previousSettings;
    previousSettings = next;

    if (next.groupsFirst !== previous.groupsFirst || next.sortBy !== previous.sortBy) grid.render();
    if (RAIL_AVAILABLE && next.rail && !previous.rail) void refreshRail();
    if (RAIL_AVAILABLE && !next.railPreviews) hidePreview(true);
    if (RAIL_AVAILABLE && !next.rail) stopRail();
    if (RAIL_AVAILABLE && next.rail && !previous.rail) startRail();
    syncPanel();
    if (next.compactBar !== previous.compactBar) syncRailCompact();
  });
}

function setupInput() {
  search.addEventListener("input", () => {
    pages.setQuery(search.value);
  });
  search.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!pages.activateFirst()) grid.activateFirst();
    }
  });

  byId("shell").addEventListener("click", onShellClick);
  document.addEventListener("keydown", onKey);
  initPageGestures({
    navigate: pages.completeGesture,
    preview: pages.previewGesture,
    cancel: pages.clearGesturePreview,
    canNavigate: (target) => {
      if (isMenuOpen() || grid.isPopupOpen() || !byId("item-picker").hidden) return false;
      if (!(target instanceof HTMLElement)) return false;
      return !target.closest("input, textarea, #rail, #preview, #ambient, .app-list, .page-scroll, #settings, #popup, #menu");
    },
  });
  document.addEventListener("contextmenu", (event) => event.preventDefault());
}

async function registerNativeEvents() {
  await listen<string>("launcher-backdrop-cache", (event) => void setBackdrop(event.payload));
  await listen("launcher-hidden", () => { closeAmbient(false); stopRail(); pages.stopPages(); window.clearTimeout(refreshTimer); });
  await listen<string>("launcher-page", (event) => { search.value = ""; pages.setQuery(""); grid.setQuery(""); pages.show(event.payload); });
  await listen<{ snapshot: string | null; reuseSnapshot: boolean; page: string }>("launcher-prepare", (event) =>
    void onPrepare(event.payload.snapshot, event.payload.reuseSnapshot, event.payload.page),
  );
}

async function init() {
  applySettings();
  const statusRequest = api.status().catch(() => null);
  await Promise.all([
    groups.loadGroups(),
    loadWorkspaces().catch((error) => reportLoadError("Workspaces", error)),
  ]);
  status = (await statusRequest) ?? status;

  grid.initGrid();
  pages.initPages();
  initFocus();
  if (RAIL_AVAILABLE) initRail();
  setupPanel();
  watchSettings();
  setupInput();
  await registerNativeEvents();

  // Warm the grid while the window is still hidden. Icon requests remain
  // asynchronous, so this does not wait for the serial shell-icon worker.
  void loadItems().catch((error) => reportLoadError("Desktop", error));
  void api.setBackdropCapture(!settings().clearCanvas).catch(() => {});
  await api.ready();
  void loadApplications().catch(error => reportLoadError("All apps", error));
}

void init();
