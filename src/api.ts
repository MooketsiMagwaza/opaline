import { invoke } from "@tauri-apps/api/core";

export type Item = { name: string; path: string; isFolder: boolean };
export type WindowInfo = { hwnd: number; title: string; minimized: boolean };
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
  icon: (path: string) => invoke<string | null>("get_icon", { path }),
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
  loadStore: (name: string) => invoke<string | null>("load_store", { name }),
  saveStore: (name: string, json: string) => invoke<void>("save_store", { name, json }),
};
