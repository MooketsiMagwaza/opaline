import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/api", () => ({
  api: {
    loadStore: vi.fn(),
    saveStore: vi.fn().mockResolvedValue(undefined),
  },
}));

import { api } from "../src/api";
import {
  addToGroup,
  createGroup,
  forgetPosition,
  groupOf,
  groupPositionKey,
  groups,
  isOrganized,
  itemPositionKey,
  loadGroups,
  positionOf,
  prune,
  removeFromGroup,
  resetLayout,
  renameGroup,
  setPosition,
  setLayoutOrder,
  ungroup,
} from "../src/groups";

const emptyStore = () => JSON.stringify({ version: 1, organized: false, groups: [], launches: {} });
const mockedApi = vi.mocked(api);

async function reload(json = emptyStore()) {
  mockedApi.loadStore.mockResolvedValueOnce(json);
  await loadGroups();
}

describe("pane store", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", globalThis);
    mockedApi.loadStore.mockReset();
    mockedApi.saveStore.mockReset().mockResolvedValue(undefined);
    await reload();
  });

  it("loads only valid pane data", async () => {
    await reload(
      JSON.stringify({
        version: 99,
        organized: true,
        groups: [
          { id: "tools", name: 12, items: ["a", 7, "b"] },
          { id: null, name: "bad", items: [] },
        ],
        launches: {},
      }),
    );

    expect(isOrganized()).toBe(true);
    expect(groups()).toEqual([{ id: "tools", name: "12", items: ["a", "b"] }]);
  });

  it("moves an item between panes without touching the item itself", () => {
    createGroup("First", ["a", "b"], "first");
    createGroup("Second", ["c"], "second");
    addToGroup("second", "a");

    expect(groupOf("a")?.id).toBe("second");
    expect(groups().find((group) => group.id === "first")?.items).toEqual(["b"]);

    removeFromGroup("b");
    expect(groups().some((group) => group.id === "first")).toBe(false);
  });

  it("renames, prunes, ungroups and persists changes", async () => {
    createGroup("Draft", ["a", "gone"], "draft");
    renameGroup("draft", "  Keepers  ");
    expect(prune(new Set(["a"]))).toBe(true);
    expect(groups()).toEqual([{ id: "draft", name: "Keepers", items: ["a"] }]);

    await vi.advanceTimersByTimeAsync(300);
    expect(mockedApi.saveStore).toHaveBeenLastCalledWith(
      "groups.json",
      expect.stringContaining('"name":"Keepers"'),
    );

    ungroup("draft");
    expect(groups()).toEqual([]);
  });

  it("stores resolution-independent canvas positions and removes stale pane positions", async () => {
    const itemKey = itemPositionKey("C:\\Desktop\\Notes");
    const paneKey = groupPositionKey("draft");
    createGroup("Draft", ["a"], "draft");
    setPosition(itemKey, { x: 1.4, y: -0.2 });
    setPosition(paneKey, { x: 0.12555, y: 0.75 });

    expect(positionOf(itemKey)).toEqual({ x: 1, y: 0 });
    expect(positionOf(paneKey)).toEqual({ x: 0.1256, y: 0.75 });

    ungroup("draft");
    expect(positionOf(paneKey)).toBeUndefined();
    forgetPosition(itemKey);
    expect(positionOf(itemKey)).toBeUndefined();

    await vi.advanceTimersByTimeAsync(300);
    expect(mockedApi.saveStore).toHaveBeenCalled();
  });

  it("prunes positions for Desktop entries and panes that no longer exist", () => {
    const liveKey = itemPositionKey("C:\\Desktop\\Live");
    const goneKey = itemPositionKey("C:\\Desktop\\Gone");
    setPosition(liveKey, { x: 0.2, y: 0.3 });
    setPosition(goneKey, { x: 0.4, y: 0.5 });
    setPosition(groupPositionKey("missing"), { x: 0.6, y: 0.7 });

    expect(prune(new Set(["C:\\Desktop\\Live"]))).toBe(true);
    expect(positionOf(liveKey)).toEqual({ x: 0.2, y: 0.3 });
    expect(positionOf(goneKey)).toBeUndefined();
    expect(positionOf(groupPositionKey("missing"))).toBeUndefined();
  });

  it("stores a deterministic centred-grid order", () => {
    const first = itemPositionKey("C:\\Desktop\\First");
    const second = groupPositionKey("second");
    const third = itemPositionKey("C:\\Desktop\\Third");

    setLayoutOrder([second, first, third, second]);

    expect(positionOf(second)).toEqual({ x: 0, y: 0 });
    expect(positionOf(first)).toEqual({ x: 0.5, y: 0 });
    expect(positionOf(third)).toEqual({ x: 1, y: 0 });
  });

  it("resets grid order without dissolving panes", () => {
    const itemKey = itemPositionKey("C:\\Desktop\\First");
    createGroup("Keep", ["a", "b"], "keep");
    setLayoutOrder([groupPositionKey("keep"), itemKey]);

    resetLayout();

    expect(positionOf(itemKey)).toBeUndefined();
    expect(positionOf(groupPositionKey("keep"))).toBeUndefined();
    expect(groups()).toEqual([{ id: "keep", name: "Keep", items: ["a", "b"] }]);
  });
});
