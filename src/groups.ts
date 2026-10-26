import { api } from "./api";
import { debounce } from "./dom";

/** A pane: a named, virtual group of Desktop items. The files themselves never move. */
export type Group = { id: string; name: string; items: string[] };

type Store = {
  version: 1;
  organized: boolean;
  groups: Group[];
  launches: Record<string, number>;
};

const FILE = "groups.json";
let store: Store = { version: 1, organized: false, groups: [], launches: {} };

const persist = debounce(() => {
  void api.saveStore(FILE, JSON.stringify(store)).catch(() => {});
}, 300);

export async function loadGroups() {
  try {
    const text = await api.loadStore(FILE);
    if (!text) return;

    const saved = JSON.parse(text) as Partial<Store>;
    store = {
      version: 1,
      organized: saved.organized === true,
      groups: (saved.groups ?? [])
        .filter((group) => typeof group?.id === "string" && Array.isArray(group.items))
        .map((group) => ({
          id: group.id,
          name: String(group.name ?? "Pane"),
          items: group.items.filter((path) => typeof path === "string"),
        })),
      launches: saved.launches ?? {},
    };
  } catch {
    // an unreadable file just means starting fresh
  }
}

export const groups = (): Group[] => store.groups;
export const isOrganized = (): boolean => store.organized;

export function markOrganized() {
  store.organized = true;
  persist();
}

export function groupOf(path: string): Group | undefined {
  return store.groups.find((group) => group.items.includes(path));
}

const newId = () => `g-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

function detach(path: string) {
  for (const group of store.groups) group.items = group.items.filter((item) => item !== path);
  store.groups = store.groups.filter((group) => group.items.length > 0);
}

export function createGroup(name: string, paths: string[], id = newId()): Group {
  for (const path of paths) detach(path);
  const group: Group = { id, name, items: [...paths] };
  store.groups.push(group);
  persist();
  return group;
}

/** Adds to the pane with this id, creating it (with this name) if it doesn't exist yet. */
export function ensureGroup(id: string, name: string, paths: string[]) {
  const existing = store.groups.find((group) => group.id === id);
  if (!existing) {
    createGroup(name, paths, id);
    return;
  }
  for (const path of paths) addToGroup(id, path);
}

export function addToGroup(id: string, path: string) {
  const target = store.groups.find((group) => group.id === id);
  if (!target || target.items.includes(path)) return;

  detach(path);
  // detach() may have dropped an emptied pane, but never the target (it still holds items)
  target.items.push(path);
  persist();
}

export function removeFromGroup(path: string) {
  detach(path);
  persist();
}

export function renameGroup(id: string, name: string) {
  const group = store.groups.find((candidate) => candidate.id === id);
  if (!group) return;
  group.name = name.trim() || "Pane";
  persist();
}

export function ungroup(id: string) {
  store.groups = store.groups.filter((group) => group.id !== id);
  persist();
}

export function resetGroups() {
  store.groups = [];
  // stay "organised": ungrouping everything must not be undone the next time the overlay opens
  store.organized = true;
  persist();
}

/** Forgets items that are no longer on the Desktop. Returns true if anything changed. */
export function prune(live: Set<string>): boolean {
  let changed = false;
  for (const group of store.groups) {
    const kept = group.items.filter((path) => live.has(path));
    if (kept.length !== group.items.length) {
      group.items = kept;
      changed = true;
    }
  }

  const before = store.groups.length;
  store.groups = store.groups.filter((group) => group.items.length > 0);
  changed = changed || store.groups.length !== before;

  if (changed) persist();
  return changed;
}

export function bumpLaunch(path: string) {
  store.launches[path] = (store.launches[path] ?? 0) + 1;
  persist();
}

export const launchCount = (path: string): number => store.launches[path] ?? 0;
