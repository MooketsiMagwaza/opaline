import { describe, expect, it } from "vitest";
import { absorbLiveChanges, stagedChanges } from "../src/settings/draft";
import { DEFAULTS, normalizeSettings, type Settings } from "../src/settings/store";

const withSettings = (patch: Partial<Settings>): Settings => normalizeSettings({ ...DEFAULTS, ...patch });

describe("settings draft", () => {
  it("reports only the keys the user staged", () => {
    const baseline = withSettings({});
    expect(stagedChanges(baseline, withSettings({ animations: false, surfaceWidth: 800 }))).toEqual({ animations: false, surfaceWidth: 800 });
    expect(stagedChanges(baseline, baseline)).toEqual({});
  });

  it("keeps a live change made elsewhere while a different edit is staged", () => {
    const baseline = withSettings({});
    const draft = withSettings({ animations: false });
    const live = withSettings({ compactBar: true }); // Ctrl+B pressed while Settings is open

    const merged = absorbLiveChanges(baseline, draft, live);

    expect(merged.draft.compactBar).toBe(true);
    expect(merged.draft.animations).toBe(false);
    expect(stagedChanges(merged.baseline, merged.draft)).toEqual({ animations: false });
  });

  it("lets a staged value win over a live change to the same key", () => {
    const baseline = withSettings({ surfaceWidth: 960 });
    const draft = withSettings({ surfaceWidth: 800 });
    const live = withSettings({ surfaceWidth: 1200 });

    const merged = absorbLiveChanges(baseline, draft, live);

    expect(merged.baseline.surfaceWidth).toBe(1200);
    expect(merged.draft.surfaceWidth).toBe(800);
    expect(stagedChanges(merged.baseline, merged.draft)).toEqual({ surfaceWidth: 800 });
  });

  it("is idempotent and leaves nothing dirty once the staged changes are applied", () => {
    const baseline = withSettings({});
    const draft = withSettings({ animations: false });
    const live = withSettings({ compactBar: true });

    const once = absorbLiveChanges(baseline, draft, live);
    expect(absorbLiveChanges(once.baseline, once.draft, live)).toEqual(once);

    const applied = withSettings({ ...live, ...stagedChanges(once.baseline, once.draft) });
    const afterDone = absorbLiveChanges(once.baseline, once.draft, applied);
    expect(stagedChanges(afterDone.baseline, afterDone.draft)).toEqual({});
    expect(afterDone.draft).toEqual(applied);
  });
});
