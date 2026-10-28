/** Navigation gestures are deliberately limited to the launcher canvas. */
export function initPageGestures(cycle: (direction: number) => void, canNavigate: (target: EventTarget | null) => boolean) {
  const threshold = 110;
  let accumulated = 0;
  let lastWheel = 0;
  let lastNavigation = -Infinity;
  let wheelMode = "";

  window.addEventListener("wheel", (event) => {
    if (!canNavigate(event.target)) return;
    const pinch = event.ctrlKey && !event.altKey && !event.metaKey && event.deltaMode === 0 && Math.abs(event.deltaY) < 60;
    const horizontal = !event.ctrlKey && Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.2;
    if (!pinch && !horizontal) return;
    event.preventDefault();
    const mode = pinch ? "pinch" : "swipe";
    const now = performance.now();
    if (mode !== wheelMode || now - lastWheel > 240) accumulated = 0;
    wheelMode = mode; lastWheel = now;
    accumulated += pinch ? -event.deltaY : event.deltaX * (event.deltaMode === 1 ? 16 : 1);
    if (Math.abs(accumulated) >= threshold && now - lastNavigation > 550) {
      cycle(Math.sign(accumulated));
      accumulated = 0;
      lastNavigation = now;
    }
  }, { passive: false });

  const touches = new Map<number, { x: number; y: number }>();
  let start: { x: number; y: number; distance: number } | null = null;
  let consumed = false;
  const geometry = () => {
    const [first, second] = [...touches.values()];
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2, distance: Math.hypot(first.x - second.x, first.y - second.y) };
  };
  window.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch" || !canNavigate(event.target)) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size === 2) { start = geometry(); consumed = false; }
  });
  window.addEventListener("pointermove", (event) => {
    if (!touches.has(event.pointerId)) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size !== 2 || !start || consumed) return;
    const current = geometry();
    const distanceChange = current.distance / Math.max(1, start.distance);
    const driftX = current.x - start.x;
    const driftY = current.y - start.y;
    const pinch = distanceChange > 1.27 ? 1 : distanceChange < 0.78 ? -1 : 0;
    const swipe = Math.abs(driftX) > threshold && Math.abs(driftX) > Math.abs(driftY) * 1.4 ? -Math.sign(driftX) : 0;
    if (pinch || swipe) { event.preventDefault(); cycle(pinch || swipe); consumed = true; }
  });
  const release = (event: PointerEvent) => {
    touches.delete(event.pointerId);
    if (touches.size < 2) { start = null; consumed = false; }
  };
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
}
