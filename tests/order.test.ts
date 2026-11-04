import { describe, expect, it } from "vitest";

import { insertionIndexForPoint, isCentralDrop, type Bounds } from "../src/grid/order";

const tile = (left: number, top: number): Bounds => ({ left, top, right: left + 100, bottom: top + 120, width: 100, height: 120 });

describe("drag ordering", () => {
  it("reserves the centre for grouping and tile edges for insertion", () => {
    const bounds = tile(100, 50);
    expect(isCentralDrop(bounds, 150, 110)).toBe(true);
    expect(isCentralDrop(bounds, 105, 110)).toBe(false);
    expect(isCentralDrop(bounds, 150, 55)).toBe(false);
  });

  it("finds insertion slots across grid rows", () => {
    const bounds = [tile(0, 0), tile(110, 0), tile(0, 130), tile(110, 130)];
    expect(insertionIndexForPoint(bounds, -10, 40)).toBe(0);
    expect(insertionIndexForPoint(bounds, 180, 40)).toBe(2);
    expect(insertionIndexForPoint(bounds, 20, 140)).toBe(2);
    expect(insertionIndexForPoint(bounds, 240, 300)).toBe(4);
  });
});
