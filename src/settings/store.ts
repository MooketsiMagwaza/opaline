import { api } from "../core/api";

export type GlassStyle = "solid" | "liquid" | "frost" | "clear" | "custom";
export type MaterialProfile = "opaline" | "mica" | "one-ui" | "apple-glass" | "aero" | "night" | "custom";
export type NavigationMode = "split" | "taskbar" | "tray" | "ends" | "sidebar";
export type NavigationSide = "left" | "right";
export const NAVIGATION_LABELS: Record<NavigationMode, string> = {
  split: "Split header", taskbar: "Navigation taskbar", tray: "Dropdown tray", ends: "Taskbar ends", sidebar: "Sidebar",
};
export type DefaultPage = "home" | "all-apps";
export type BackgroundMode = "desktop" | "aero" | "custom";
export const RAIL_AVAILABLE = true;

export type Settings = {
  glassStyle: GlassStyle;
  materialProfile: MaterialProfile;
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
  railMagnify: boolean;
  railPreviews: boolean;
  closeOnClickOff: boolean;
  closeOnBlur: boolean;
  animations: boolean;
  compactBar: boolean;
  paneMotionMs: number;
  surfaceWidth: number;
  taskbarIconSize: number;
  navigationMode: NavigationMode;
  navigationSide: NavigationSide;
  defaultPage: DefaultPage;
  backgroundMode: BackgroundMode;
  customBackground: string;
  shortcutAllApps: boolean;
  shortcutScreenTime: boolean;
  shortcutFocus: boolean;
  shortcutSettings: boolean;
  scrollbarWidth: number;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  quoteIntervalSeconds: number;
  screenSaverEnabled: boolean;
  screenSaverIdleMinutes: number;
};

export const DEFAULTS: Settings = {
  glassStyle: "frost",
  materialProfile: "opaline",
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
  rail: true,
  railMagnify: false,
  railPreviews: true,
  closeOnClickOff: true,
  closeOnBlur: true,
  animations: true,
  compactBar: false,
  paneMotionMs: 320,
  surfaceWidth: 960,
  taskbarIconSize: 30,
  navigationMode: "split",
  navigationSide: "left",
  defaultPage: "home",
  backgroundMode: "desktop",
  customBackground: "",
  shortcutAllApps: true,
  shortcutScreenTime: true,
  shortcutFocus: true,
  shortcutSettings: true,
  scrollbarWidth: 8,
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  quoteIntervalSeconds: 25,
  screenSaverEnabled: false,
  screenSaverIdleMinutes: 5,
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

export function normalizeSettings(value: unknown): Settings {
    const saved = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const merged: Settings = { ...DEFAULTS };
    // keep only known keys of the right type, so an old or hand-edited file can't break the UI
    for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
      if (key === "glassStyle") continue;
      if (typeof saved[key] === typeof DEFAULTS[key]) (merged as Record<string, unknown>)[key] = saved[key];
    }
    merged.glassStyle = normalizeGlassStyle(saved.glassStyle);
    merged.clearCanvas = false;
    merged.refraction = 0;
    for (const key of ["tintColor", "customSurfaceColor"] as const) {
      if (!/^#[0-9a-f]{6}$/i.test(merged[key])) merged[key] = DEFAULTS[key];
    }
    if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(merged.customBackground) || merged.customBackground.length > 3_500_000) merged.customBackground = "";
    const ranges = { backdropBlur: [0, 40], backdropSaturation: [0, 3], backdropBrightness: [0.2, 2], tintStrength: [0.06, 0.5], paneBlur: [0, 40], refraction: [0, 1], cornerRadius: [0, 60], tileGlass: [0, 1], customSurfaceOpacity: [0.2, 1], paneMotionMs: [160, 500], surfaceWidth: [640, 1280], taskbarIconSize: [24, 36], scrollbarWidth: [6, 14], focusMinutes: [1, 90], shortBreakMinutes: [1, 30], longBreakMinutes: [5, 60], quoteIntervalSeconds: [5, 120], screenSaverIdleMinutes: [1, 60] } as const;
    for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
      const [min, max] = ranges[key];
      merged[key] = Number.isFinite(merged[key]) ? Math.min(max, Math.max(min, merged[key])) : DEFAULTS[key];
    }
    for (const [key, values] of Object.entries({ iconSize: ["small", "medium", "large"], sortBy: ["name", "frequent"], navigationMode: ["split", "taskbar", "tray", "ends", "sidebar"], navigationSide: ["left", "right"], defaultPage: ["home", "all-apps"], backgroundMode: ["desktop", "aero", "custom"], materialProfile: ["opaline", "mica", "one-ui", "apple-glass", "aero", "night", "custom"] })) {
      if (!values.includes(String(merged[key as keyof Settings]))) (merged as Record<string, unknown>)[key] = DEFAULTS[key as keyof Settings];
    }
    return merged;
}

/**
 * Navigation controls only minimise when the taskbar mirror is showing: that is where the button that brings them back lives,
 * so without it the controls would vanish with no way to restore them but the keyboard.
 */
export const compactNavigation = (s: Settings): boolean => RAIL_AVAILABLE && s.rail && s.compactBar;

function load(): Settings {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"));
  } catch {
    return { ...DEFAULTS };
  }
}

const SAVE_FAILURE_PREFIX = "Settings could not be saved";

/** The launcher's one status line for problems the user should see (it is announced as a status). */
function showNote(text: string) {
  const note = document.getElementById("navigation-note");
  if (note) note.textContent = text;
}

/** Settings keep working in memory when storage fails, but the user must know they will not survive a restart. */
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    const note = document.getElementById("navigation-note");
    if (note?.textContent?.startsWith(SAVE_FAILURE_PREFIX)) note.textContent = "";
  } catch (error) {
    showNote(`${SAVE_FAILURE_PREFIX}, so changes will be lost when Opaline restarts. ${String(error)}`);
  }
}

let current: Settings = load();
const listeners = new Set<(settings: Settings) => void>();
let appliedCloseOnBlur: boolean | undefined;
let appliedBackdropCapture: boolean | undefined;
let appliedScreenSaver: string | undefined;

export const settings = (): Settings => current;

export function onSettingsChange(listener: (settings: Settings) => void) {
  listeners.add(listener);
}

export function updateSettings(patch: Partial<Settings>) {
  current = normalizeSettings({ ...current, ...patch });
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
  root.setProperty("--pane-blur", `${Math.min(32, material.paneBlur)}px`);
  root.setProperty("--radius", `${material.cornerRadius}px`);
  root.setProperty("--plate", String(material.tileGlass));
  root.setProperty("--custom-rgb", `${custom.r}, ${custom.g}, ${custom.b}`);
  root.setProperty("--custom-opacity", String(s.customSurfaceOpacity));
  root.setProperty("--tile", `${TILE_SIZES[s.iconSize]}px`);
  root.setProperty("--pane-motion", `${s.paneMotionMs}ms`);
  root.setProperty("--surface-width", `${s.surfaceWidth}px`);
  root.setProperty("--dock", `${s.taskbarIconSize}px`);
  root.setProperty("--scrollbar-width", `${s.scrollbarWidth}px`);

  const body = document.body.dataset;
  body.style = s.glassStyle;
  body.material = s.materialProfile;
  body.canvas = "frosted";
  body.labels = String(s.showLabels);
  body.rail = String(RAIL_AVAILABLE && s.rail);
  body.anim = String(s.animations);
  body.compactBar = String(compactNavigation(s));
  body.navigation = s.navigationMode;
  body.navigationSide = s.navigationSide;
  body.shortcutAllApps = String(s.shortcutAllApps);
  body.shortcutScreenTime = String(s.shortcutScreenTime);
  body.shortcutFocus = String(s.shortcutFocus);
  body.shortcutSettings = String(s.shortcutSettings);
  body.navigationOverflow = String(!s.shortcutAllApps || !s.shortcutScreenTime || !s.shortcutFocus || !s.shortcutSettings);
  const luminance = (custom.r * 0.2126 + custom.g * 0.7152 + custom.b * 0.0722) / 255;
  body.surfaceTone = luminance > 0.62 && s.customSurfaceOpacity > 0.55 ? "light" : "dark";
  const screenSaverSignature = `${s.screenSaverEnabled}:${s.screenSaverIdleMinutes}`;
  if (appliedScreenSaver !== screenSaverSignature) {
    appliedScreenSaver = screenSaverSignature;
    void api.setScreenSaver(s.screenSaverEnabled, s.screenSaverIdleMinutes).catch(error => {
      appliedScreenSaver = undefined;
      showNote(`Screen saver could not be configured: ${String(error)}`);
    });
  }

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
