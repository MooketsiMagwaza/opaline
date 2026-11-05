export type Point = { x: number; y: number };

/** Straight-line (Pythagorean) distance from a point to the nearest edge of a rectangle; 0 when the point is inside it. */
export const distanceToRect = (point: Point, rect: DOMRectReadOnly): number =>
  Math.hypot(Math.max(rect.left - point.x, 0, point.x - rect.right), Math.max(rect.top - point.y, 0, point.y - rect.bottom));

const side = (p: Point, a: Point, b: Point): number => (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);

/** True when `p` is inside (or on the edge of) triangle abc: it lies on the same side of all three edges. */
export function inTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const d1 = side(p, a, b), d2 = side(p, b, c), d3 = side(p, c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

/** The two corners of the popup's edge that faces `origin`, widened a little so a hand's wobble is forgiven. */
function nearCorners(origin: Point, rect: DOMRectReadOnly, pad: number): [Point, Point] {
  const gapX = origin.x < rect.left ? rect.left - origin.x : Math.max(origin.x - rect.right, 0);
  const gapY = origin.y < rect.top ? rect.top - origin.y : Math.max(origin.y - rect.bottom, 0);
  if (gapX >= gapY) {
    const x = origin.x < rect.left ? rect.left : rect.right;
    return [{ x, y: rect.top - pad }, { x, y: rect.bottom + pad }];
  }
  const y = origin.y < rect.top ? rect.top : rect.bottom;
  return [{ x: rect.left - pad, y }, { x: rect.right + pad, y }];
}

const TURN_BACK_PX = 10; // moving this much farther from the popup than the closest point reached counts as turning away
const REACH_PX = 14; // this close to the popup the pointer is treated as arriving, whatever its angle
const WOBBLE_PX = 8;

/**
 * Tells a pointer travelling from a trigger to its popup apart from one that is leaving. Without it a popup closes (or a
 * neighbour steals focus) as soon as the pointer crosses the gap or a sibling on a diagonal path.
 *
 * The pointer is "heading" while it stays inside the corridor between where it left and the popup's near edge (a triangle),
 * and has not turned back: its straight-line distance to the popup must not grow past the closest it has been.
 */
export class PathGuard {
  private origin: Point | null = null;
  private popup: DOMRectReadOnly | null = null;
  private closest = Infinity;

  get active(): boolean { return this.origin !== null; }

  begin(origin: Point, popup: DOMRectReadOnly) {
    this.origin = origin;
    this.popup = popup;
    this.closest = distanceToRect(origin, popup);
  }

  end() { this.origin = this.popup = null; }

  heading(point: Point): boolean {
    if (!this.origin || !this.popup) return false;
    const distance = distanceToRect(point, this.popup);
    if (distance === 0) return true;
    if (distance > this.closest + TURN_BACK_PX) return false;
    this.closest = Math.min(this.closest, distance);
    const [b, c] = nearCorners(this.origin, this.popup, WOBBLE_PX);
    return distance <= REACH_PX || inTriangle(point, this.origin, b, c);
  }
}

/** Latest pointer position and when it last moved, shared by every popup so the app listens to the pointer once. */
export const pointer = { x: 0, y: 0, at: 0 };
/** Whether the pointer moved in the last instant. A pointer that has stopped has stopped travelling and means what it rests on. */
export const pointerIsMoving = (): boolean => performance.now() - pointer.at < 140;

const watching = new Set<Closer>();
if (typeof document !== "undefined") {
  document.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.at = performance.now();
    watching.forEach((closer) => closer.move(pointer));
  }, { capture: true, passive: true });
}

/**
 * Closes a popup shortly after the pointer leaves it, unless the pointer is on its way to it. The decision is remade on every
 * pointer move, so a path that wobbles out of the corridor still closes it, and one that stays in the corridor never does.
 */
export class Closer {
  private readonly guard = new PathGuard();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly close: () => void, private readonly graceMs = 220) {}

  /** The pointer left the trigger or the popup at `origin`. */
  leave(origin: Point, popup: DOMRectReadOnly) {
    this.guard.begin(origin, popup);
    watching.add(this);
    this.arm();
  }

  /** The pointer is back on the trigger or the popup. */
  stay() {
    this.guard.end();
    watching.delete(this);
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** Whether a pointer that left a moment ago is still travelling toward the popup. */
  heading(point: Point): boolean { return this.guard.active && this.guard.heading(point); }

  move(point: Point) {
    if (this.guard.heading(point)) { clearTimeout(this.timer); this.timer = undefined; }
    else if (this.timer === undefined) this.arm();
  }

  private arm() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.stay(); this.close(); }, this.graceMs);
  }
}

/**
 * Hover delay shared by a set of triggers, like the items of a menu bar or a taskbar. Only the first popup waits; while one
 * is open, or one has only just closed, the next opens at once, so moving across neighbours feels continuous.
 */
export class HoverGroup {
  private open = 0;
  private warmUntil = 0;

  constructor(private readonly coldDelayMs: number, private readonly warmMs = 450) {}

  get delay(): number { return this.open > 0 || performance.now() < this.warmUntil ? 0 : this.coldDelayMs; }

  opened() { this.open++; }

  closed() {
    this.open = Math.max(0, this.open - 1);
    this.warmUntil = performance.now() + this.warmMs;
  }
}
