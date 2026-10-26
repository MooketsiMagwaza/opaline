import { api } from "./api";
import { debounce } from "./dom";

/** A pane: a named, virtual group of Desktop items. The files themselves never move. */
export type Group = { id: string; name: string; items: string[] };
export type LayoutPosition = { x: number; y: number };

type Store = {
  version: 1;
  organized: boolean;
  groups: Group[];
  launches: Record<string, number>;
  layout: Record<string, LayoutPosition>;
};

const FILE = "groups.json";
let store: Store = { version: 1, organized: false, groups: [], launches: {}, layout: {} };

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
      layout: Object.fromEntries(
        Object.entries(saved.layout ?? {}).flatMap(([key, position]) => {
          if (
            typeof position?.x !== "number" ||
            typeof position?.y !== "number" ||
            !Number.isFinite(position.x) ||
            !Number.isFinite(position.y)
          ) {
            return [];
          }
          return [[key, { x: Math.min(1, Math.max(0, position.x)), y: Math.min(1, Math.max(0, position.y)) }]];
        }),
      ),
    };
  } catch {
    // an unreadable file just means starting fresh
  }
}

export const groups = (): Group[] => store.groups;
export const isOrganized = (): boolean => store.organized;
export const itemPositionKey = (path: string): string => `item:${path}`;
export const groupPositionKey = (id: string): string => `group:${id}`;

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
  for (const group of store.groups) {
    if (group.items.length === 0) delete store.layout[groupPositionKey(group.id)];
  }
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
  delete store.layout[groupPositionKey(id)];
  persist();
}

export function resetGroups() {
  for (const group of store.groups) delete store.layout[groupPositionKey(group.id)];
  store.groups = [];
  // stay "organised": ungrouping everything must not be undone the next time the overlay opens
  store.organized = true;
  persist();
}

/** Clears only the user's grid ordering; pane membership and launch history stay intact. */
export function resetLayout() {
  store.layout = {};
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
  for (const group of store.groups) {
    if (group.items.length === 0) delete store.layout[groupPositionKey(group.id)];
  }
  store.groups = store.groups.filter((group) => group.items.length > 0);
  changed = changed || store.groups.length !== before;

  const liveGroupKeys = new Set(store.groups.map((group) => groupPositionKey(group.id)));
  for (const key of Object.keys(store.layout)) {
    const staleItem = key.startsWith("item:") && !live.has(key.slice("item:".length));
    const staleGroup = key.startsWith("group:") && !liveGroupKeys.has(key);
    if (staleItem || staleGroup) {
      delete store.layout[key];
      changed = true;
    }
  }

  if (changed) persist();
  return changed;
}

export function bumpLaunch(path: string) {
  store.launches[path] = (store.launches[path] ?? 0) + 1;
  persist();
}

export const launchCount = (path: string): number => store.launches[path] ?? 0;

/** Positions are normalized to the available canvas, so layouts survive resolution changes. */
export const positionOf = (key: string): LayoutPosition | undefined => store.layout[key];

export function setPosition(key: string, position: LayoutPosition) {
  store.layout[key] = {
    x: Math.round(Math.min(1, Math.max(0, position.x)) * 10_000) / 10_000,
    y: Math.round(Math.min(1, Math.max(0, position.y)) * 10_000) / 10_000,
  };
  persist();
}

/** Persists the visual grid order while retaining the v1 normalized layout format. */
export function setLayoutOrder(keys: string[]) {
  const unique = [...new Set(keys)];
  const denominator = Math.max(1, unique.length - 1);
  unique.forEach((key, index) => {
    store.layout[key] = { x: index / denominator, y: 0 };
  });
  persist();
}

export function forgetPosition(key: string) {
  if (!(key in store.layout)) return;
  delete store.layout[key];
  persist();
}
