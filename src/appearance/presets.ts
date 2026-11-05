import type { Settings } from "../settings/store";

const APPEARANCE_KEYS = [
  "glassStyle", "materialProfile", "backdropBlur", "backdropSaturation", "backdropBrightness", "tintColor", "tintStrength",
  "paneBlur", "refraction", "cornerRadius", "tileGlass", "customSurfaceColor", "customSurfaceOpacity",
  "backgroundMode",
] as const;

export type AppearanceValues = Pick<Settings, (typeof APPEARANCE_KEYS)[number]>;
export type AppearancePreset = AppearanceValues & {
  id: string;
  name: string;
  description: string;
};

export const APPEARANCE_PRESETS: readonly AppearancePreset[] = [
  { id: "opaline-original", name: "Opaline Original", description: "Balanced cool acrylic and soft rounded surfaces.", glassStyle: "frost", materialProfile: "opaline", backgroundMode: "desktop", backdropBlur: 22, backdropSaturation: 1.35, backdropBrightness: .96, tintColor: "#0b1226", tintStrength: .2, paneBlur: 18, refraction: 0, cornerRadius: 24, tileGlass: .16, customSurfaceColor: "#496f9d", customSurfaceOpacity: .72 },
  { id: "windows-mica", name: "Windows Mica", description: "WinUI 3-inspired: restrained, flatter and mostly opaque.", glassStyle: "custom", materialProfile: "mica", backgroundMode: "desktop", backdropBlur: 5, backdropSaturation: 1.05, backdropBrightness: .88, tintColor: "#20242d", tintStrength: .34, paneBlur: 3, refraction: 0, cornerRadius: 12, tileGlass: .06, customSurfaceColor: "#20242d", customSurfaceOpacity: .9 },
  { id: "one-ui-glass", name: "One UI Glass", description: "Deep violet glass, generous curves and softer separation.", glassStyle: "custom", materialProfile: "one-ui", backgroundMode: "desktop", backdropBlur: 26, backdropSaturation: 1.42, backdropBrightness: .94, tintColor: "#211a35", tintStrength: .22, paneBlur: 24, refraction: 0, cornerRadius: 34, tileGlass: .24, customSurfaceColor: "#392d5a", customSurfaceOpacity: .72 },
  { id: "frutiger-aero", name: "Frutiger Aero", description: "Saturated aqua glass with a bright Opaline landscape.", glassStyle: "custom", materialProfile: "aero", backgroundMode: "aero", backdropBlur: 14, backdropSaturation: 1.85, backdropBrightness: 1.1, tintColor: "#0b5362", tintStrength: .14, paneBlur: 10, refraction: 0, cornerRadius: 20, tileGlass: .2, customSurfaceColor: "#167c92", customSurfaceOpacity: .58 },
  { id: "deep-night", name: "Deep Night", description: "Dense near-black glass for bright and visually busy desktops.", glassStyle: "custom", materialProfile: "night", backgroundMode: "desktop", backdropBlur: 30, backdropSaturation: 1.12, backdropBrightness: .68, tintColor: "#080d1a", tintStrength: .42, paneBlur: 26, refraction: 0, cornerRadius: 18, tileGlass: .1, customSurfaceColor: "#080d18", customSurfaceOpacity: .9 },
] as const;

export function appearanceValues(settings: Settings): AppearanceValues {
  return Object.fromEntries(APPEARANCE_KEYS.map(key => [key, settings[key]])) as AppearanceValues;
}

export function matchesAppearance(left: AppearanceValues, right: AppearanceValues): boolean {
  return APPEARANCE_KEYS.every(key => {
    const a = left[key], b = right[key];
    if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < .001;
    return String(a).toLowerCase() === String(b).toLowerCase();
  });
}
