import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { api, type Status } from "../core/api";
import { exportUserPresets, importUserPresets, loadUserPresets, matchesUserPreset, removeUserPreset, saveUserPreset } from "../appearance/user-presets";
import { APPEARANCE_PRESETS, appearanceValues, matchesAppearance, type AppearanceValues } from "../appearance/presets";
import { importBackground } from "../appearance/background";
import { byId, el } from "../core/dom";
import type { QuickSort } from "../grid";
import { createLauncherPreview } from "./launcher-preview";
import { DEFAULTS, RAIL_AVAILABLE, normalizeSettings, type Settings, settings, updateSettings } from "./store";
import { createWorkspace, removeWorkspace, renameWorkspace, workspaces } from "../grid/workspaces";
import { refreshUsage } from "../activity";

export type PanelHooks = {
  status: () => Status;
  organizeNow: () => number;
  resetPanes: () => void;
  resetGrid: () => void;
  sortHome: (mode: QuickSort) => void;
  hotkeyChanged: (label: string) => void;
};

type Option = [value: string, label: string];

type Control =
  | { kind: "range"; key: keyof Settings; label: string; min: number; max: number; step: number; format: (value: number) => string; hint?: string }
  | { kind: "segmented"; key: keyof Settings; label: string; options: Option[]; hint?: string }
  | { kind: "toggle"; key: keyof Settings; label: string; hint?: string }
  | { kind: "color"; key: keyof Settings; label: string; hint?: string }
  | { kind: "hotkey" }
  | { kind: "autostart" }
  | { kind: "start-menu" }
  | { kind: "action"; label: string; hint?: string; button: string; run: (note: (text: string) => void) => void }
  | { kind: "actions"; label: string; hint?: string; buttons: { label: string; run: (note: (text: string) => void) => void }[] }
  | { kind: "about" }
  | { kind: "navigation-style" }
  | { kind: "appearance-presets" }
  | { kind: "background" };
type SpecialControl = { kind: "workspaces" | "screen-time" };

type Section = { id: string; title: string; description: string; controls: (Control | SpecialControl)[] };

const percent = (value: number) => `${Math.round(value * 100)}%`;
const pixels = (value: number) => `${value} px`;

let hooks: PanelHooks;
let current = "appearance";
let syncers: (() => void)[] = [];
let draft: Settings | null = null;
let savedDraft = "";
let recording = false;
let hotkeyEvents: AbortController | undefined;
const CUSTOM_MATERIAL_KEYS = new Set<keyof Settings>(["paneBlur", "cornerRadius", "tileGlass", "customSurfaceColor", "customSurfaceOpacity"]);

export const isRecordingHotkey = (): boolean => recording;

function sections(): Section[] {
  const available: Section[] = [
    {
      id: "appearance",
      title: "Appearance",
      description: "Materials, colour, icon presentation and type. Every change is shown in the live screen preview.",
      controls: [
        { kind: "appearance-presets" },
        { kind: "background" },
        { kind: "range", key: "backdropBlur", label: "Acrylic blur intensity", min: 0, max: 40, step: 1, format: pixels, hint: "Controls both the captured backdrop and the floating acrylic surfaces." },
        { kind: "range", key: "customSurfaceOpacity", label: "Panel opacity", min: 0.2, max: 1, step: 0.01, format: percent, hint: "Fine-tuning this switches the material to a custom surface." },
        { kind: "range", key: "cornerRadius", label: "Panel corner radius", min: 8, max: 40, step: 1, format: pixels },
        { kind: "color", key: "customSurfaceColor", label: "Panel surface colour" },
        { kind: "range", key: "backdropSaturation", label: "Backdrop colour", min: 0.5, max: 2, step: 0.05, format: value => `${Math.round(value * 100)}%` },
        { kind: "range", key: "backdropBrightness", label: "Backdrop brightness", min: 0.6, max: 1.3, step: 0.05, format: value => `${Math.round(value * 100)}%` },
        { kind: "range", key: "tintStrength", label: "Acrylic tint", min: 0.06, max: 0.5, step: 0.01, format: percent },
        { kind: "color", key: "tintColor", label: "Tint colour" },
        { kind: "segmented", key: "iconSize", label: "Home icon size", options: [["small", "Small"], ["medium", "Medium"], ["large", "Large"]] },
        { kind: "toggle", key: "showLabels", label: "Show app and pane names" },
        { kind: "range", key: "scrollbarWidth", label: "Scrollbar width", min: 6, max: 14, step: 1, format: pixels },
      ],
    },
    {
      id: "home-layout",
      title: "Home layout",
      description: "The size and ordering of the main Home canvas. Appearance and navigation live in their own sections.",
      controls: [
        { kind: "range", key: "surfaceWidth", label: "App area width", min: 640, max: 1280, step: 40, format: pixels },
        { kind: "toggle", key: "groupsFirst", label: "Panes first", hint: "Show panes before loose items." },
        { kind: "segmented", key: "sortBy", label: "Automatic loose-item order", options: [["name", "Name"], ["frequent", "Most used"]], hint: "Used for new items and before a manual grid order is saved." },
        {
          kind: "actions",
          label: "Quick sort Home",
          hint: "Applies once to panes, folders and loose items. You can drag them into a different order afterwards.",
          buttons: [
            { label: "A–Z", run: (note) => { hooks.sortHome("name-asc"); note("Home sorted A–Z."); } },
            { label: "Z–A", run: (note) => { hooks.sortHome("name-desc"); note("Home sorted Z–A."); } },
            { label: "Most used", run: (note) => { hooks.sortHome("frequent"); note("Home sorted by usage."); } },
          ],
        },
        {
          kind: "action",
          label: "Reset grid order",
          hint: "Returns apps, folders and panes to the generated centred order without changing pane membership.",
          button: "Reset order",
          run: (note) => {
            hooks.resetGrid();
            note("Grid order reset.");
          },
        },
      ],
    },
    {
      id: "navigation",
      title: "Navigation",
      description: "Choose where Opaline’s main destinations live and which ones stay visible.",
      controls: [
        { kind: "navigation-style" },
        { kind: "segmented", key: "defaultPage", label: "Default opening page", options: [["home", "Home"], ["all-apps", "All apps"]], hint: "Choose what a normal Opaline open shows first. Explicit page shortcuts keep their usual destinations." },
        { kind: "toggle", key: "compactBar", label: "Compact navigation", hint: "Minimise page controls while keeping keyboard shortcuts available. Ctrl+B toggles this quickly." },
        { kind: "toggle", key: "shortcutAllApps", label: "Show All apps", hint: "Hidden destinations remain available from the navigation tray and keyboard." },
        { kind: "toggle", key: "shortcutScreenTime", label: "Show Screen time" },
        { kind: "toggle", key: "shortcutFocus", label: "Show Focus" },
        { kind: "toggle", key: "shortcutSettings", label: "Show Settings", hint: "Alt+5 and the tray always provide a recovery path." },
      ],
    },
    {
      id: "rail",
      title: "Taskbar",
      description: "Controls for the Windows app mirror only. Opaline page navigation is configured separately.",
      controls: [
        { kind: "toggle", key: "rail", label: "Show taskbar mirror", hint: "Pinned and running Windows apps at the bottom. Click to open or focus." },
        { kind: "range", key: "taskbarIconSize", label: "Taskbar icon size", min: 24, max: 36, step: 2, format: pixels },
        { kind: "toggle", key: "railMagnify", label: "Magnify on hover" },
        { kind: "toggle", key: "railPreviews", label: "Window previews", hint: "Thumbnails when you hover an app." },
      ],
    },
    {
      id: "behaviour",
      title: "Behaviour",
      description: "How Opaline opens, closes and responds. Visual choices are kept in Appearance.",
      controls: [
        { kind: "hotkey" },
        { kind: "start-menu" },
        { kind: "autostart" },
        { kind: "toggle", key: "closeOnClickOff", label: "Close when clicking empty space" },
        { kind: "toggle", key: "closeOnBlur", label: "Close when you switch away" },
        { kind: "toggle", key: "animations", label: "Animations" },
      ],
    },
    { id: "workspaces", title: "Home screens", description: "Create and name the spaces you swipe through from Home.", controls: [{ kind: "workspaces" }] },
    { id: "screen-time", title: "Screen time", description: "Local activity history and retention controls.", controls: [{ kind: "screen-time" }] },
    {
      id: "panes",
      title: "Panes",
      description: "Pane organisation and the way pane windows open. Home ordering remains under Home layout.",
      controls: [
        { kind: "range", key: "paneMotionMs", label: "Opening duration", min: 160, max: 500, step: 10, format: (value) => `${value} ms`, hint: "Pane popups expand from their tile and return to it when closed." },
        {
          kind: "action",
          label: "Organise for me",
          hint: "Sorts loose items into IDEs, AI & code agents, dev tools, browsers and more. Items you have already grouped stay put.",
          button: "Organise now",
          run: (note) => {
            const moved = hooks.organizeNow();
            note(moved > 0 ? `Moved ${moved} item${moved === 1 ? "" : "s"} into panes.` : "Nothing new to group.");
          },
        },
        {
          kind: "action",
          label: "Ungroup everything",
          hint: "Dissolves every pane. Your Desktop files are not touched.",
          button: "Ungroup all",
          run: (note) => {
            hooks.resetPanes();
            note("All panes dissolved.");
          },
        },
      ],
    },
    {
      id: "about",
      title: "About",
      description: "Version information, project links and reset controls.",
      controls: [
        { kind: "about" },
        {
          kind: "action",
          label: "Reset all settings",
          hint: "Restores appearance, layout and in-app behaviour. Panes, spaces, screen time, the global hotkey and login preference are kept.",
          button: "Reset",
          run: (note) => {
            draft = normalizeSettings(DEFAULTS);
            syncPanel();
            syncCommitBar();
            note("Defaults staged. Choose Done to apply them.");
          },
        },
      ],
    },
  ];
  return available.filter((section) => RAIL_AVAILABLE || section.id !== "rail");
}

// ---------- rows ----------

function row(label: string, hint: string | undefined, control: HTMLElement): HTMLElement {
  control.querySelectorAll<HTMLElement>("input, select, button[role='switch']").forEach((input) => input.setAttribute("aria-label", label));
  const text = el("div", "row-text", [el("div", "row-label", [label])]);
  if (hint) text.append(el("div", "row-hint", [hint]));
  return el("div", "row", [text, control]);
}

const panelSettings = (): Settings => draft ?? settings();

function syncCommitBar() {
  const dirty = draft !== null && JSON.stringify(draft) !== savedDraft;
  const done = document.getElementById("settings-done") as HTMLButtonElement | null;
  if (done) done.disabled = !dirty;
}

function stageSettings(patch: Partial<Settings>) {
  draft = normalizeSettings({ ...panelSettings(), ...patch });
  syncers.forEach(sync => sync());
  syncLivePreview();
  syncCommitBar();
}

function patch(key: keyof Settings, value: unknown) {
  const material = CUSTOM_MATERIAL_KEYS.has(key)
    ? { glassStyle: "custom" as const, ...(panelSettings().materialProfile === "opaline" ? { materialProfile: "custom" as const } : {}) }
    : {};
  stageSettings({ ...material, [key]: value } as Partial<Settings>);
}

function rangeRow(control: Extract<Control, { kind: "range" }>): HTMLElement {
  const input = el("input");
  input.type = "range";
  input.min = String(control.min);
  input.max = String(control.max);
  input.step = String(control.step);
  const output = el("output");

  const show = () => {
    const value = panelSettings()[control.key] as number;
    input.value = String(value);
    output.textContent = control.format(value);
    input.style.setProperty("--p", `${((value - control.min) / (control.max - control.min)) * 100}%`);
  };
  input.addEventListener("input", () => patch(control.key, Number(input.value)));

  syncers.push(show);
  show();
  return row(control.label, control.hint, el("div", "control", [input, output]));
}

function segmentedRow(control: Extract<Control, { kind: "segmented" }>): HTMLElement {
  const group = el("div", "segmented");
  if (control.key === "glassStyle") group.classList.add("themes");
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", control.label);
  const buttons = control.options.map(([value, label]) => {
    const button = el("button", "", [label]);
    button.type = "button";
    button.addEventListener("click", () => patch(control.key, value));
    group.append(button);
    return { button, value };
  });

  const show = () => {
    for (const { button, value } of buttons) button.setAttribute("aria-pressed", String(panelSettings()[control.key] === value));
  };
  syncers.push(show);
  show();
  return row(control.label, control.hint, el("div", "control", [group]));
}

function switchElement(read: () => boolean, write: (value: boolean) => void): { node: HTMLElement; show: () => void } {
  const node = el("button", "switch");
  node.type = "button";
  node.setAttribute("role", "switch");
  const show = () => node.setAttribute("aria-checked", String(read()));
  node.addEventListener("click", () => write(!read()));
  show();
  return { node, show };
}

function toggleRow(control: Extract<Control, { kind: "toggle" }>): HTMLElement {
  const { node, show } = switchElement(
    () => panelSettings()[control.key] as boolean,
    (value) => patch(control.key, value),
  );
  node.setAttribute("aria-label", control.label);
  syncers.push(show);
  return row(control.label, control.hint, el("div", "control", [node]));
}

function colorRow(control: Extract<Control, { kind: "color" }>): HTMLElement {
  const input = el("input");
  input.type = "color";
  const show = () => (input.value = panelSettings()[control.key] as string);
  input.addEventListener("input", () => patch(control.key, input.value));
  syncers.push(show);
  show();
  return row(control.label, control.hint, el("div", "control", [input]));
}

function backgroundControl(): HTMLElement {
  const note = el("span", "note ok");
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/jpeg,image/png,image/webp";
  file.hidden = true;
  const definitions = [
    { id: "desktop", label: "Desktop", hint: "Use the current Windows desktop capture." },
    { id: "aero", label: "Opaline Aero", hint: "Use the bundled bright landscape." },
    { id: "custom", label: "Custom", hint: "Use your own optimised local image." },
  ] as const;
  const buttons = definitions.map(definition => {
    const button = el("button", "background-choice", [el("strong", "", [definition.label]), el("small", "", [definition.hint])]);
    button.type = "button";
    button.addEventListener("click", () => {
      if (definition.id === "custom" && !panelSettings().customBackground) file.click();
      else stageSettings({ backgroundMode: definition.id });
    });
    return { button, id: definition.id };
  });
  const choose = el("button", "chip subtle", ["Choose custom image"]);
  choose.type = "button";
  choose.addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    const selected = file.files?.[0];
    if (!selected) return;
    choose.setAttribute("aria-busy", "true");
    choose.textContent = "Preparing image…";
    try {
      stageSettings({ customBackground: await importBackground(selected), backgroundMode: "custom" });
      note.textContent = "Image optimised locally and staged.";
    } catch (error) {
      note.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      choose.removeAttribute("aria-busy");
      choose.textContent = "Choose custom image";
      file.value = "";
    }
  });
  const show = () => buttons.forEach(({ button, id }) => {
    button.setAttribute("aria-pressed", String(panelSettings().backgroundMode === id));
    if (id === "custom") button.toggleAttribute("disabled", !panelSettings().customBackground);
  });
  syncers.push(show);
  show();
  return el("section", "background-control", [
    el("div", "appearance-preset-heading", [el("div", "row-label", ["Opaline background"]), el("div", "row-hint", ["Independent from your Windows wallpaper. Custom images never leave this device."])]),
    el("div", "background-options", buttons.map(({ button }) => button)),
    el("div", "background-actions", [choose, file, note]),
  ]);
}

function appearancePreview(values: AppearanceValues): HTMLElement {
  return createLauncherPreview({
    settings: normalizeSettings({ ...panelSettings(), ...values }),
    className: "appearance-preview",
  });
}

function syncLivePreview() {
  const host = document.getElementById("settings-live-preview");
  const current = panelSettings();
  if (host) host.replaceChildren(createLauncherPreview({ settings: current, className: "settings-live-simulation" }));
  const summary = document.getElementById("settings-preview-summary");
  if (summary) summary.textContent = `${current.navigationMode === "split" ? "Split header" : current.navigationMode === "taskbar" ? "Navigation taskbar" : "Dropdown tray"} · ${current.surfaceWidth}px panel · taskbar ${current.rail ? "shown" : "hidden"}`;
  document.getElementById("pane-motion-preview")?.style.setProperty("--demo-pane-motion", `${current.paneMotionMs}ms`);
}

function homePreviewPanel(): HTMLElement {
  const host = el("div", "settings-live-preview");
  host.id = "settings-live-preview";
  const summary = el("span", "settings-preview-summary");
  summary.id = "settings-preview-summary";
  return el("aside", "settings-section-preview", [
    el("div", "settings-preview-copy", [el("span", "page-kicker", ["Live Home preview"]), el("strong", "", ["Your current draft"]), summary]),
    host,
  ]);
}

function paneMotionPreview(): HTMLElement {
  const icons = [...document.querySelectorAll<HTMLElement>(".tile .ico")].slice(0, 4).map(icon => icon.cloneNode(true) as HTMLElement);
  while (icons.length < 4) icons.push(el("span", "pane-demo-fallback", [String(icons.length + 1)]));
  const preview = el("aside", "settings-section-preview pane-motion-preview", [
    el("div", "settings-preview-copy", [el("span", "page-kicker", ["Pane motion"]), el("strong", "", ["Opening from its Home tile"]), el("span", "settings-preview-summary", ["This loops using your selected duration."])]),
    el("div", "pane-demo-stage", [
      el("div", "pane-demo-home", [
        el("div", "pane-demo-tile glass", [
          el("div", "pane-demo-minis", icons.map(icon => icon.cloneNode(true) as HTMLElement)),
          el("span", "", ["Creative"]),
        ]),
      ]),
      el("div", "pane-demo-popup glass", [el("strong", "", ["Creative"]), el("div", "pane-demo-apps", icons)]),
    ]),
  ]);
  preview.id = "pane-motion-preview";
  return preview;
}

function sectionPreview(id: string): HTMLElement | null {
  if (["appearance", "home-layout", "navigation", "rail"].includes(id)) return homePreviewPanel();
  if (id === "panes") return paneMotionPreview();
  return null;
}

function navigationStyleControl(): HTMLElement {
  const modes = [
    { id: "split", name: "Split header", description: "Apps left, Focus and Settings right." },
    { id: "taskbar", name: "Navigation taskbar", description: "One compact dock beside Home." },
    { id: "tray", name: "Dropdown tray", description: "Minimise destinations into one menu." },
  ] as const;
  const buttons = modes.map(mode => {
    const current = panelSettings();
    const preview = createLauncherPreview({
      settings: normalizeSettings({ ...current, navigationMode: mode.id }),
      className: "navigation-preview",
    });
    const button = el("button", "navigation-style-card", [preview, el("strong", "", [mode.name]), el("small", "", [mode.description])]);
    button.type = "button";
    button.addEventListener("click", () => stageSettings({ navigationMode: mode.id }));
    return { button, id: mode.id };
  });
  const show = () => buttons.forEach(({ button, id }) => button.setAttribute("aria-pressed", String(panelSettings().navigationMode === id)));
  syncers.push(show);
  show();
  return el("section", "navigation-styles", [
    el("div", "appearance-preset-heading", [el("div", "row-label", ["Navigation arrangement"]), el("div", "row-hint", ["Choose how the main destinations sit around Opaline. The preview applies immediately."])]),
    el("div", "navigation-style-grid", buttons.map(({ button }) => button)),
  ]);
}

function appearancePresetControl(): HTMLElement {
  const userPresets = loadUserPresets(panelSettings());
  const note = el("span", "note ok");
  const cards: { button: HTMLButtonElement; id: string }[] = [];
  const definitions = APPEARANCE_PRESETS;

  for (const preset of definitions) {
    const preview = appearancePreview(preset);
    const button = el("button", "appearance-preset", [preview, el("strong", "", [preset.name]), el("small", "", [preset.description])]);
    button.type = "button";
    button.addEventListener("click", () => stageSettings(preset));
    cards.push({ button, id: preset.id });
  }

  const customCards = userPresets.map(preset => {
    const preview = appearancePreview(preset.settings);
    const apply = el("button", "appearance-preset user-preset", [
      preview,
      el("strong", "", [preset.name]),
      el("small", "", [`${preset.settings.rail ? "Rail on" : "Rail off"} · ${preset.settings.surfaceWidth}px panel · ${preset.settings.navigationMode === "split" ? "split header" : preset.settings.navigationMode === "taskbar" ? "nav taskbar" : "nav tray"}`]),
    ]);
    apply.type = "button";
    apply.addEventListener("click", () => stageSettings(preset.settings));
    const remove = el("button", "preset-remove", ["Remove"]);
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${preset.name}`);
    remove.addEventListener("click", () => { removeUserPreset(preset.id); select("appearance"); });
    return el("div", "user-preset-wrap", [apply, remove]);
  });

  const show = () => {
    const current = appearanceValues(panelSettings());
    const named = APPEARANCE_PRESETS.find(preset => matchesAppearance(current, preset));
    for (const card of cards) card.button.setAttribute("aria-pressed", String(card.id === named?.id));
    customCards.forEach((card, index) => card.querySelector("button")?.setAttribute("aria-pressed", String(matchesUserPreset(panelSettings(), userPresets[index]))));
  };
  syncers.push(show);
  show();

  const name = el("input", "preset-name");
  name.setAttribute("placeholder", "Preset name, e.g. Focus layout");
  name.setAttribute("aria-label", "New visual preset name");
  name.maxLength = 48;
  const save = el("button", "chip subtle", ["Save current"]);
  save.type = "button";
  save.addEventListener("click", () => {
    try { saveUserPreset(name.value, panelSettings()); select("appearance"); }
    catch (error) { note.textContent = error instanceof Error ? error.message : String(error); name.focus(); }
  });

  const exportButton = el("button", "chip subtle", ["Export presets"]);
  exportButton.type = "button";
  exportButton.disabled = userPresets.length === 0;
  exportButton.addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([exportUserPresets(userPresets)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "opaline-visual-presets.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  });
  const file = document.createElement("input");
  file.type = "file";
  file.accept = ".json,application/json";
  file.hidden = true;
  file.addEventListener("change", async () => {
    const selected = file.files?.[0];
    if (!selected) return;
    try { importUserPresets(await selected.text()); select("appearance"); }
    catch (error) { note.textContent = error instanceof Error ? error.message : String(error); }
  });
  const importButton = el("button", "chip subtle", ["Import presets"]);
  importButton.type = "button";
  importButton.addEventListener("click", () => file.click());

  return el("section", "appearance-presets", [
    el("div", "appearance-preset-heading", [el("div", "row-label", ["Visual presets"]), el("div", "row-hint", ["Preview and apply a complete acrylic starting point. Fine controls remain below."])]),
    el("div", "appearance-preset-grid", cards.map(card => card.button)),
    el("div", "appearance-preset-heading user-preset-heading", [el("div", "row-label", ["Your presets"]), el("div", "row-hint", ["Named snapshots include appearance, panel sizing, icon sizing, rail and bar choices."])]),
    ...(customCards.length ? [el("div", "appearance-preset-grid", customCards)] : [el("p", "preset-empty", ["No saved presets yet."])]),
    el("div", "appearance-preset-actions", [el("div", "preset-save", [name, save]), el("div", "preset-transfer", [exportButton, importButton, file]), note]),
  ]);
}

// ---------- hotkey ----------

/** "ctrl+alt+space" from a key press, or null while it isn't a usable combination yet. */
function comboFrom(event: KeyboardEvent): string | null {
  const modifiers = [event.ctrlKey && "ctrl", event.altKey && "alt", event.shiftKey && "shift", event.metaKey && "super"].filter(
    Boolean,
  ) as string[];

  let key: string | null = null;
  if (event.code === "Space") key = "space";
  else if (/^Key[A-Z]$/.test(event.code)) key = event.code.slice(3).toLowerCase();
  else if (/^Digit\d$/.test(event.code)) key = event.code.slice(5);
  else if (/^F\d{1,2}$/.test(event.code)) key = event.code.toLowerCase();

  if (!key || modifiers.length === 0) return null;
  return [...modifiers, key].join("+");
}

function hotkeyRow(): HTMLElement {
  hotkeyEvents = new AbortController();
  const button = el("button", "chip");
  button.type = "button";
  const note = el("span", "note");

  const show = () => {
    button.textContent = recording ? "Press the new keys…" : hooks.status().hotkey;
  };

  button.addEventListener("click", () => {
    recording = true;
    note.textContent = "Include Ctrl, Alt or Shift. Esc cancels.";
    show();
  });

  // capture phase on window, so it sees the keys before the launcher's own shortcuts do
  window.addEventListener(
    "keydown",
    async (event) => {
      if (!recording) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      if (event.key === "Escape") {
        recording = false;
        note.textContent = "";
        show();
        return;
      }

      const combo = comboFrom(event);
      if (!combo) return;
      recording = false;

      try {
        hooks.hotkeyChanged(await api.setHotkey(combo));
        note.textContent = "";
      } catch (error) {
        note.textContent = String(error);
      }
      show();
    },
    { capture: true, signal: hotkeyEvents.signal },
  );

  syncers.push(show);
  show();
  return row("Hotkey", "Opens and closes Opaline from anywhere.", el("div", "control column", [button, note]));
}

function autostartRow(): HTMLElement {
  const note = el("span", "note");
  let enabled = false;

  const { node, show } = switchElement(
    () => enabled,
    async (value) => {
      (node as HTMLButtonElement).disabled = true;
      try {
        if (value) await enable();
        else await disable();
        enabled = value;
        note.textContent = value ? "Opaline will start hidden at your next Windows sign-in." : "Off — Opaline will not start after sign-in.";
      } catch (error) {
        note.textContent = String(error);
      }
      show();
      (node as HTMLButtonElement).disabled = false;
    },
  );

  (node as HTMLButtonElement).disabled = true;
  void isEnabled()
    .then((value) => {
      enabled = value;
      note.textContent = value ? "On — Opaline starts hidden after Windows sign-in." : "Off — turn this on to start after Windows sign-in.";
      show();
      (node as HTMLButtonElement).disabled = false;
    })
    .catch((error) => { note.textContent = `Could not read login preference: ${String(error)}`; });

  return row("Launch at login", "Start hidden in the tray at Windows sign-in. Toggle this on after installing or placing the app where you will keep it.", el("div", "control column", [node, note]));
}

function actionRow(control: Extract<Control, { kind: "action" }>): HTMLElement {
  const button = el("button", "chip", [control.button]);
  button.type = "button";
  const note = el("span", "note ok");
  button.addEventListener("click", () => control.run((text) => (note.textContent = text)));
  return row(control.label, control.hint, el("div", "control column", [button, note]));
}

function actionsRow(control: Extract<Control, { kind: "actions" }>): HTMLElement {
  const note = el("span", "note ok");
  const buttons = control.buttons.map((action) => {
    const button = el("button", "chip", [action.label]);
    button.type = "button";
    button.addEventListener("click", () => action.run((text) => (note.textContent = text)));
    return button;
  });
  return row(control.label, control.hint, el("div", "control column", [el("div", "action-buttons", buttons), note]));
}

function aboutRow(): HTMLElement {
  const status = hooks.status();
  const quit = el("button", "chip", ["Quit Opaline"]);
  quit.type = "button";
  quit.addEventListener("click", () => void api.quit());

  return el("div", "about", [
    el("div", "about-name", ["Opaline"]),
    el("div", "about-sub", [`Version ${status.version} “${status.codename}”`]),
    el("p", "about-text", [
      "A frosted-glass launcher for your desktop. Opaline only reads your Desktop folders — it never moves or deletes your files, and it makes no network requests.",
    ]),
    quit,
  ]);
}

// ---------- panel ----------

function workspaceControls(): HTMLElement {
  const holder = el("div", "workspace-controls");
  const note = el("p", "note");
  const run = (operation: Promise<void>) => { void operation.then(() => select("workspaces")).catch((error) => { note.textContent = String(error); }); };
  holder.append(el("p", "row-hint", ["These Home screens are available on every Windows virtual desktop. Press Tab on Home to switch between them. Alt+1 returns to the main Home screen."]));
  workspaces().forEach((space, index) => {
    const name = el("input", "workspace-name");
    name.value = space.name; name.maxLength = 40;
    name.setAttribute("aria-label", `Name for workspace ${index + 2}`);
    const save = el("button", "chip", ["Rename"]);
    save.addEventListener("click", () => run(renameWorkspace(space.id, name.value)));
    const remove = el("button", "chip", ["Remove"]);
    let confirm = false;
    remove.addEventListener("click", () => {
      if (!confirm) { confirm = true; remove.textContent = "Confirm removal"; return; }
      run(removeWorkspace(space.id));
    });
    holder.append(row(`Home screen ${index + 2}`, `${space.items.length} saved items`, el("div", "workspace-editor", [name, save, remove])));
  });
  const name = el("input", "workspace-name");
  name.placeholder = "e.g. Projects"; name.maxLength = 40; name.setAttribute("aria-label", "New workspace name");
  const add = el("button", "chip", ["Add screen"]);
  add.disabled = workspaces().length >= 8;
  add.addEventListener("click", () => run(createWorkspace(name.value)));
  holder.append(el("div", "workspace-editor", [name, add]), note);
  return holder;
}

function screenTimeControls(): HTMLElement {
  const note = el("p", "note");
  const toggle = el("button", "chip", ["Loading…"]);
  toggle.disabled = true;
  let enabled = false;
  const show = () => { toggle.textContent = enabled ? "Pause tracking" : "Resume tracking"; toggle.setAttribute("aria-pressed", String(enabled)); };
  void api.screenTime().then((report) => { enabled = report.enabled; toggle.disabled = !report.supported; show(); }).catch((error) => { note.textContent = String(error); });
  toggle.addEventListener("click", () => {
    toggle.disabled = true;
    void api.setScreenTime(!enabled).then(() => { enabled = !enabled; show(); void refreshUsage(); }).catch((error) => { note.textContent = String(error); }).finally(() => { toggle.disabled = false; });
  });
  const clear = el("button", "chip", ["Clear history"]);
  let confirm = false;
  clear.addEventListener("click", () => {
    if (!confirm) { confirm = true; clear.textContent = "Confirm clear history"; return; }
    clear.disabled = true;
    void api.clearScreenTime().then(() => { note.textContent = "History cleared."; void refreshUsage(); }).catch((error) => { note.textContent = String(error); }).finally(() => { clear.disabled = false; confirm = false; clear.textContent = "Clear history"; });
  });
  return el("div", "", [el("p", "row-hint", ["Tracks the foreground, maximised app while Opaline runs, including apps launched elsewhere. Stops when idle, minimised or asleep. Totals are stored locally; no window titles or browsing history are saved. Pausing keeps your history."]), row("Tracking", undefined, toggle), row("Saved history", "Clearing cannot be undone.", clear), note]);
}

function startMenuRow(): HTMLElement {
  const note = el("span", "note");
  let enabled = false;
  const { node, show } = switchElement(() => enabled, (next) => {
    (node as HTMLButtonElement).disabled = true;
    void api.setStartMenu(next).then(() => { enabled = next; note.textContent = ""; show(); }).catch((error) => { note.textContent = String(error); }).finally(() => { (node as HTMLButtonElement).disabled = false; });
  });
  (node as HTMLButtonElement).disabled = true;
  void api.startMenuStatus().then((status) => { enabled = status.enabled; (node as HTMLButtonElement).disabled = !status.available; show(); if (!status.available) note.textContent = "Unavailable on this session; Windows Start remains active."; }).catch((error) => { note.textContent = String(error); });
  return row("Use Opaline for the Windows key", "Off by default. A Windows-key tap opens All apps while Opaline runs. Windows shortcuts remain available. The Windows taskbar Start button and Ctrl+Esc still open Windows Start.", el("div", "control column", [node, note]));
}

function build(control: Control | SpecialControl): HTMLElement {
  switch (control.kind) {
    case "workspaces": return workspaceControls();
    case "screen-time": return screenTimeControls();
    case "range":
      return rangeRow(control);
    case "segmented":
      return segmentedRow(control);
    case "toggle":
      return toggleRow(control);
    case "color":
      return colorRow(control);
    case "hotkey":
      return hotkeyRow();
    case "autostart":
      return autostartRow();
    case "start-menu": return startMenuRow();
    case "action":
      return actionRow(control);
    case "actions":
      return actionsRow(control);
    case "about":
      return aboutRow();
    case "navigation-style":
      return navigationStyleControl();
    case "appearance-presets":
      return appearancePresetControl();
    case "background": return backgroundControl();
  }
}

function select(id: string) {
  hotkeyEvents?.abort();
  recording = false;
  current = id;
  const section = sections().find((candidate) => candidate.id === id)!;
  syncers = [];

  const body = byId("settings").querySelector<HTMLElement>(".settings-body")!;
  const content = el("div", "settings-section-content", [el("h2", "", [section.title]), el("p", "settings-section-description", [section.description]), ...section.controls.map(build)]);
  const preview = sectionPreview(id);
  body.classList.toggle("has-section-preview", Boolean(preview));
  body.replaceChildren(content, ...(preview ? [preview] : []));
  body.scrollTop = 0;

  byId("settings")
    .querySelectorAll<HTMLElement>(".nav-item")
    .forEach((item) => item.setAttribute("aria-current", item.dataset.id === id ? "page" : "false"));
  syncCommitBar();
  syncLivePreview();
}

export function syncPanel() {
  syncers.forEach((sync) => sync());
  syncLivePreview();
}

export function initPanel(panelHooks: PanelHooks) {
  hooks = panelHooks;
  draft = normalizeSettings(settings());
  savedDraft = JSON.stringify(draft);

  const nav = el("nav", "settings-nav");
  for (const section of sections()) {
    const item = el("button", "nav-item", [section.title]);
    item.type = "button";
    item.dataset.id = section.id;
    item.addEventListener("click", () => select(section.id));
    nav.append(item);
  }

  const cancel = el("button", "chip subtle", ["Cancel"]);
  cancel.type = "button";
  cancel.addEventListener("click", () => {
    draft = normalizeSettings(settings());
    savedDraft = JSON.stringify(draft);
    select(current);
  });
  const done = el("button", "chip primary", ["Done"]);
  done.id = "settings-done";
  done.type = "button";
  done.addEventListener("click", () => {
    if (!draft) return;
    updateSettings(draft);
    savedDraft = JSON.stringify(draft);
    syncCommitBar();
  });
  const commitBar = el("footer", "settings-commit", [cancel, done]);
  byId("settings").replaceChildren(nav, el("div", "settings-main", [el("div", "settings-body"), commitBar]));
  select(current);
}

export function refreshPanel() {
  if (!hooks) return;
  draft = normalizeSettings(settings());
  savedDraft = JSON.stringify(draft);
  select(current);
}
