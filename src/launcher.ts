import { listen } from "@tauri-apps/api/event";
import { type Status, api } from "./api";
import { byId, sleep } from "./dom";
import { attachLens, refreshLenses } from "./glass";
import * as grid from "./grid";
import * as groups from "./groups";
import { forgetFailedIcons } from "./icons";
import { closeMenu, isMenuOpen } from "./menu";
import { organize } from "./organize";
import { closePanel, initPanel, isPanelOpen, isRecordingHotkey, syncPanel, togglePanel } from "./panel";
import { hidePreview, initRail, refreshRail, startRail, stopRail } from "./rail";
import { applySettings, onSettingsChange, settings } from "./settings";

const stage = byId("stage");
const backdrop = byId<HTMLImageElement>("backdrop");
const search = byId<HTMLInputElement>("search");

let status: Status = { hotkeyOk: true, hotkey: "Ctrl+Alt+Space", version: "", codename: "", pinned: false };
let leaving = false;

function hint(): string {
  return status.hotkeyOk ? `Esc to close  ·  ${status.hotkey}` : `${status.hotkey} is taken — pick another in Settings`;
}

// ---------- opening and closing ----------

async function setBackdrop(url: string | null) {
  if (!url) {
    backdrop.hidden = true;
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
}

function resetUi() {
  closeMenu();
  closePanel();
  hidePreview(true);
  grid.reset();
  search.value = "";
}

async function onPrepare(snapshot: string | null) {
  resetUi();
  stage.classList.remove("leaving");
  stage.classList.add("pre");
  leaving = false;
  forgetFailedIcons();

  await Promise.all([setBackdrop(snapshot), loadItems(), refreshRail()]);
  await api.present();

  requestAnimationFrame(() => stage.classList.remove("pre"));
  search.focus();
  startRail();
}

async function closeLauncher() {
  if (leaving) return;
  leaving = true;

  if (settings().animations) {
    stage.classList.add("leaving");
    await sleep(160);
  }
  stopRail();
  await api.hide();
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
  await groups.loadGroups();
  try {
    status = await api.status();
  } catch {
    // keep the optimistic default
  }

  grid.initGrid();
  initRail();
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
    hotkeyChanged: (label) => {
      status = { ...status, hotkey: label, hotkeyOk: true };
      grid.setStatusHint(hint());
      grid.render();
    },
  });

  for (const id of ["search-wrap", "settings-button", "quit-button", "rail", "preview", "popup", "settings", "menu"]) {
    attachLens(byId(id));
  }

  onSettingsChange(() => {
    refreshLenses();
    grid.render();
    syncPanel();
    void refreshRail();
  });

  search.addEventListener("input", () => grid.setQuery(search.value));
  search.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      grid.activateFirst();
    }
  });

  byId("settings-button").addEventListener("click", togglePanel);
  byId("quit-button").addEventListener("click", () => void api.quit());
  byId("shell").addEventListener("click", onShellClick);
  document.addEventListener("keydown", onKey);
  document.addEventListener("contextmenu", (event) => event.preventDefault());

  await listen<{ snapshot: string | null }>("launcher-prepare", (event) => void onPrepare(event.payload.snapshot));
  await api.ready();
}

void init();
