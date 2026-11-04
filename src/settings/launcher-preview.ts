import type { Settings } from "./store";
import { materialSettings } from "./store";
import { resolvedBackground } from "../appearance/background";

type PreviewOptions = { settings: Settings; className: string };

const TILE_SIZES = { small: 60, medium: 72, large: 88 } as const;
let cachedPreviewCss = "";

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

function rgb(hex: string): { r: number; g: number; b: number } {
  const value = parseInt(hex.replace("#", ""), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function homeStage(): HTMLElement {
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
  return stage;
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

function bodyAttributes(settings: Settings): string {
  const custom = rgb(settings.customSurfaceColor);
  const luminance = (custom.r * .2126 + custom.g * .7152 + custom.b * .0722) / 255;
  const values: Record<string, string> = {
    style: settings.glassStyle, material: settings.materialProfile, canvas: "frosted", labels: String(settings.showLabels),
    rail: String(settings.rail), anim: String(settings.animations), compactBar: String(settings.compactBar), navigation: settings.navigationMode,
    shortcutAllApps: String(settings.shortcutAllApps), shortcutScreenTime: String(settings.shortcutScreenTime), shortcutFocus: String(settings.shortcutFocus),
    shortcutSettings: String(settings.shortcutSettings), navigationOverflow: String(!settings.shortcutAllApps || !settings.shortcutScreenTime || !settings.shortcutFocus || !settings.shortcutSettings),
    surfaceTone: luminance > .62 && settings.customSurfaceOpacity > .55 ? "light" : "dark", page: "desktop",
  };
  return Object.entries(values).map(([key, value]) => `data-${key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}="${value}"`).join(" ");
}

function sourceDocument(settings: Settings): string {
  const stageNode = homeStage();
  const backdrop = stageNode.querySelector<HTMLImageElement>("#backdrop");
  if (backdrop) {
    const sourceBackdrop = document.getElementById("backdrop") as HTMLImageElement | null;
    const next = resolvedBackground(settings, sourceBackdrop?.dataset.desktopSrc || sourceBackdrop?.getAttribute("src") || null);
    if (next) { backdrop.src = next; backdrop.hidden = false; }
    else { backdrop.removeAttribute("src"); backdrop.hidden = true; }
  }
  const stage = stageNode.outerHTML;
  return `<!doctype html><html style="${rootStyle(settings)}"><head><meta charset="UTF-8"><meta name="viewport" content="width=1280"><style>${previewCss()}\nhtml,body{width:1280px;height:800px;margin:0;overflow:hidden}body{background:#0b1220}#shell{pointer-events:none}#apps-surface{display:grid!important}</style></head><body ${bodyAttributes(settings)}>${stage}</body></html>`;
}

/** An isolated 1280×800 copy of the real Home DOM with only the proposed settings changed. */
export function createLauncherPreview({ settings, className }: PreviewOptions): HTMLElement {
  const preview = document.createElement("span");
  preview.className = `${className} launcher-screen-preview`;
  preview.dataset.profile = settings.materialProfile;
  preview.dataset.navigation = settings.navigationMode;
  preview.dataset.rail = String(settings.rail);
  preview.setAttribute("aria-hidden", "true");

  const frame = document.createElement("iframe");
  frame.className = "launcher-screen-frame";
  frame.tabIndex = -1;
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.srcdoc = sourceDocument(settings);
  preview.append(frame);

  const observer = new ResizeObserver(() => {
    if (!preview.isConnected) { observer.disconnect(); return; }
    preview.style.setProperty("--screen-preview-scale", String(preview.clientWidth / 1280));
  });
  observer.observe(preview);
  return preview;
}

