import { describe, expect, it, vi } from "vitest";
vi.mock("../src/core/api", () => ({ api: { loadStore: vi.fn(), saveStore: vi.fn().mockResolvedValue(undefined) } }));
import { api } from "../src/core/api";
import { createWorkspace, loadWorkspaces, nextScreenName, normalizeWorkspaces, pinItem, withoutSeededScreens, workspaces } from "../src/grid/workspaces";

describe("workspace persistence", () => {
  it("validates identities, names and duplicate pins, and limits keyboard slots", () => {
    const item = { path: "C:\\Projects", name: "Projects", isFolder: true };
    expect(normalizeWorkspaces(null)).toEqual([]);
    expect(normalizeWorkspaces([{ id: "desktop", name: "Collision", items: [] }])).toEqual([]);
    const spaces = normalizeWorkspaces([{ id: "dev", name: "  Dev  ", items: [item, item, null] }, { id: "dev", items: [] }, { name: "Invalid" }]);
    expect(spaces).toEqual([{ id: "dev", name: "Dev", items: [item] }]);
    expect(normalizeWorkspaces(Array.from({ length: 12 }, (_, index) => ({ id: String(index) })))).toHaveLength(8);
  });
  it("serializes concurrent edits and keeps memory unchanged when saving fails", async () => {
    vi.mocked(api.loadStore).mockResolvedValue(JSON.stringify([{ id: "dev", name: "Dev", items: [] }]));
    await loadWorkspaces();
    expect(workspaces().map(space => space.name)).toEqual(["Dev"]);
    await Promise.all([pinItem("dev", { path: "editor", name: "Editor", isFolder: false }), createWorkspace("Projects")]);
    expect(workspaces()).toHaveLength(2);
    expect(workspaces()[0].items[0].name).toBe("Editor");
    vi.mocked(api.saveStore).mockRejectedValueOnce(new Error("disk full"));
    await expect(createWorkspace("Not saved")).rejects.toThrow("disk full");
    expect(workspaces()).toHaveLength(2);
    await createWorkspace("Recovered");
    expect(workspaces()).toHaveLength(3);
  });
  it("starts a fresh profile with Desktop alone, so the plus page is how the first extra screen appears", async () => {
    vi.mocked(api.loadStore).mockResolvedValue(null);
    await loadWorkspaces();
    expect(workspaces()).toEqual([]);
    expect(nextScreenName()).toBe("Screen 2");
  });
  it("drops the two empty placeholder screens older versions created, and nothing the user touched", () => {
    const placeholder = (number: number) => ({ id: `screen-${number}`, name: `Screen ${number}`, items: [] });
    const item = { path: "editor", name: "Editor", isFolder: false };
    const kept = [
      { id: "screen-2", name: "Screen 2", items: [item] }, // holds something
      { id: "screen-3", name: "Reading", items: [] }, // renamed
      { id: "mine", name: "Screen 2", items: [] }, // not the seeded id
    ];
    expect(withoutSeededScreens([placeholder(2), placeholder(3), ...kept]).map(space => space.id)).toEqual(["screen-2", "screen-3", "mine"]);
    expect(withoutSeededScreens([placeholder(2), placeholder(3)])).toEqual([]);
  });
});
