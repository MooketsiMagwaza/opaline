import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { api, type Status } from "./api";
import { byId, el } from "./dom";
import { RAIL_AVAILABLE, type Settings, resetSettings, settings, updateSettings } from "./settings";
import { createWorkspace, removeWorkspace, renameWorkspace, workspaces } from "./workspaces";
import { refreshUsage } from "./usage";

export type PanelHooks = {
  status: () => Status;
  organizeNow: () => number;
  resetPanes: () => void;
  resetGrid: () => void;
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
  | { kind: "about" };
type SpecialControl = { kind: "workspaces" | "screen-time" };

type Section = { id: string; title: string; controls: (Control | SpecialControl)[] };

const percent = (value: number) => `${Math.round(value * 100)}%`;
const pixels = (value: number) => `${value} px`;

let hooks: PanelHooks;
let current = "appearance";
let syncers: (() => void)[] = [];
let recording = false;
let hotkeyEvents: AbortController | undefined;
let returnFocus: HTMLElement | null = null;
const CUSTOM_MATERIAL_KEYS = new Set<keyof Settings>();

export const isRecordingHotkey = (): boolean => recording;
export const isPanelOpen = (): boolean => !byId("settings").hidden;

function sections(): Section[] {
  const available: Section[] = [
    {
      id: "appearance",
      title: "Appearance",
      controls: [
        { kind: "range", key: "backdropBlur", label: "Acrylic blur intensity", min: 0, max: 40, step: 1, format: pixels, hint: "Controls both the captured backdrop and the floating acrylic surfaces." },
        { kind: "range", key: "tintStrength", label: "Acrylic tint", min: 0.06, max: 0.5, step: 0.01, format: percent },
        { kind: "color", key: "tintColor", label: "Tint colour" },
      ],
    },
    {
      id: "layout",
      title: "Layout",
      controls: [
        { kind: "toggle", key: "compactBar", label: "Compact navigation", hint: "Hide the numbered space buttons and keep the taskbar mirror. Ctrl+B expands or collapses navigation." },
        { kind: "range", key: "surfaceWidth", label: "App area width", min: 640, max: 1280, step: 40, format: pixels },
        { kind: "range", key: "scrollbarWidth", label: "Scrollbar width", min: 6, max: 14, step: 1, format: pixels },
        { kind: "segmented", key: "iconSize", label: "Icon size", options: [["small", "Small"], ["medium", "Medium"], ["large", "Large"]] },
        { kind: "toggle", key: "showLabels", label: "Show names" },
        { kind: "toggle", key: "groupsFirst", label: "Panes first", hint: "Show panes before loose items." },
        { kind: "segmented", key: "sortBy", label: "Sort loose items", options: [["name", "Name"], ["frequent", "Most used"]] },
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
      id: "rail",
      title: "Taskbar",
      controls: [
        { kind: "toggle", key: "rail", label: "Show taskbar mirror", hint: "Pinned and running Windows apps at the bottom. Click to open or focus." },
        { kind: "range", key: "taskbarIconSize", label: "Taskbar icon size", min: 24, max: 44, step: 2, format: pixels },
        { kind: "toggle", key: "railMagnify", label: "Magnify on hover" },
        { kind: "toggle", key: "railPreviews", label: "Window previews", hint: "Thumbnails when you hover an app." },
      ],
    },
    {
      id: "behaviour",
      title: "Behaviour",
      controls: [
        { kind: "hotkey" },
        { kind: "start-menu" },
        { kind: "segmented", key: "pageShortcut", label: "Switch pages", options: [["shift-tab", "Shift+Tab"], ["ctrl-tab", "Ctrl+Tab"]], hint: "Alt+1 opens Desktop; Alt+2–9 open your spaces. Ctrl+Alt+A opens All apps; Ctrl+Alt+T opens Screen time. Choose Ctrl+Tab to keep Shift+Tab for reverse focus." },
        { kind: "autostart" },
        { kind: "toggle", key: "closeOnClickOff", label: "Close when clicking empty space" },
        { kind: "toggle", key: "closeOnBlur", label: "Close when you switch away" },
        { kind: "toggle", key: "animations", label: "Animations" },
        { kind: "range", key: "paneMotionMs", label: "Pane opening duration", min: 160, max: 500, step: 10, format: (value) => `${value} ms`, hint: "Pane popups expand from their tile and return to it when closed." },
        {
          kind: "toggle",
          key: "fabricEntrance",
          label: "Fabric opening animation",
          hint: "Unfolds the already-arranged app grid upward like a sheet being laid out.",
        },
      ],
    },
    { id: "workspaces", title: "Workspaces", controls: [{ kind: "workspaces" }] },
    { id: "screen-time", title: "Screen time", controls: [{ kind: "screen-time" }] },
    { id: "focus", title: "Focus", controls: [
      { kind: "range", key: "focusMinutes", label: "Focus session", min: 1, max: 90, step: 1, format: value => `${value} min` },
      { kind: "range", key: "shortBreakMinutes", label: "Short break", min: 1, max: 30, step: 1, format: value => `${value} min` },
      { kind: "range", key: "longBreakMinutes", label: "Long break", min: 5, max: 60, step: 1, format: value => `${value} min`, hint: "After every four completed focus sessions. Timers wait for you to start the next phase." },
      { kind: "range", key: "quoteIntervalSeconds", label: "Zen quote interval", min: 5, max: 120, step: 5, format: value => `${value} sec` },
      { kind: "toggle", key: "screenSaverEnabled", label: "Automatic screen saver", hint: "Off by default. Opens Opaline’s quiet clock after Windows is idle; any input dismisses it. Does not change the Windows lock screen or sign-in settings." },
      { kind: "range", key: "screenSaverIdleMinutes", label: "Screen saver idle time", min: 1, max: 60, step: 1, format: value => `${value} min` },
    ] },
    {
      id: "panes",
      title: "Panes",
      controls: [
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
      controls: [
        { kind: "about" },
        {
          kind: "action",
          label: "Reset all settings",
          hint: "Restores appearance, layout and in-app behaviour. Panes, spaces, screen time, the global hotkey and login preference are kept.",
          button: "Reset",
          run: (note) => {
            resetSettings();
            note("Settings reset.");
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

function patch(key: keyof Settings, value: unknown) {
  updateSettings({ ...(CUSTOM_MATERIAL_KEYS.has(key) ? { glassStyle: "custom" as const } : {}), [key]: value } as Partial<Settings>);
}

function rangeRow(control: Extract<Control, { kind: "range" }>): HTMLElement {
  const input = el("input");
  input.type = "range";
  input.min = String(control.min);
  input.max = String(control.max);
  input.step = String(control.step);
  const output = el("output");

  const show = () => {
    const value = settings()[control.key] as number;
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
    for (const { button, value } of buttons) button.setAttribute("aria-pressed", String(settings()[control.key] === value));
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
    () => settings()[control.key] as boolean,
    (value) => patch(control.key, value),
  );
  syncers.push(show);
  return row(control.label, control.hint, el("div", "control", [node]));
}

function colorRow(control: Extract<Control, { kind: "color" }>): HTMLElement {
  const input = el("input");
  input.type = "color";
  const show = () => (input.value = settings()[control.key] as string);
  input.addEventListener("input", () => patch(control.key, input.value));
  syncers.push(show);
  show();
  return row(control.label, control.hint, el("div", "control", [input]));
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
  holder.append(el("p", "row-hint", ["Desktop is always Alt+1. Add up to eight spaces for apps, folders and files. These collections are available on every Windows virtual desktop."]));
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
    holder.append(row(`Alt+${index + 2}`, `${space.items.length} saved items`, el("div", "workspace-editor", [name, save, remove])));
  });
  const name = el("input", "workspace-name");
  name.placeholder = "e.g. Projects"; name.maxLength = 40; name.setAttribute("aria-label", "New workspace name");
  const add = el("button", "chip", ["Add space"]);
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
    case "about":
      return aboutRow();
  }
}

function select(id: string) {
  hotkeyEvents?.abort();
  recording = false;
  current = id;
  const section = sections().find((candidate) => candidate.id === id)!;
  syncers = [];

  const body = byId("settings").querySelector<HTMLElement>(".settings-body")!;
  body.replaceChildren(el("h2", "", [section.title]), ...section.controls.map(build));
  body.scrollTop = 0;

  byId("settings")
    .querySelectorAll<HTMLElement>(".nav-item")
    .forEach((item) => item.setAttribute("aria-current", item.dataset.id === id ? "page" : "false"));
}

export function syncPanel() {
  syncers.forEach((sync) => sync());
}

export function initPanel(panelHooks: PanelHooks) {
  hooks = panelHooks;

  const nav = el("nav", "settings-nav");
  for (const section of sections()) {
    const item = el("button", "nav-item", [section.title]);
    item.type = "button";
    item.dataset.id = section.id;
    item.addEventListener("click", () => select(section.id));
    nav.append(item);
  }

  const close = el("button", "nav-item close", ["Done"]);
  close.type = "button";
  close.addEventListener("click", closePanel);
  nav.append(el("div", "nav-spacer"), close);

  byId("settings").replaceChildren(nav, el("div", "settings-body"));
  select(current);
}

export function openPanel() {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  select(current); // rebuild so values and the about text are fresh
  byId("settings").hidden = false;
  document.body.classList.add("settings-open");
  byId("settings").querySelector<HTMLButtonElement>(".nav-item")?.focus();
}

export function closePanel() {
  const wasOpen = isPanelOpen();
  recording = false;
  byId("settings").hidden = true;
  document.body.classList.remove("settings-open");
  if (wasOpen && returnFocus?.isConnected) returnFocus.focus();
}

export function togglePanel() {
  if (isPanelOpen()) closePanel();
  else openPanel();
}
