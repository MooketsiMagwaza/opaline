import { describe, expect, it } from "vitest";

import { DEFAULTS, materialSettings, normalizeGlassStyle, normalizeSettings } from "../src/settings";

describe("theme migration", () => {
  it("rejects corrupt enums, invalid colours and out-of-range or non-finite values", () => {
    const result = normalizeSettings({ iconSize: "huge", sortBy: "random", tintColor: "javascript:bad", backdropBlur: -100, tintStrength: Infinity, pageShortcut: "alt-tab", compactBar: "yes", paneMotionMs: 900 });
    expect(result.iconSize).toBe(DEFAULTS.iconSize);
    expect(result.sortBy).toBe("name");
    expect(result.tintColor).toBe(DEFAULTS.tintColor);
    expect(result.backdropBlur).toBe(0);
    expect(result.tintStrength).toBe(DEFAULTS.tintStrength);
    expect(result.compactBar).toBe(false);
    expect(result.paneMotionMs).toBe(500);
    expect(normalizeSettings({ taskbarIconSize: 44 }).taskbarIconSize).toBe(36);
    expect(normalizeSettings(null)).toEqual(DEFAULTS);
  });
  it("keeps current themes and migrates prototype names", () => {
    expect(normalizeGlassStyle("solid")).toBe("solid");
    expect(normalizeGlassStyle("liquid")).toBe("liquid");
    expect(normalizeGlassStyle("frost")).toBe("frost");
    expect(normalizeGlassStyle("clear")).toBe("clear");
    expect(normalizeGlassStyle("custom")).toBe("custom");
    expect(normalizeGlassStyle("glass")).toBe("liquid");
    expect(normalizeGlassStyle("frosted")).toBe("frost");
  });

  it("falls back from unknown persisted values", () => {
    expect(normalizeGlassStyle("neon")).toBe("frost");
    expect(normalizeGlassStyle(null)).toBe("frost");
  });

  it("keeps named preset materials deterministic and Custom values independent", () => {
    expect(materialSettings({ ...DEFAULTS, glassStyle: "solid", paneBlur: 27 }).paneBlur).toBe(0);
    expect(materialSettings({ ...DEFAULTS, glassStyle: "liquid", refraction: 0.1 }).refraction).toBe(0.7);
    expect(materialSettings({ ...DEFAULTS, glassStyle: "frost", paneBlur: 1 }).paneBlur).toBe(18);
    expect(materialSettings({ ...DEFAULTS, glassStyle: "clear", tileGlass: 0.5 }).tileGlass).toBe(0.08);
    expect(materialSettings({ ...DEFAULTS, glassStyle: "custom", paneBlur: 27 }).paneBlur).toBe(27);
  });
});
