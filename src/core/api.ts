import { convertFileSrc, invoke } from "@tauri-apps/api/core";

/** Icons and window previews are plain images served by the Rust `opaline` protocol (src-tauri/src/media.rs), not command results. */
const image = (route: string) => convertFileSrc(route, "opaline");
let thumbnailSequence = 0;

export type Item = { name: string; path: string; isFolder: boolean };
export type AppEntry = { name: string; path: string };
export type WindowInfo = { hwnd: number; title: string; minimized: boolean };
export type UsageEntry = { id: string; name: string; path: string; totalSeconds: number; todaySeconds: number; dailySeconds: Record<string, number> };
export type UsageReport = { enabled: boolean; supported: boolean; entries: UsageEntry[]; saveError: string | null };
export type RailItem = {
  id: string;
  name: string;
  iconPath: string;
  launchPath: string | null;
  pinned: boolean;
  windows: WindowInfo[];
};
export type Status = {
  hotkeyOk: boolean;
  hotkey: string;
  version: string;
  codename: string;
  pinned: boolean;
};

/** Everything the UI asks of Rust. See WORKORDER.md §8. */
export const api = {
  ready: () => invoke<void>("ready"),
  present: () => invoke<void>("present"),
  listItems: () => invoke<Item[]>("list_items"),
  listApps: () => invoke<AppEntry[]>("list_apps"),
  workspaceItem: (path: string) => invoke<Item>("workspace_item", { path }),
  pickWorkspaceItem: (kind: "folder" | "file") => invoke<Item | null>("pick_workspace_item", { kind }),
  folderPreview: (path: string) => invoke<Item[]>("folder_preview", { path }),
  screenTime: () => invoke<UsageReport>("screen_time"),
  setScreenTime: (enabled: boolean) => invoke<void>("set_screen_time", { enabled }),
  clearScreenTime: () => invoke<void>("clear_screen_time"),
  startMenuStatus: () => invoke<{ enabled: boolean; available: boolean }>("start_menu_status"),
  setStartMenu: (enabled: boolean) => invoke<void>("set_start_menu", { enabled }),
  setScreenSaver: (enabled: boolean, idleMinutes: number) => invoke<void>("set_screen_saver", { enabled, idleMinutes }),
  iconUrl: (path: string) => image(`icon:${path}`),
  windowIconUrl: (hwnd: number) => image(`winicon:${hwnd}`),
  launch: (path: string) => invoke<void>("launch", { path }),
  reveal: (path: string) => invoke<void>("reveal", { path }),
  rail: () => invoke<RailItem[]>("rail_items"),
  /** Every capture gets its own URL, so a refreshed preview is never served from an older response. */
  thumbnailUrl: (hwnd: number) => image(`thumb:${hwnd}:${++thumbnailSequence}`),
  focusWindow: (hwnd: number) => invoke<void>("focus_window", { hwnd }),
  hide: () => invoke<void>("hide_launcher"),
  quit: () => invoke<void>("quit"),
  status: () => invoke<Status>("status"),
  setHotkey: (combo: string) => invoke<string>("set_hotkey", { combo }),
  setBehavior: (closeOnBlur: boolean) => invoke<void>("set_behavior", { closeOnBlur }),
  setBackdropCapture: (enabled: boolean) => invoke<void>("set_backdrop_capture", { enabled }),
  loadStore: (name: string) => invoke<string | null>("load_store", { name }),
  saveStore: (name: string, json: string) => invoke<void>("save_store", { name, json }),
};
