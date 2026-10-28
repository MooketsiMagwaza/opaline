type Point = { x: number; y: number };
type GestureHandlers = {
  navigate: (direction: number, mode: "pinch" | "swipe") => void;
  preview: (direction: number, progress: number, mode: "pinch" | "swipe") => void;
  cancel: () => void;
  canNavigate: (target: EventTarget | null) => boolean;
};

/** One controller owns the gesture burst, its live preview, and its cancellation. */
export class PageGestureController {
  private wheelAmount = 0;
  private wheelMode = "";
  private wheelLastAt = 0;
  private wheelLocked = false;
  private wheelIdleTimer: number | undefined;
  private lastTouchNavigationAt = -Infinity;
  private previewTarget = 0;
  private previewShown = 0;
  private previewMode: "pinch" | "swipe" = "swipe";
  private previewFrame: number | undefined;
  private previewLastAt = 0;
  private readonly touches = new Map<number, Point>();
  private readonly touchOrigins = new Map<number, Point>();
  private readonly movedTouches = new Set<number>();
  private touchStart: { x: number; y: number; distance: number } | null = null;
  private touchCommitted = false;

  constructor(private readonly handlers: GestureHandlers) {}

  init() {
    window.addEventListener("wheel", event => this.onWheel(event), { passive: false });
    window.addEventListener("pointerdown", event => this.onTouchStart(event));
    window.addEventListener("pointermove", event => this.onTouchMove(event));
    window.addEventListener("pointerup", event => this.onTouchEnd(event));
    window.addEventListener("pointercancel", event => this.onTouchEnd(event));
    window.addEventListener("click", event => this.suppressTouchClick(event), true);
  }

  private suppressTouchClick(event: MouseEvent) {
    if (!(event instanceof PointerEvent) || event.pointerType !== "touch") return;
    if (performance.now() - this.lastTouchNavigationAt > 220) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  private paintPreview(now: number) {
    const elapsed = Math.min(64, now - (this.previewLastAt || now));
    this.previewLastAt = now;
    this.previewShown += (this.previewTarget - this.previewShown) * (1 - Math.exp(-elapsed / 24));
    if (Math.abs(this.previewTarget - this.previewShown) < .006) this.previewShown = this.previewTarget;
    this.handlers.preview(Math.sign(this.previewShown), Math.abs(this.previewShown), this.previewMode);
    this.previewFrame = this.previewShown === this.previewTarget ? undefined : requestAnimationFrame(time => this.paintPreview(time));
  }

  private queuePreview(direction: number, progress: number, mode: "pinch" | "swipe") {
    this.previewTarget = direction * progress;
    this.previewMode = mode;
    if (this.previewFrame === undefined) this.previewFrame = requestAnimationFrame(time => this.paintPreview(time));
  }

  private stopPreview(cancel: boolean) {
    if (this.previewFrame !== undefined) cancelAnimationFrame(this.previewFrame);
    this.previewFrame = undefined;
    this.previewLastAt = 0;
    this.previewShown = 0;
    this.previewTarget = 0;
    if (cancel) this.handlers.cancel();
  }

  private resetWheel() {
    window.clearTimeout(this.wheelIdleTimer);
    this.wheelAmount = 0;
    this.wheelLocked = false;
    this.stopPreview(true);
  }

  private onWheel(event: WheelEvent) {
    const pinch = event.ctrlKey && !event.altKey && !event.metaKey && event.deltaY !== 0;
    // Wry must allow WebView2 pinch input; cancel its page zoom even outside navigable canvas regions.
    if (pinch) event.preventDefault();
    if (!this.handlers.canNavigate(event.target)) return;
    const swipe = !event.ctrlKey && Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.2;
    if (!pinch && !swipe) return;
    event.preventDefault();

    const mode = pinch ? "pinch" : "swipe";
    const now = performance.now();
    if (mode !== this.wheelMode || now - this.wheelLastAt > 350) this.resetWheel();
    this.wheelMode = mode;
    this.wheelLastAt = now;
    window.clearTimeout(this.wheelIdleTimer);
    this.wheelIdleTimer = window.setTimeout(() => this.resetWheel(), 350);
    if (this.wheelLocked) return;

    const delta = (pinch ? -event.deltaY : event.deltaX) * (event.deltaMode === 1 ? 16 : 1);
    if (this.wheelAmount && Math.sign(this.wheelAmount) !== Math.sign(delta)) this.wheelAmount = 0;
    this.wheelAmount += delta;
    const progress = Math.min(1, Math.abs(this.wheelAmount) / (pinch ? 56 : 90));
    const direction = Math.sign(this.wheelAmount);
    this.queuePreview(direction, progress, mode);
    if (progress < 1) return;
    this.wheelLocked = true;
    this.stopPreview(false);
    this.handlers.navigate(direction, mode);
  }

  private touchGeometry() {
    const [first, second] = [...this.touches.values()];
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2, distance: Math.hypot(first.x - second.x, first.y - second.y) };
  }

  private onTouchStart(event: PointerEvent) {
    if (event.pointerType !== "touch" || !this.handlers.canNavigate(event.target)) return;
    this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.touchOrigins.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.touches.size === 2) { this.touchStart = this.touchGeometry(); this.touchCommitted = false; }
  }

  private onTouchMove(event: PointerEvent) {
    if (!this.touches.has(event.pointerId)) return;
    this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.touches.size !== 2 || !this.touchStart || this.touchCommitted) return;
    const origin = this.touchOrigins.get(event.pointerId)!;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) >= 6) this.movedTouches.add(event.pointerId);
    if (this.movedTouches.size < 2) return;
    const current = this.touchGeometry();
    const ratio = current.distance / Math.max(1, this.touchStart.distance);
    const driftX = current.x - this.touchStart.x;
    const driftY = current.y - this.touchStart.y;
    const pinchStrength = Math.abs(ratio - 1) / 0.25;
    const swipeStrength = Math.abs(driftX) / 90;
    const xMoves = [...this.touches].map(([id, point]) => point.x - this.touchOrigins.get(id)!.x);
    const swipe = Math.sign(xMoves[0]) === Math.sign(xMoves[1]) && Math.abs(driftX) > 8 && Math.abs(driftX) > Math.abs(driftY) * 1.4;
    const pinch = !swipe && Math.abs(ratio - 1) > 0.04;
    if (!pinch && !swipe) return;

    const direction = pinch ? Math.sign(ratio - 1) : -Math.sign(driftX);
    const progress = Math.min(1, pinch ? pinchStrength : swipeStrength);
    this.queuePreview(direction, progress, pinch ? "pinch" : "swipe");
    if (progress < 1) return;
    event.preventDefault();
    this.touchCommitted = true;
    this.lastTouchNavigationAt = performance.now();
    this.stopPreview(false);
    this.handlers.navigate(direction, pinch ? "pinch" : "swipe");
  }

  private onTouchEnd(event: PointerEvent) {
    if (!this.touches.has(event.pointerId)) return;
    if (this.touchStart && !this.touchCommitted && this.touches.size === 2 && this.movedTouches.size === 1) {
      const ratio = this.touchGeometry().distance / Math.max(1, this.touchStart.distance);
      if (Math.abs(ratio - 1) >= .25) {
        this.touchCommitted = true;
        this.lastTouchNavigationAt = performance.now();
        this.stopPreview(false);
        this.handlers.navigate(Math.sign(ratio - 1), "pinch");
      }
    }
    const committed = this.touchCommitted;
    this.touches.clear();
    this.touchOrigins.clear();
    this.movedTouches.clear();
    this.touchStart = null;
    this.touchCommitted = false;
    if (!committed) this.stopPreview(true);
  }
}

export function initPageGestures(handlers: GestureHandlers) { new PageGestureController(handlers).init(); }
