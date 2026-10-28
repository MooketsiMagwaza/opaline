import { invoke } from "@tauri-apps/api/core";

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
  folderPreview: (path: string) => invoke<Item[]>("folder_preview", { path }),
  screenTime: () => invoke<UsageReport>("screen_time"),
  setScreenTime: (enabled: boolean) => invoke<void>("set_screen_time", { enabled }),
  clearScreenTime: () => invoke<void>("clear_screen_time"),
  startMenuStatus: () => invoke<{ enabled: boolean; available: boolean }>("start_menu_status"),
  setStartMenu: (enabled: boolean) => invoke<void>("set_start_menu", { enabled }),
  setScreenSaver: (enabled: boolean, idleMinutes: number) => invoke<void>("set_screen_saver", { enabled, idleMinutes }),
  icon: (path: string) => invoke<string | null>("get_icon", { path }),
  windowIcon: (hwnd: number) => invoke<string | null>("get_window_icon", { hwnd }),
  launch: (path: string) => invoke<void>("launch", { path }),
  reveal: (path: string) => invoke<void>("reveal", { path }),
  rail: () => invoke<RailItem[]>("rail_items"),
  thumbnail: (hwnd: number) => invoke<string | null>("thumbnail", { hwnd }),
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
