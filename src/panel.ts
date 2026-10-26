import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { api, type Status } from "./api";
import { byId, el } from "./dom";
import { type Settings, resetSettings, settings, updateSettings } from "./settings";

export type PanelHooks = {
  status: () => Status;
  organizeNow: () => number;
  resetPanes: () => void;
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
  | { kind: "action"; label: string; hint?: string; button: string; run: (note: (text: string) => void) => void }
  | { kind: "about" };

type Section = { id: string; title: string; controls: Control[] };

const percent = (value: number) => `${Math.round(value * 100)}%`;
const pixels = (value: number) => `${value} px`;
const times = (value: number) => `${value.toFixed(2)}×`;

let hooks: PanelHooks;
let current = "appearance";
let syncers: (() => void)[] = [];
let recording = false;

export const isRecordingHotkey = (): boolean => recording;
export const isPanelOpen = (): boolean => !byId("settings").hidden;

function sections(): Section[] {
  return [
    {
      id: "appearance",
      title: "Glass",
      controls: [
        {
          kind: "segmented",
          key: "glassStyle",
          label: "Style",
          options: [["liquid", "Liquid"], ["frost", "Frost"], ["clear", "Clear"]],
          hint: "Liquid bends the backdrop at the edges. Frost only blurs. Clear is the lightest on your GPU.",
        },
        { kind: "range", key: "backdropBlur", label: "Backdrop blur", min: 0, max: 60, step: 1, format: pixels, hint: "Lower keeps the screen behind easier to make out." },
        { kind: "range", key: "backdropSaturation", label: "Backdrop colour", min: 0.5, max: 2, step: 0.05, format: times },
        { kind: "range", key: "backdropBrightness", label: "Backdrop brightness", min: 0.5, max: 1.3, step: 0.01, format: times },
        { kind: "color", key: "tintColor", label: "Tint colour" },
        { kind: "range", key: "tintStrength", label: "Tint strength", min: 0, max: 0.8, step: 0.01, format: percent },
        { kind: "range", key: "paneBlur", label: "Pane blur", min: 0, max: 30, step: 1, format: pixels, hint: "How frosted the glass panes are." },
        { kind: "range", key: "refraction", label: "Lens strength", min: 0, max: 1, step: 0.01, format: percent, hint: "Only used by the Liquid style." },
        { kind: "range", key: "cornerRadius", label: "Corner roundness", min: 12, max: 44, step: 1, format: pixels },
        { kind: "range", key: "tileGlass", label: "Tile glass", min: 0, max: 0.5, step: 0.01, format: percent },
      ],
    },
    {
      id: "layout",
      title: "Layout",
      controls: [
        { kind: "segmented", key: "iconSize", label: "Icon size", options: [["small", "Small"], ["medium", "Medium"], ["large", "Large"]] },
        { kind: "toggle", key: "showLabels", label: "Show names" },
        { kind: "toggle", key: "groupsFirst", label: "Panes first", hint: "Show panes before loose items." },
        { kind: "segmented", key: "sortBy", label: "Sort loose items", options: [["name", "Name"], ["frequent", "Most used"]] },
      ],
    },
    {
      id: "rail",
      title: "Rail",
      controls: [
        { kind: "toggle", key: "rail", label: "Show the rail", hint: "A strip mirroring your taskbar." },
        { kind: "segmented", key: "railSide", label: "Side", options: [["right", "Right"], ["left", "Left"]] },
        { kind: "toggle", key: "railMagnify", label: "Magnify on hover" },
        { kind: "toggle", key: "railPreviews", label: "Window previews", hint: "Thumbnails when you hover an app." },
      ],
    },
    {
      id: "behaviour",
      title: "Behaviour",
      controls: [
        { kind: "hotkey" },
        { kind: "autostart" },
        { kind: "toggle", key: "closeOnClickOff", label: "Close when clicking empty space" },
        { kind: "toggle", key: "closeOnBlur", label: "Close when you switch away" },
        { kind: "toggle", key: "animations", label: "Animations" },
      ],
    },
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
          hint: "Restores the default glass, layout and behaviour. Panes are kept.",
          button: "Reset",
          run: (note) => {
            resetSettings();
            note("Settings reset.");
          },
        },
      ],
    },
  ];
}

// ---------- rows ----------

function row(label: string, hint: string | undefined, control: HTMLElement): HTMLElement {
  const text = el("div", "row-text", [el("div", "row-label", [label])]);
  if (hint) text.append(el("div", "row-hint", [hint]));
  return el("div", "row", [text, control]);
}

function patch(key: keyof Settings, value: unknown) {
  updateSettings({ [key]: value } as Partial<Settings>);
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
    true,
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
      try {
        if (value) await enable();
        else await disable();
        enabled = value;
        note.textContent = "";
      } catch (error) {
        note.textContent = String(error);
      }
      show();
    },
  );

  void isEnabled()
    .then((value) => {
      enabled = value;
      show();
    })
    .catch(() => {});

  return row("Launch at login", "Starts in the tray when you sign in. Off until you turn it on.", el("div", "control column", [node, note]));
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

function build(control: Control): HTMLElement {
  switch (control.kind) {
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
    case "action":
      return actionRow(control);
    case "about":
      return aboutRow();
  }
}

function select(id: string) {
  current = id;
  const section = sections().find((candidate) => candidate.id === id)!;
  syncers = [];

  const body = byId("settings").querySelector<HTMLElement>(".settings-body")!;
  body.replaceChildren(el("h2", "", [section.title]), ...section.controls.map(build));
  body.scrollTop = 0;

  byId("settings")
    .querySelectorAll<HTMLElement>(".nav-item")
    .forEach((item) => item.setAttribute("aria-current", String(item.dataset.id === id)));
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
  select(current); // rebuild so values and the about text are fresh
  byId("settings").hidden = false;
  document.body.classList.add("settings-open");
}

export function closePanel() {
  recording = false;
  byId("settings").hidden = true;
  document.body.classList.remove("settings-open");
}

export function togglePanel() {
  if (isPanelOpen()) closePanel();
  else openPanel();
}
