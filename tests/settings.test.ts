import { describe, expect, it } from "vitest";

import { DEFAULTS, materialSettings, normalizeGlassStyle } from "../src/settings";

describe("theme migration", () => {
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
