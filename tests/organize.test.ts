import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/api", () => ({
  api: {
    loadStore: vi.fn(),
    saveStore: vi.fn().mockResolvedValue(undefined),
  },
}));

import type { Item } from "../src/api";
import { api } from "../src/api";
import { createGroup, groups, loadGroups } from "../src/groups";
import { organize } from "../src/organize";

const mockedApi = vi.mocked(api);
const item = (name: string, isFolder = false): Item => ({ name, path: `C:\\Desktop\\${name}`, isFolder });

describe("auto-organise", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", globalThis);
    mockedApi.saveStore.mockReset().mockResolvedValue(undefined);
    mockedApi.loadStore.mockReset().mockResolvedValueOnce(
      JSON.stringify({ version: 1, organized: false, groups: [], launches: {} }),
    );
    await loadGroups();
  });

  it("uses first-match rules and leaves singleton new panes loose", () => {
    const items = [
      item("Visual Studio Code"),
      item("Android Studio"),
      item("Claude"),
      item("ChatGPT"),
      item("Steam"),
      item("Semester_1", true),
      item("unmatched.txt"),
    ];

    expect(organize(items)).toBe(4);
    expect(groups().map(({ id, items: paths }) => [id, paths.length])).toEqual([
      ["ides", 2],
      ["ai", 2],
    ]);
  });

  it("adds a single newcomer to an existing pane and preserves manual groups", () => {
    createGroup("Games & music", [item("Spotify").path], "play");
    createGroup("Mine", [item("Visual Studio Code").path], "manual");

    expect(organize([item("Spotify"), item("VLC"), item("Visual Studio Code"), item("Android Studio")])).toBe(1);
    expect(groups().find((group) => group.id === "play")?.items).toContain(item("VLC").path);
    expect(groups().find((group) => group.id === "manual")?.items).toEqual([item("Visual Studio Code").path]);
  });
});
