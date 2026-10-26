import { listen } from "@tauri-apps/api/event";
import { type Status, api } from "./api";
import { byId, sleep } from "./dom";
import * as grid from "./grid";
import * as groups from "./groups";
import { forgetFailedIcons } from "./icons";
import { closeMenu, isMenuOpen } from "./menu";
import { organize } from "./organize";
import * as pages from "./pages";
import { closePanel, initPanel, isPanelOpen, isRecordingHotkey, syncPanel, togglePanel } from "./panel";
import { hidePreview, initRail, refreshRail, startRail, stopRail } from "./rail";
import { RAIL_AVAILABLE, applySettings, onSettingsChange, settings } from "./settings";

const stage = byId("stage");
const backdrop = byId<HTMLImageElement>("backdrop");
const search = byId<HTMLInputElement>("search");

let status: Status = { hotkeyOk: true, hotkey: "Ctrl+Alt+Space", version: "", codename: "", pinned: false };
let leaving = false;
let itemsLoaded = false;
let appsLoaded = false;
let refreshTimer: number | undefined;

function hint(): string {
  return status.hotkeyOk ? `Esc to close  ·  ${status.hotkey}` : `${status.hotkey} is taken — pick another in Settings`;
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
  const items = await api.listItems();
  grid.setItems(items);
  groups.prune(new Set(items.map((item) => item.path)));

  // first run: sort the desktop into panes for the user
  if (!groups.isOrganized()) {
    organize(items);
    groups.markOrganized();
  }

  grid.setStatusHint(hint());
  grid.render();
  itemsLoaded = true;
}

async function loadApplications() {
  if (appsLoaded) return;
  const applications = await api.listApps();
  pages.setApps(applications);
  appsLoaded = true;
}

/** Keep work that does not affect the first visible frame outside the open path. */
function refreshAfterPresent() {
  window.clearTimeout(refreshTimer);
  // Replacing the tile DOM during the entrance causes a visible hitch. Refresh after motion has
  // settled; the prewarmed content is already correct enough for the first frame.
  const delay = settings().animations && settings().fabricEntrance ? 620 : 120;
  refreshTimer = window.setTimeout(() => {
    if (leaving) return;
    void loadItems().catch(() => {});
    void loadApplications().catch(() => {});
    if (RAIL_AVAILABLE) void refreshRail();
  }, delay);
}

function resetUi() {
  closeMenu();
  closePanel();
  if (RAIL_AVAILABLE) hidePreview(true);
  grid.reset();
  pages.reset();
  search.value = "";
}

async function onPrepare(snapshot: string | null, reuseSnapshot: boolean) {
  resetUi();
  stage.classList.remove("leaving");
  stage.classList.remove("overlay-enter");
  stage.classList.add("pre");
  leaving = false;
  forgetFailedIcons();

  // A warm open reuses the existing grid. Only the new snapshot belongs on the
  // critical path; Desktop and taskbar changes can arrive just after first paint.
  const backdropReady = reuseSnapshot ? Promise.resolve() : setBackdrop(snapshot);
  if (itemsLoaded) await backdropReady;
  else await Promise.all([backdropReady, loadItems()]);
  const richEntrance = settings().animations && settings().fabricEntrance;
  stage.classList.toggle("overlay-enter", richEntrance);
  await api.present();

  requestAnimationFrame(() => stage.classList.remove("pre"));
  window.setTimeout(() => stage.classList.remove("overlay-enter"), 580);
  search.focus();
  if (RAIL_AVAILABLE) startRail();
  refreshAfterPresent();
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
  await api.hide();
  // Keep the hidden window in its prepared fabric state so a subsequent native show can never
  // expose the previous fully-open frame before launcher-prepare reaches the webview.
  stage.classList.add("pre");
}

// ---------- input ----------

function onKey(event: KeyboardEvent) {
  if (isRecordingHotkey()) return;

  if (event.key === "Escape") {
    event.preventDefault();
    if (isMenuOpen()) closeMenu();
    else if (isPanelOpen()) closePanel();
    else if (grid.isPopupOpen()) grid.closePopup();
    else if (search.value) {
      search.value = "";
      grid.setQuery("");
    } else void closeLauncher();
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === "q") {
    event.preventDefault();
    void api.quit();
    return;
  }

  if (event.key.startsWith("Arrow") && grid.handleArrow(event)) {
    event.preventDefault();
    return;
  }

  // typing anywhere starts a search
  const target = event.target as HTMLElement;
  const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey && !typing && !isPanelOpen()) {
    if (grid.isPopupOpen()) grid.closePopup();
    search.focus();
  }
}

function onShellClick(event: MouseEvent) {
  const target = event.target as HTMLElement;

  if (isMenuOpen()) return;
  if (isPanelOpen()) {
    if (!target.closest("#settings, #settings-button")) closePanel();
    return;
  }
  if (!settings().closeOnClickOff) return;
  if (target.closest(".tile, .glass, input, button")) return;

  void closeLauncher();
}

// ---------- start ----------

async function init() {
  applySettings();
  const statusRequest = api.status().catch(() => null);
  await groups.loadGroups();
  status = (await statusRequest) ?? status;

  grid.initGrid();
  pages.initPages();
  if (RAIL_AVAILABLE) initRail();
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

  let previousSettings = settings();
  onSettingsChange((next) => {
    const previous = previousSettings;
    previousSettings = next;

    if (next.groupsFirst !== previous.groupsFirst || next.sortBy !== previous.sortBy) grid.render();
    if (RAIL_AVAILABLE && next.rail && !previous.rail) void refreshRail();
    if (RAIL_AVAILABLE && !next.railPreviews) hidePreview(true);
    syncPanel();
  });

  search.addEventListener("input", () => {
    grid.setQuery(search.value);
    pages.setQuery(search.value);
  });
  search.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!pages.activateFirst()) grid.activateFirst();
    }
  });

  byId("settings-button").addEventListener("click", togglePanel);
  byId("quit-button").addEventListener("click", () => void api.quit());
  byId("shell").addEventListener("click", onShellClick);
  document.addEventListener("keydown", onKey);
  document.addEventListener("contextmenu", (event) => event.preventDefault());

  await listen<string>("launcher-backdrop-cache", (event) => void setBackdrop(event.payload));
  await listen<{ snapshot: string | null; reuseSnapshot: boolean }>("launcher-prepare", (event) =>
    void onPrepare(event.payload.snapshot, event.payload.reuseSnapshot),
  );

  // Warm the grid while the window is still hidden. Icon requests remain
  // asynchronous, so this does not wait for the serial shell-icon worker.
  await loadItems().catch(() => {});
  await api.setBackdropCapture(!settings().clearCanvas).catch(() => {});
  await api.ready();
}

void init();
