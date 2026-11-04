import { afterEach, describe, expect, it, vi } from "vitest";
import { Closer, distanceToRect, HoverGroup, inTriangle, PathGuard } from "../src/core/hover-intent";

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top }) as DOMRectReadOnly;

describe("distance to a rectangle", () => {
  const box = rect(100, 100, 200, 100);

  it("is zero inside and measures straight to the nearest edge or corner", () => {
    expect(distanceToRect({ x: 150, y: 150 }, box)).toBe(0);
    expect(distanceToRect({ x: 50, y: 150 }, box)).toBe(50); // left of an edge
    expect(distanceToRect({ x: 150, y: 260 }, box)).toBe(60); // below an edge
    expect(distanceToRect({ x: 60, y: 60 }, box)).toBe(Math.hypot(40, 40)); // diagonal from a corner: Pythagoras
  });
});

describe("point in triangle", () => {
  const a = { x: 0, y: 0 }, b = { x: 100, y: 0 }, c = { x: 0, y: 100 };

  it("accepts inside and edge points and rejects outside points, whichever way the triangle is wound", () => {
    expect(inTriangle({ x: 20, y: 20 }, a, b, c)).toBe(true);
    expect(inTriangle({ x: 50, y: 50 }, a, b, c)).toBe(true);
    expect(inTriangle({ x: 80, y: 80 }, a, b, c)).toBe(false);
    expect(inTriangle({ x: -5, y: 10 }, a, b, c)).toBe(false);
    expect(inTriangle({ x: 20, y: 20 }, a, c, b)).toBe(true);
  });
});

describe("path guard", () => {
  // A submenu to the right of its trigger; the pointer leaves the trigger's right edge.
  const submenu = rect(300, 100, 180, 200);
  const exit = { x: 260, y: 130 };

  it("keeps a popup open while the pointer travels a diagonal path across the gap", () => {
    const guard = new PathGuard();
    guard.begin(exit, submenu);
    for (const point of [{ x: 270, y: 150 }, { x: 282, y: 175 }, { x: 292, y: 205 }, { x: 301, y: 240 }]) {
      expect(guard.heading(point)).toBe(true);
    }
  });

  it("lets go when the pointer drifts out of the corridor", () => {
    const guard = new PathGuard();
    guard.begin(exit, submenu);
    expect(guard.heading({ x: 262, y: 330 })).toBe(false); // straight down, away from the popup
  });

  it("lets go when the pointer turns back toward where it came from", () => {
    const guard = new PathGuard();
    guard.begin(exit, submenu);
    expect(guard.heading({ x: 285, y: 140 })).toBe(true);
    expect(guard.heading({ x: 240, y: 130 })).toBe(false);
  });

  it("treats arriving at the popup as heading and an unstarted guard as not", () => {
    const guard = new PathGuard();
    expect(guard.heading({ x: 310, y: 150 })).toBe(false);
    guard.begin(exit, submenu);
    expect(guard.active).toBe(true);
    expect(guard.heading({ x: 310, y: 150 })).toBe(true);
    guard.end();
    expect(guard.active).toBe(false);
  });

  it("works for a popup above its trigger, as a taskbar preview is", () => {
    const card = rect(200, 20, 400, 120);
    const guard = new PathGuard();
    guard.begin({ x: 380, y: 400 }, card); // leaving an icon far below the card
    expect(guard.heading({ x: 400, y: 330 })).toBe(true);
    expect(guard.heading({ x: 470, y: 200 })).toBe(true); // drifting up and right toward the card's far side
    expect(guard.heading({ x: 700, y: 390 })).toBe(false); // sliding sideways along the dock instead
  });
});

describe("closer", () => {
  afterEach(() => vi.useRealTimers());
  const popup = rect(300, 100, 180, 200);
  const exit = { x: 260, y: 130 };

  it("closes after the grace period when the pointer just leaves", () => {
    vi.useFakeTimers();
    const close = vi.fn();
    new Closer(close, 200).leave(exit, popup);
    vi.advanceTimersByTime(199);
    expect(close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(close).toHaveBeenCalledOnce();
  });

  it("never closes while the pointer keeps travelling toward the popup, even past the grace period", () => {
    vi.useFakeTimers();
    const close = vi.fn();
    const closer = new Closer(close, 200);
    closer.leave(exit, popup);
    for (const point of [{ x: 270, y: 150 }, { x: 284, y: 180 }, { x: 296, y: 220 }]) {
      vi.advanceTimersByTime(120);
      closer.move(point);
    }
    vi.advanceTimersByTime(120);
    expect(close).not.toHaveBeenCalled();
    expect(closer.heading({ x: 299, y: 240 })).toBe(true);
  });

  it("closes when the path leaves the corridor, and not when the pointer arrives and stays", () => {
    vi.useFakeTimers();
    const close = vi.fn();
    const closer = new Closer(close, 200);
    closer.leave(exit, popup);
    closer.move({ x: 275, y: 160 });
    closer.move({ x: 262, y: 340 }); // swerves away
    vi.advanceTimersByTime(201);
    expect(close).toHaveBeenCalledOnce();

    const arrived = vi.fn();
    const second = new Closer(arrived, 200);
    second.leave(exit, popup);
    second.stay();
    vi.advanceTimersByTime(500);
    expect(arrived).not.toHaveBeenCalled();
  });
});

describe("hover group", () => {
  afterEach(() => vi.useRealTimers());

  it("delays only the first popup, then opens neighbours at once, then cools down", () => {
    vi.useFakeTimers();
    const group = new HoverGroup(500, 450);
    expect(group.delay).toBe(500);

    group.opened();
    expect(group.delay).toBe(0); // one is open: the next is immediate

    group.closed();
    expect(group.delay).toBe(0); // only just closed: still warm
    vi.advanceTimersByTime(449);
    expect(group.delay).toBe(0);
    vi.advanceTimersByTime(2);
    expect(group.delay).toBe(500); // cold again
  });

  it("stays warm while any popup of the group remains open", () => {
    const group = new HoverGroup(500, 0);
    group.opened();
    group.opened();
    group.closed();
    expect(group.delay).toBe(0);
    group.closed();
    expect(group.delay).toBe(500);
  });
});
