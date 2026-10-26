import { byId, clamp, el } from "./dom";

export type MenuEntry = {
  label?: string;
  action?: () => void;
  items?: MenuEntry[];
  separator?: boolean;
  disabled?: boolean;
};

const menu = () => byId("menu");

export const isMenuOpen = (): boolean => !menu().hidden;

export function closeMenu() {
  menu().hidden = true;
  menu().replaceChildren();
}

function build(entries: MenuEntry[], submenu = false): HTMLElement {
  const list = el("div", submenu ? "menu-list submenu" : "menu-list");

  for (const entry of entries) {
    if (entry.separator) {
      list.append(el("div", "menu-separator"));
      continue;
    }

    const row = el("button", "menu-item", [entry.label ?? ""]);
    row.type = "button";
    row.disabled = entry.disabled === true;

    if (entry.items?.length) {
      row.classList.add("has-submenu");
      row.append(el("span", "chevron", ["›"]));
      row.append(build(entry.items, true));
    } else {
      row.addEventListener("click", () => {
        closeMenu();
        entry.action?.();
      });
    }
    list.append(row);
  }
  return list;
}

export function showMenu(x: number, y: number, entries: MenuEntry[]) {
  const container = menu();
  container.replaceChildren(build(entries));
  container.hidden = false;

  // keep it on screen once its size is known; submenus open leftwards near the right edge
  const { width, height } = container.getBoundingClientRect();
  container.classList.toggle("flip", x + width + 220 > window.innerWidth);
  container.style.left = `${clamp(x, 8, window.innerWidth - width - 8)}px`;
  container.style.top = `${clamp(y, 8, window.innerHeight - height - 8)}px`;
}

// A press anywhere outside the menu dismisses it.
document.addEventListener(
  "pointerdown",
  (event) => {
    if (isMenuOpen() && !menu().contains(event.target as Node)) closeMenu();
  },
  true,
);
