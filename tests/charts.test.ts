import { describe, expect, it } from "vitest";
import { countAxis, timeAxis } from "../src/activity/charts";

describe("chart axes", () => {
  it("puts the top tick just above the data with round steps", () => {
    const axis = timeAxis(2 * 3600 + 20 * 60);
    expect(axis.ticks).toEqual([0, 3600, 7200, 10800]);
    expect(axis.top).toBe(10800);
    expect(axis.ticks.map(axis.label)).toEqual(["0", "1h", "2h", "3h"]);
  });

  it("writes minutes under an hour and fractions of an hour when the step needs them", () => {
    const small = timeAxis(18 * 60);
    expect(small.ticks.map(small.label)).toEqual(["0", "5m", "10m", "15m", "20m"]);
    const half = timeAxis(3600 + 600);
    expect(half.ticks.map(half.label)).toContain("1.5h");
  });

  it("never needs more than four intervals", () => {
    for (const seconds of [1, 59, 600, 4000, 9000, 23000, 80000]) {
      const axis = timeAxis(seconds);
      expect(axis.ticks.length - 1).toBeLessThanOrEqual(4);
      expect(axis.top).toBeGreaterThanOrEqual(seconds);
    }
  });

  it("still draws a usable axis when there is no data", () => {
    const axis = timeAxis(0);
    expect(axis.ticks).toEqual([0, 60]);
    expect(axis.top).toBe(60);
  });

  it("counts in whole numbers", () => {
    const axis = countAxis(7);
    expect(axis.ticks).toEqual([0, 2, 4, 6, 8]);
    expect(axis.ticks.map(axis.label)).toEqual(["0", "2", "4", "6", "8"]);
    expect(countAxis(1).ticks).toEqual([0, 1]);
  });
});
