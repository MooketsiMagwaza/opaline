import type { Settings } from "./store";
import { materialSettings } from "./store";
import { resolvedBackground } from "../appearance/background";

type PreviewOptions = { settings: Settings; className: string };
type PreviewState = { frame: HTMLIFrameElement; wanted: Settings; applied: Settings; loaded: boolean };

const TILE_SIZES = { small: 60, medium: 72, large: 88 } as const;
const MAX_SHARED_IMAGES = 4;
let cachedPreviewCss = "";
const previews = new WeakMap<HTMLElement, PreviewState>();
const sharedImages = new Map<string, string>();

function previewCss(): string {
  if (cachedPreviewCss) return cachedPreviewCss;
  const read = (sheet: CSSStyleSheet): string => {
    try {
      return [...sheet.cssRules].map(rule => rule instanceof CSSImportRule && rule.styleSheet ? read(rule.styleSheet) : rule.cssText).join("\n");
    } catch { return ""; }
  };
  cachedPreviewCss = [...document.styleSheets].map(read).join("\n");
  return cachedPreviewCss;
}

/**
 * Every preview used to embed its own copy of the multi-megabyte backdrop data URL. One in-memory blob
 * URL per image lets all previews share it. Nothing is persisted; unreadable sources are used as given.
 */
function shareImage(source: string): string {
  if (!source.startsWith("data:image/")) return source;
  const known = sharedImages.get(source);
  if (known) return known;
  const comma = source.indexOf(",");
  const header = source.slice(5, comma);
  if (comma < 0 || !header.endsWith(";base64")) return source;
  try {
    const binary = atob(source.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    const url = URL.createObjectURL(new Blob([bytes], { type: header.slice(0, -";base64".length) }));
    sharedImages.set(source, url);
    if (sharedImages.size > MAX_SHARED_IMAGES) {
      const [oldestSource, oldestUrl] = sharedImages.entries().next().value!;
      URL.revokeObjectURL(oldestUrl);
      sharedImages.delete(oldestSource);
    }
    return url;
  } catch {
    return source;
  }
}

function backdropSource(settings: Settings): string | null {
  const live = document.getElementById("backdrop") as HTMLImageElement | null;
  const chosen = resolvedBackground(settings, live?.dataset.desktopSrc || live?.getAttribute("src") || null);
  return chosen ? shareImage(chosen) : null;
}

function rgb(hex: string): { r: number; g: number; b: number } {
  const value = parseInt(hex.replace("#", ""), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function homeStage(settings: Settings): HTMLElement {
  const source = document.getElementById("stage");
  if (!source) return document.createElement("div");
  const stage = source.cloneNode(true) as HTMLElement;
  stage.classList.remove("pre", "overlay-enter", "overlay-leave");
  stage.querySelectorAll("#app-list-surface,#workspace-surface,#screen-time-surface,#focus-surface,#settings-surface,#item-picker,#ambient,#popup-layer,#menu,#preview,#tile-peek,#gesture-cue,#page-edges,#navigation-note").forEach(node => node.remove());
  const home = stage.querySelector<HTMLElement>("#apps-surface");
  if (home) home.hidden = false;
  stage.querySelectorAll("[aria-current='page']").forEach(node => node.removeAttribute("aria-current"));
  stage.querySelector("#home-dock")?.setAttribute("aria-current", "page");
  const search = stage.querySelector<HTMLInputElement>("#search");
  if (search) search.value = "";
  const backdrop = stage.querySelector<HTMLImageElement>("#backdrop");
  if (backdrop) applyBackdrop(backdrop, settings);
  return stage;
}

function applyBackdrop(image: HTMLImageElement, settings: Settings) {
  const source = backdropSource(settings);
  if (!source) {
    image.removeAttribute("src");
    image.hidden = true;
    return;
  }
  if (image.getAttribute("src") !== source) image.src = source;
  image.hidden = false;
}

function rootStyle(settings: Settings): string {
  const tint = rgb(settings.tintColor);
  const custom = rgb(settings.customSurfaceColor);
  const material = materialSettings(settings);
  return [
    `--bd-blur:${settings.backdropBlur}px`, `--bd-sat:${settings.backdropSaturation}`, `--bd-bright:${settings.backdropBrightness}`,
    `--tint:rgba(${tint.r},${tint.g},${tint.b},${settings.tintStrength})`, `--pane-blur:${Math.min(32, material.paneBlur)}px`,
    `--radius:${material.cornerRadius}px`, `--plate:${material.tileGlass}`, `--custom-rgb:${custom.r},${custom.g},${custom.b}`,
    `--custom-opacity:${settings.customSurfaceOpacity}`, `--tile:${TILE_SIZES[settings.iconSize]}px`, `--pane-motion:${settings.paneMotionMs}ms`,
    `--surface-width:${settings.surfaceWidth}px`, `--dock:${settings.taskbarIconSize}px`, `--scrollbar-width:${settings.scrollbarWidth}px`,
  ].join(";");
}

function bodyValues(settings: Settings): Record<string, string> {
  const custom = rgb(settings.customSurfaceColor);
  const luminance = (custom.r * .2126 + custom.g * .7152 + custom.b * .0722) / 255;
  return {
    style: settings.glassStyle, material: settings.materialProfile, canvas: "frosted", labels: String(settings.showLabels),
    rail: String(settings.rail), anim: String(settings.animations), compactBar: String(settings.compactBar), navigation: settings.navigationMode,
    shortcutAllApps: String(settings.shortcutAllApps), shortcutScreenTime: String(settings.shortcutScreenTime), shortcutFocus: String(settings.shortcutFocus),
    shortcutSettings: String(settings.shortcutSettings), navigationOverflow: String(!settings.shortcutAllApps || !settings.shortcutScreenTime || !settings.shortcutFocus || !settings.shortcutSettings),
    surfaceTone: luminance > .62 && settings.customSurfaceOpacity > .55 ? "light" : "dark", page: "desktop",
  };
}

const attributeName = (key: string): string => `data-${key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}`;

function bodyAttributes(settings: Settings): string {
  return Object.entries(bodyValues(settings)).map(([key, value]) => `${attributeName(key)}="${value}"`).join(" ");
}

function sourceDocument(settings: Settings): string {
  const stage = homeStage(settings).outerHTML;
  return `<!doctype html><html style="${rootStyle(settings)}"><head><meta charset="UTF-8"><meta name="viewport" content="width=1280"><style>${previewCss()}\nhtml,body{width:1280px;height:800px;margin:0;overflow:hidden}body{background:#0b1220}#shell{pointer-events:none}#apps-surface{display:grid!important}</style></head><body ${bodyAttributes(settings)}>${stage}</body></html>`;
}

function labelPreview(preview: HTMLElement, settings: Settings) {
  preview.dataset.profile = settings.materialProfile;
  preview.dataset.navigation = settings.navigationMode;
  preview.dataset.rail = String(settings.rail);
}

/**
 * Brings an already-loaded preview up to date by changing its root variables and body attributes.
 * Settings drive the preview only through those, so there is no need to reload the whole document.
 */
function flush(state: PreviewState) {
  const doc = state.loaded ? state.frame.contentDocument : null;
  if (!doc?.body || state.wanted === state.applied) return;
  const { wanted, applied } = state;
  doc.documentElement.setAttribute("style", rootStyle(wanted));
  for (const [key, value] of Object.entries(bodyValues(wanted))) doc.body.setAttribute(attributeName(key), value);
  if (wanted.backgroundMode !== applied.backgroundMode || wanted.customBackground !== applied.customBackground) {
    const image = doc.getElementById("backdrop") as HTMLImageElement | null;
    if (image) applyBackdrop(image, wanted);
  }
  state.applied = wanted;
}

/** Updates a preview created by createLauncherPreview to show different settings without rebuilding it. */
export function updateLauncherPreview(preview: HTMLElement, settings: Settings) {
  const state = previews.get(preview);
  if (!state) return;
  state.wanted = settings;
  labelPreview(preview, settings);
  flush(state);
}

/** An isolated 1280×800 copy of the real Home DOM with only the proposed settings changed. */
export function createLauncherPreview({ settings, className }: PreviewOptions): HTMLElement {
  const preview = document.createElement("span");
  preview.className = `${className} launcher-screen-preview`;
  labelPreview(preview, settings);
  preview.setAttribute("aria-hidden", "true");

  const frame = document.createElement("iframe");
  frame.className = "launcher-screen-frame";
  frame.tabIndex = -1;
  frame.setAttribute("sandbox", "allow-same-origin");
  const state: PreviewState = { frame, wanted: settings, applied: settings, loaded: false };
  previews.set(preview, state);
  frame.addEventListener("load", () => {
    if (!frame.contentDocument?.getElementById("stage")) return; // ignore a blank document that is not the preview
    state.loaded = true;
    flush(state);
  });
  frame.srcdoc = sourceDocument(settings);
  preview.append(frame);

  const observer = new ResizeObserver(() => {
    if (!preview.isConnected) { observer.disconnect(); return; }
    preview.style.setProperty("--screen-preview-scale", String(preview.clientWidth / 1280));
  });
  observer.observe(preview);
  return preview;
}
