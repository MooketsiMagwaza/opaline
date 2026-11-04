import { byId } from "../core/dom";
import { Closer } from "../core/hover-intent";

const OPEN_INTENT_MS = 140; // the pointer must rest on the trigger this long before hover opens it

/**
 * The navigation dropdown tray. Resting on it opens it, leaving closes it unless the pointer is on its way to the list, a
 * click pins it open until dismissed, and a press outside or Escape closes it, as a dropdown should.
 */
export function initTray() {
  const tray = byId<HTMLDetailsElement>("navigation-overflow");
  const summary = tray.querySelector("summary")!;
  const panel = tray.querySelector<HTMLElement>(".navigation-tray")!;
  let pinned = false;
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  const closer = new Closer(() => { if (!pinned) tray.open = false; }, 240);

  const dismiss = () => {
    clearTimeout(openTimer);
    closer.stay();
    pinned = false;
    tray.open = false;
  };

  tray.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "mouse") return;
    closer.stay();
    if (!tray.open) openTimer = setTimeout(() => { tray.open = true; }, OPEN_INTENT_MS);
  });
  tray.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "mouse") return;
    clearTimeout(openTimer);
    if (tray.open && !pinned) closer.leave({ x: event.clientX, y: event.clientY }, panel.getBoundingClientRect());
  });
  // A click on a tray that hover opened pins it instead of toggling it shut; otherwise it toggles as a <details> does.
  summary.addEventListener("click", (event) => {
    if (tray.open && !pinned) { event.preventDefault(); pinned = true; } else pinned = !tray.open;
  });
  tray.addEventListener("toggle", () => { if (!tray.open) { pinned = false; closer.stay(); } });
  document.addEventListener("pointerdown", (event) => { if (tray.open && !tray.contains(event.target as Node)) dismiss(); }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !tray.open) return;
    event.preventDefault();
    event.stopImmediatePropagation(); // the first Escape closes the tray; the launcher stays open
    dismiss();
    summary.focus();
  }, true);
}
