import { describe, expect, it, vi } from "vitest";
vi.mock("../src/api", () => ({ api: { loadStore: vi.fn(), saveStore: vi.fn().mockResolvedValue(undefined) } }));
import { api } from "../src/api";
import { createWorkspace, loadWorkspaces, normalizeWorkspaces, pinItem, workspaces } from "../src/workspaces";

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
    expect(workspaces().map(space => space.name)).toEqual(["Dev", "Screen 3"]);
    await Promise.all([pinItem("dev", { path: "editor", name: "Editor", isFolder: false }), createWorkspace("Projects")]);
    expect(workspaces()).toHaveLength(3);
    expect(workspaces()[0].items[0].name).toBe("Editor");
    vi.mocked(api.saveStore).mockRejectedValueOnce(new Error("disk full"));
    await expect(createWorkspace("Not saved")).rejects.toThrow("disk full");
    expect(workspaces()).toHaveLength(3);
    await createWorkspace("Recovered");
    expect(workspaces()).toHaveLength(4);
  });
});
