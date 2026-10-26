import { api } from "./api";

export type GlassStyle = "solid" | "liquid" | "frost" | "clear" | "custom";
/** Retained for a later roadmap phase; no rail work runs in the current build. */
export const RAIL_AVAILABLE = false;

export type Settings = {
  glassStyle: GlassStyle;
  backdropBlur: number;
  backdropSaturation: number;
  backdropBrightness: number;
  tintColor: string;
  tintStrength: number;
  paneBlur: number;
  refraction: number;
  cornerRadius: number;
  tileGlass: number;
  customSurfaceColor: string;
  customSurfaceOpacity: number;
  clearCanvas: boolean;
  iconSize: "small" | "medium" | "large";
  showLabels: boolean;
  groupsFirst: boolean;
  sortBy: "name" | "frequent";
  rail: boolean;
  railSide: "right" | "left";
  railMagnify: boolean;
  railPreviews: boolean;
  closeOnClickOff: boolean;
  closeOnBlur: boolean;
  animations: boolean;
  fabricEntrance: boolean;
};

export const DEFAULTS: Settings = {
  glassStyle: "frost",
  backdropBlur: 22,
  backdropSaturation: 1.35,
  backdropBrightness: 0.96,
  tintColor: "#0b1226",
  tintStrength: 0.2,
  paneBlur: 15,
  refraction: 0,
  cornerRadius: 24,
  tileGlass: 0.16,
  customSurfaceColor: "#496f9d",
  customSurfaceOpacity: 0.72,
  clearCanvas: false,
  iconSize: "medium",
  showLabels: true,
  groupsFirst: true,
  sortBy: "name",
  rail: false,
  railSide: "right",
  railMagnify: true,
  railPreviews: true,
  closeOnClickOff: true,
  closeOnBlur: true,
  animations: true,
  fabricEntrance: true,
};

export type MaterialSettings = Pick<Settings, "paneBlur" | "refraction" | "cornerRadius" | "tileGlass">;

const PRESET_MATERIALS: Record<Exclude<GlassStyle, "custom">, MaterialSettings> = {
  solid: { paneBlur: 0, refraction: 0, cornerRadius: 24, tileGlass: 0.16 },
  liquid: { paneBlur: 8, refraction: 0.7, cornerRadius: 30, tileGlass: 0.24 },
  frost: { paneBlur: 18, refraction: 0, cornerRadius: 24, tileGlass: 0.16 },
  clear: { paneBlur: 0, refraction: 0, cornerRadius: 24, tileGlass: 0.08 },
};

export function materialSettings(source: Settings): MaterialSettings {
  if (source.glassStyle === "custom") {
    return {
      paneBlur: source.paneBlur,
      refraction: source.refraction,
      cornerRadius: source.cornerRadius,
      tileGlass: source.tileGlass,
    };
  }
  return PRESET_MATERIALS[source.glassStyle];
}

const STORAGE_KEY = "opaline.settings";
const TILE_SIZES = { small: 60, medium: 72, large: 88 } as const;
const STYLES = new Set<GlassStyle>(["solid", "liquid", "frost", "clear", "custom"]);

/** Accepts names used by early prototypes while keeping invalid storage out of body attributes. */
export function normalizeGlassStyle(value: unknown): GlassStyle {
  if (value === "glass") return "liquid";
  if (value === "frosted") return "frost";
  return typeof value === "string" && STYLES.has(value as GlassStyle) ? (value as GlassStyle) : DEFAULTS.glassStyle;
}

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    const merged: Settings = { ...DEFAULTS };
    // keep only known keys of the right type, so an old or hand-edited file can't break the UI
    for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
      if (key === "glassStyle") continue;
      if (typeof saved[key] === typeof DEFAULTS[key]) (merged as Record<string, unknown>)[key] = saved[key];
    }
    merged.glassStyle = normalizeGlassStyle(saved.glassStyle);
    // The current UI intentionally exposes one coherent acrylic material. Retain the broader
    // schema for backwards compatibility, but migrate old liquid/clear choices into acrylic.
    merged.glassStyle = "frost";
    merged.clearCanvas = false;
    merged.refraction = 0;
    if (!/^#[0-9a-f]{6}$/i.test(merged.customSurfaceColor)) merged.customSurfaceColor = DEFAULTS.customSurfaceColor;
    merged.customSurfaceOpacity = Math.min(1, Math.max(0.2, merged.customSurfaceOpacity));
    return merged;
  } catch {
    return { ...DEFAULTS };
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // storage disabled: settings just won't persist
  }
}

let current: Settings = load();
const listeners = new Set<(settings: Settings) => void>();
let appliedCloseOnBlur: boolean | undefined;
let appliedBackdropCapture: boolean | undefined;

export const settings = (): Settings => current;

export function onSettingsChange(listener: (settings: Settings) => void) {
  listeners.add(listener);
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  save();
  applySettings();
  listeners.forEach((listener) => listener(current));
}

export function resetSettings() {
  updateSettings({ ...DEFAULTS });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  const value = match ? parseInt(match[1], 16) : 0x0b1226;
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/** Pushes the settings into CSS variables and body attributes; the stylesheet does the rest. */
export function applySettings() {
  const s = current;
  const material = materialSettings(s);
  const root = document.documentElement.style;
  const { r, g, b } = hexToRgb(s.tintColor);
  const custom = hexToRgb(s.customSurfaceColor);

  root.setProperty("--bd-blur", `${s.backdropBlur}px`);
  root.setProperty("--bd-sat", String(s.backdropSaturation));
  root.setProperty("--bd-bright", String(s.backdropBrightness));
  root.setProperty("--tint", `rgba(${r}, ${g}, ${b}, ${s.tintStrength})`);
  root.setProperty("--pane-blur", `${Math.min(32, s.backdropBlur * 0.7)}px`);
  root.setProperty("--radius", `${material.cornerRadius}px`);
  root.setProperty("--plate", String(material.tileGlass));
  root.setProperty("--custom-rgb", `${custom.r}, ${custom.g}, ${custom.b}`);
  root.setProperty("--custom-opacity", String(s.customSurfaceOpacity));
  root.setProperty("--tile", `${TILE_SIZES[s.iconSize]}px`);

  const body = document.body.dataset;
  body.style = "frost";
  body.canvas = "frosted";
  body.labels = String(s.showLabels);
  body.rail = String(RAIL_AVAILABLE && s.rail);
  body.railSide = s.railSide;
  body.anim = String(s.animations);
  body.entry = s.fabricEntrance ? "fabric" : "fade";
  const luminance = (custom.r * 0.2126 + custom.g * 0.7152 + custom.b * 0.0722) / 255;
  body.surfaceTone = luminance > 0.62 && s.customSurfaceOpacity > 0.55 ? "light" : "dark";

  if (appliedCloseOnBlur !== s.closeOnBlur) {
    appliedCloseOnBlur = s.closeOnBlur;
    void api.setBehavior(s.closeOnBlur).catch(() => {
      appliedCloseOnBlur = undefined;
    });
  }
  const captureBackdrop = true;
  if (appliedBackdropCapture !== captureBackdrop) {
    appliedBackdropCapture = captureBackdrop;
    void api.setBackdropCapture(captureBackdrop).catch(() => {
      appliedBackdropCapture = undefined;
    });
  }
}
