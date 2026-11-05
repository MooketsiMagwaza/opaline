import { byId, clamp, el } from "./dom";
import { Closer, HoverGroup, pointer, pointerIsMoving } from "./hover-intent";

export type MenuEntry = {
  label?: string;
  action?: () => void;
  items?: MenuEntry[];
  separator?: boolean;
  disabled?: boolean;
  checked?: boolean;
};

const menu = () => byId("menu");
let returnFocus: HTMLElement | null = null;

// Submenus open on hover intent, not CSS :hover: a diagonal path to one is not cut by the rows it crosses, and moving from
// one submenu row to the next is instant once one is open. Menus nest one level, so one open submenu at a time is enough.
const submenuGroup = new HoverGroup(110);
const submenuCloser = new Closer(() => setOpen(null), 180);
let openRow: HTMLElement | null = null;
let intentTimer: ReturnType<typeof setTimeout> | undefined;

function setOpen(next: HTMLElement | null) {
  if (openRow === next) return;
  openRow?.classList.remove("open");
  if (openRow) submenuGroup.closed();
  openRow = next;
  if (next) { next.classList.add("open"); submenuGroup.opened(); }
}

function resetHover() {
  clearTimeout(intentTimer);
  submenuCloser.stay();
  setOpen(null);
}

/** Moves the open submenu to `target` once the pointer's intent is clear. */
function decideSubmenu(target: HTMLElement) {
  clearTimeout(intentTimer);
  const decide = () => {
    // Still on its way to the open submenu across this row: keep that one, and look again when the pointer settles.
    if (openRow && openRow !== target && submenuCloser.heading(pointer) && pointerIsMoving()) { intentTimer = setTimeout(decide, 140); return; }
    submenuCloser.stay();
    setOpen(target);
  };
  intentTimer = setTimeout(decide, openRow ? 0 : submenuGroup.delay);
}

export const isMenuOpen = (): boolean => !menu().hidden;

export function closeMenu() {
  resetHover();
  const wasOpen = isMenuOpen();
  menu().hidden = true;
  menu().replaceChildren();
  if (wasOpen && returnFocus?.isConnected) returnFocus.focus();
}

function build(entries: MenuEntry[], submenu = false): HTMLElement {
  const list = el("div", submenu ? "menu-list submenu" : "menu-list");
  list.setAttribute("role", "menu");

  for (const entry of entries) {
    if (entry.separator) {
      list.append(el("div", "menu-separator"));
      continue;
    }

    const row = el("button", "menu-item", [entry.label ?? ""]);
    row.type = "button";
    row.setAttribute("role", "menuitem");
    if (entry.checked !== undefined) { row.setAttribute("role", "menuitemradio"); row.setAttribute("aria-checked", String(entry.checked)); row.append(el("span", "menu-check", [entry.checked ? "✓" : ""])); }
    row.disabled = entry.disabled === true;

    if (entry.items?.length) {
      row.setAttribute("aria-haspopup", "menu");
      row.append(el("span", "chevron", ["›"]));
      const wrapper = el("div", "has-submenu", [row, build(entry.items, true)]);
      wrapper.addEventListener("pointerenter", (event) => {
        if (event.pointerType !== "mouse") return;
        if (openRow === wrapper) { clearTimeout(intentTimer); submenuCloser.stay(); } else decideSubmenu(wrapper);
      });
      wrapper.addEventListener("pointerleave", (event) => {
        if (event.pointerType !== "mouse") return;
        clearTimeout(intentTimer);
        const submenu = wrapper.querySelector(".submenu");
        if (openRow === wrapper && submenu) submenuCloser.leave({ x: event.clientX, y: event.clientY }, submenu.getBoundingClientRect());
      });
      row.addEventListener("click", () => wrapper.querySelector<HTMLButtonElement>(".submenu .menu-item:not(:disabled)")?.focus());
      list.append(wrapper);
    } else {
      row.addEventListener("click", () => {
        closeMenu();
        entry.action?.();
      });
    }
    if (!entry.items?.length) list.append(row);
  }
  return list;
}

export function showMenu(x: number, y: number, entries: MenuEntry[]) {
  resetHover();
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const container = menu();
  container.replaceChildren(build(entries));
  container.hidden = false;

  // keep it on screen once its size is known; submenus open leftwards near the right edge
  const { width, height } = container.getBoundingClientRect();
  container.classList.toggle("flip", x + width + 220 > window.innerWidth);
  container.style.left = `${clamp(x, 8, window.innerWidth - width - 8)}px`;
  container.style.top = `${clamp(y, 8, window.innerHeight - height - 8)}px`;
  container.querySelector<HTMLButtonElement>(".menu-item:not(:disabled)")?.focus();
}

document.addEventListener("keydown", (event) => {
  if (!isMenuOpen() || !(document.activeElement instanceof HTMLElement) || !menu().contains(document.activeElement)) return;
  const active = document.activeElement;
  const list = active.closest(".menu-list")!;
  const buttons = [...list.querySelectorAll<HTMLButtonElement>(":scope > .menu-item:not(:disabled), :scope > .has-submenu > .menu-item:not(:disabled)")];
  const index = buttons.indexOf(active as HTMLButtonElement);
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault(); buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
  } else if (event.key === "ArrowRight") {
    const child = active.parentElement?.querySelector<HTMLButtonElement>(":scope > .submenu .menu-item:not(:disabled)");
    if (child) { event.preventDefault(); child.focus(); }
  } else if (event.key === "ArrowLeft" && list.classList.contains("submenu")) {
    event.preventDefault(); (list.previousElementSibling as HTMLElement)?.focus();
  } else if (event.key === "Tab") { event.preventDefault(); closeMenu(); }
});

// A press anywhere outside the menu dismisses it.
document.addEventListener(
  "pointerdown",
  (event) => {
    if (isMenuOpen() && !menu().contains(event.target as Node)) closeMenu();
  },
  true,
);
