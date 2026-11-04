import { describe, expect, it } from "vitest";
import { APPEARANCE_PRESETS, appearanceValues } from "../src/appearance/presets";
import { DEFAULTS, normalizeSettings } from "../src/settings/store";

describe("appearance presets", () => {
  it("uses distinct complete material recipes", () => {
    const signatures = APPEARANCE_PRESETS.map(preset => JSON.stringify(appearanceValues(normalizeSettings({ ...DEFAULTS, ...preset }))));
    expect(new Set(signatures).size).toBe(APPEARANCE_PRESETS.length);
  });

  it("keeps Windows Mica restrained and mostly opaque", () => {
    const mica = APPEARANCE_PRESETS.find(preset => preset.id === "windows-mica")!;
    expect(mica.glassStyle).toBe("custom");
    expect(mica.materialProfile).toBe("mica");
    expect(mica.customSurfaceOpacity).toBeGreaterThanOrEqual(.85);
    expect(mica.paneBlur).toBeLessThanOrEqual(4);
    expect(mica.cornerRadius).toBeLessThanOrEqual(12);
  });

  it("gives Frutiger Aero its own background recipe", () => {
    expect(APPEARANCE_PRESETS.find(preset => preset.id === "frutiger-aero")?.backgroundMode).toBe("aero");
  });

  it("preserves a selected custom material during validation", () => {
    expect(normalizeSettings({ ...DEFAULTS, glassStyle: "custom" }).glassStyle).toBe("custom");
  });
});
