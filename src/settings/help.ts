import { el } from "../core/dom";
import { SHORTCUT_GROUPS, type Shortcut } from "../data/shortcuts";

function keyCombination(keys: string[]): HTMLElement {
  const parts: (Node | string)[] = [];
  keys.forEach((key, index) => {
    if (index > 0) parts.push(el("span", "key-plus", ["+"]));
    parts.push(el("kbd", "", [key]));
  });
  return el("span", "key-combination", parts);
}

function shortcutRow(shortcut: Shortcut): HTMLElement {
  const triggers = shortcut.keys
    ? shortcut.keys.flatMap((combination, index) => [...(index > 0 ? [el("span", "key-or", ["or"])] : []), keyCombination(combination)])
    : [el("span", "gesture-name", [shortcut.gesture ?? ""])];
  return el("div", "shortcut-row", [el("div", "shortcut-keys", triggers), el("p", "shortcut-action", [shortcut.action])]);
}

/** The Help section of Settings: every shortcut and gesture, grouped. `hotkey` is the user's own global hotkey. */
export function helpControl(hotkey: string): HTMLElement {
  return el("div", "help", [
    el("p", "help-intro", [`Your Opaline hotkey is ${hotkey}.`]),
    ...SHORTCUT_GROUPS.map(group => el("section", "shortcut-group", [el("h3", "", [group.title]), ...group.items.map(shortcutRow)])),
  ]);
}
