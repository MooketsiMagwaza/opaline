import { api, type Item } from "./api";
import type { MenuEntry } from "./menu";

export type Workspace = { id: string; name: string; items: Item[] };
const FILE = "workspaces.json";
let spaces: Workspace[] = [];
let saving = Promise.resolve();
const listeners = new Set<() => void>();

export function normalizeWorkspaces(value: unknown): Workspace[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>(["desktop", "all-apps", "screen-time"]);
  return value.filter((space) => space && typeof space.id === "string" && !ids.has(space.id) && ids.add(space.id))
    .slice(0, 8).map((space) => ({
      id: space.id,
      name: typeof space.name === "string" ? space.name.trim().slice(0, 40) || "Workspace" : "Workspace",
      items: Array.isArray(space.items) ? space.items.filter((item: Item) => item && typeof item.path === "string" && typeof item.name === "string")
        .filter((item: Item, index: number, items: Item[]) => items.findIndex((other) => other.path === item.path) === index)
        .map((item: Item) => ({ path: item.path, name: item.name, isFolder: item.isFolder === true })) : [],
    }));
}

export const workspaces = (): readonly Workspace[] => spaces;
export function onWorkspacesChange(listener: () => void) { listeners.add(listener); }

export async function loadWorkspaces() {
  const text = await api.loadStore(FILE);
  spaces = text ? normalizeWorkspaces(JSON.parse(text)) : [{ id: "dev-tools", name: "Dev tools", items: [] }];
}

function change(edit: (next: Workspace[]) => void): Promise<void> {
  const operation = saving.then(async () => {
    const next = structuredClone(spaces);
    edit(next);
    await api.saveStore(FILE, JSON.stringify(next));
    spaces = next;
    listeners.forEach((listener) => listener());
  });
  saving = operation.catch(() => {});
  return operation;
}

export function createWorkspace(name: string) {
  return change((next) => {
    if (next.length >= 8) throw new Error("You can have up to eight custom spaces.");
    next.push({ id: crypto.randomUUID(), name: name.trim().slice(0, 40) || "Workspace", items: [] });
  });
}
export function renameWorkspace(id: string, name: string) {
  return change((next) => { const space = next.find((space) => space.id === id); if (space) space.name = name.trim().slice(0, 40) || "Workspace"; });
}
export function removeWorkspace(id: string) { return change((next) => { const index = next.findIndex((space) => space.id === id); if (index >= 0) next.splice(index, 1); }); }
export function pinItem(id: string, item: Item) {
  return change((next) => { const space = next.find((space) => space.id === id); if (space && !space.items.some((other) => other.path === item.path)) space.items.push(item); });
}
export function unpinItem(id: string, path: string) {
  return change((next) => { const space = next.find((space) => space.id === id); if (space) space.items = space.items.filter((item) => item.path !== path); });
}

export function reportWorkspaceError(error: unknown) {
  document.getElementById("navigation-note")!.textContent = `Could not save workspace: ${String(error)}`;
}

export function workspaceMenu(item: Item): MenuEntry {
  return { label: "Add to workspace", items: spaces.map((space, index) => ({
    label: `${space.name} · Alt+${index + 2}`,
    disabled: space.items.some((other) => other.path === item.path),
    action: () => { void pinItem(space.id, item).catch(reportWorkspaceError); },
  })), disabled: spaces.length === 0 };
}
