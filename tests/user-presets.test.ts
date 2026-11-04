import { beforeEach, describe, expect, it, vi } from "vitest";
import { importUserPresets, loadUserPresets, removeUserPreset, withUniqueIds, type UserVisualPreset } from "../src/appearance/user-presets";

const STORAGE_KEY = "opaline.appearance.profiles";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, String(value)),
    removeItem: (key: string) => void data.delete(key),
  };
}

const bundle = (presets: { id: string; name: string }[]) =>
  JSON.stringify({ schema: "opaline-visual-presets", version: 1, presets: presets.map(preset => ({ ...preset, settings: {} })) });

describe("user presets", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  it("keeps the first preset using an id and renames later ones", () => {
    const preset = (id: string, name: string): UserVisualPreset => ({ id, name, createdAt: "2026-11-04T00:00:00.000Z", settings: {} as UserVisualPreset["settings"] });
    let counter = 0;
    const result = withUniqueIds([preset("a", "One"), preset("a", "Two"), preset("b", "Three"), preset("a", "Four")], () => `fresh-${++counter}`);

    expect(result.map(item => item.id)).toEqual(["a", "fresh-1", "b", "fresh-2"]);
    expect(result.map(item => item.name)).toEqual(["One", "Two", "Three", "Four"]);
  });

  it("imports a file that reuses an id so each preset can be removed on its own", () => {
    const merged = importUserPresets(bundle([{ id: "x", name: "A" }, { id: "x", name: "B" }, { id: "y", name: "C" }]));

    expect(new Set(merged.map(preset => preset.id)).size).toBe(3);
    const remaining = removeUserPreset(merged.find(preset => preset.name === "A")!.id);
    expect(remaining.map(preset => preset.name).sort()).toEqual(["B", "C"]);
  });

  it("repairs duplicate ids that were already stored", () => {
    const stored = [{ id: "x", name: "A", settings: {} }, { id: "x", name: "B", settings: {} }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const loaded = loadUserPresets();

    expect(loaded.map(preset => preset.name)).toEqual(["A", "B"]);
    expect(new Set(loaded.map(preset => preset.id)).size).toBe(2);
  });
});
