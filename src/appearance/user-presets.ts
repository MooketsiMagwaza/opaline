import { appearanceValues } from "./presets";
import { DEFAULTS, normalizeSettings, type Settings } from "../settings/store";

const STORAGE_KEY = "opaline.appearance.profiles";
const LEGACY_KEY = "opaline.appearance.personal";
const PROFILE_KEYS = [
  "glassStyle", "materialProfile", "backdropBlur", "backdropSaturation", "backdropBrightness", "tintColor", "tintStrength",
  "paneBlur", "cornerRadius", "tileGlass", "customSurfaceColor", "customSurfaceOpacity", "iconSize",
  "showLabels", "groupsFirst", "rail", "railMagnify", "railPreviews", "animations",
  "compactBar", "paneMotionMs", "surfaceWidth", "taskbarIconSize", "navigationMode", "defaultPage",
  "backgroundMode",
  "shortcutAllApps", "shortcutScreenTime", "shortcutFocus", "shortcutSettings", "scrollbarWidth",
] as const;

export type VisualProfileSettings = Pick<Settings, (typeof PROFILE_KEYS)[number]>;
export type UserVisualPreset = {
  id: string;
  name: string;
  createdAt: string;
  settings: VisualProfileSettings;
};

type PresetBundle = {
  schema: "opaline-visual-presets";
  version: 1;
  presets: UserVisualPreset[];
};

function capture(source: Settings): VisualProfileSettings {
  return Object.fromEntries(PROFILE_KEYS.map(key => [key, source[key]])) as VisualProfileSettings;
}

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 48) : "";
}

function readPreset(value: unknown): UserVisualPreset | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<UserVisualPreset>;
  const name = cleanName(raw.name);
  if (!name || !raw.settings || typeof raw.settings !== "object") return null;
  const normalized = normalizeSettings({ ...DEFAULTS, ...raw.settings });
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id.slice(0, 80) : crypto.randomUUID(),
    name,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    settings: capture(normalized),
  };
}

/** Keeps the first preset using an id and gives later ones a fresh id, so each can be removed on its own. */
export function withUniqueIds(presets: UserVisualPreset[], newId: () => string = () => crypto.randomUUID()): UserVisualPreset[] {
  const seen = new Set<string>();
  return presets.map(preset => {
    const id = seen.has(preset.id) ? newId() : preset.id;
    seen.add(id);
    return id === preset.id ? preset : { ...preset, id };
  });
}

/** Throws when the presets cannot be persisted, so callers report it instead of showing a save that never happened. */
function store(presets: UserVisualPreset[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets.slice(0, 24))); }
  catch (error) { throw new Error(`Presets could not be saved because browser storage is full or unavailable. ${String(error)}`); }
}

export function loadUserPresets(fallback?: Settings): UserVisualPreset[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(parsed)) return withUniqueIds(parsed.map(readPreset).filter((preset): preset is UserVisualPreset => Boolean(preset))).slice(0, 24);
  } catch { /* Invalid local data is ignored. */ }

  // Migrate the original single "My Opaline" appearance once.
  if (fallback) {
    try {
      const legacy: unknown = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null");
      if (legacy && typeof legacy === "object") {
        const migrated = readPreset({ id: "my-opaline", name: "My Opaline", settings: { ...fallback, ...appearanceValues(legacy as Settings) } });
        if (migrated) {
          try { store([migrated]); } catch { /* The legacy value stays in place and migrates again on the next load. */ }
          return [migrated];
        }
      }
    } catch { /* A malformed legacy value is skipped. */ }
  }
  return [];
}

export function saveUserPreset(name: string, source: Settings): UserVisualPreset[] {
  const clean = cleanName(name);
  if (!clean) throw new Error("Preset name is required.");
  const existing = loadUserPresets();
  const match = existing.find(preset => preset.name.toLocaleLowerCase() === clean.toLocaleLowerCase());
  const next: UserVisualPreset = {
    id: match?.id ?? crypto.randomUUID(),
    name: clean,
    createdAt: new Date().toISOString(),
    settings: capture(source),
  };
  const presets = [next, ...existing.filter(preset => preset.id !== next.id)].slice(0, 24);
  store(presets);
  return presets;
}

export function removeUserPreset(id: string): UserVisualPreset[] {
  const presets = loadUserPresets().filter(preset => preset.id !== id);
  store(presets);
  return presets;
}

export function exportUserPresets(presets = loadUserPresets()): string {
  const bundle: PresetBundle = { schema: "opaline-visual-presets", version: 1, presets };
  return JSON.stringify(bundle, null, 2);
}

export function importUserPresets(text: string): UserVisualPreset[] {
  const input: unknown = JSON.parse(text);
  if (!input || typeof input !== "object") throw new Error("This is not an Opaline preset file.");
  const bundle = input as Partial<PresetBundle>;
  if (bundle.schema !== "opaline-visual-presets" || bundle.version !== 1 || !Array.isArray(bundle.presets)) {
    throw new Error("This is not a supported Opaline preset file.");
  }
  const imported = withUniqueIds(bundle.presets.map(readPreset).filter((preset): preset is UserVisualPreset => Boolean(preset)));
  if (!imported.length) throw new Error("No valid presets were found.");
  const merged = [...imported, ...loadUserPresets().filter(saved => !imported.some(preset => preset.id === saved.id || preset.name.toLocaleLowerCase() === saved.name.toLocaleLowerCase()))].slice(0, 24);
  store(merged);
  return merged;
}

export function matchesUserPreset(current: Settings, preset: UserVisualPreset): boolean {
  return PROFILE_KEYS.every(key => current[key] === preset.settings[key]);
}
