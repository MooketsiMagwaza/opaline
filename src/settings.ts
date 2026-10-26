import { api } from "./api";

export type GlassStyle = "liquid" | "frost" | "clear";

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
};

export const DEFAULTS: Settings = {
  glassStyle: "liquid",
  backdropBlur: 16,
  backdropSaturation: 1.35,
  backdropBrightness: 0.96,
  tintColor: "#0b1226",
  tintStrength: 0.16,
  paneBlur: 8,
  refraction: 0.7,
  cornerRadius: 30,
  tileGlass: 0.24,
  iconSize: "medium",
  showLabels: true,
  groupsFirst: true,
  sortBy: "name",
  rail: true,
  railSide: "right",
  railMagnify: true,
  railPreviews: true,
  closeOnClickOff: true,
  closeOnBlur: true,
  animations: true,
};

const STORAGE_KEY = "opaline.settings";
const TILE_SIZES = { small: 60, medium: 72, large: 88 } as const;

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    const merged: Settings = { ...DEFAULTS };
    // keep only known keys of the right type, so an old or hand-edited file can't break the UI
    for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
      if (typeof saved[key] === typeof DEFAULTS[key]) (merged as Record<string, unknown>)[key] = saved[key];
    }
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
  const root = document.documentElement.style;
  const { r, g, b } = hexToRgb(s.tintColor);

  root.setProperty("--bd-blur", `${s.backdropBlur}px`);
  root.setProperty("--bd-sat", String(s.backdropSaturation));
  root.setProperty("--bd-bright", String(s.backdropBrightness));
  root.setProperty("--tint", `rgba(${r}, ${g}, ${b}, ${s.tintStrength})`);
  root.setProperty("--pane-blur", `${s.paneBlur}px`);
  root.setProperty("--radius", `${s.cornerRadius}px`);
  root.setProperty("--plate", String(s.tileGlass));
  root.setProperty("--tile", `${TILE_SIZES[s.iconSize]}px`);

  const body = document.body.dataset;
  body.style = s.glassStyle;
  body.labels = String(s.showLabels);
  body.rail = String(s.rail);
  body.railSide = s.railSide;
  body.anim = String(s.animations);

  void api.setBehavior(s.closeOnBlur).catch(() => {});
}
