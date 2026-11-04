import { describe, expect, it } from "vitest";
import { GLASS_INDEX, rayShift, refractionProfile, squircleHeight } from "../src/core/refraction";

describe("glass refraction", () => {
  it("rises from the outer edge to a flat top", () => {
    expect(squircleHeight(0)).toBe(0);
    expect(squircleHeight(1)).toBe(1);
    for (let x = 0.05; x < 1; x += 0.05) expect(squircleHeight(x)).toBeGreaterThan(squircleHeight(x - 0.05));
  });

  it("does not bend a ray that meets a flat surface", () => {
    expect(rayShift(0, 20)).toBeCloseTo(0, 10);
  });

  it("bends a steeper surface more, with Snell's law capping the angle at the glass's critical turn", () => {
    expect(rayShift(1, 20)).toBeGreaterThan(rayShift(0.3, 20));
    // A vertical surface sends the ray in at 90 degrees, which glass turns to asin(1/n); the shift is thickness * tan of the difference.
    const vertical = rayShift(1e9, 20);
    expect(vertical).toBeCloseTo(20 * Math.tan(Math.PI / 2 - Math.asin(1 / GLASS_INDEX)), 5);
  });

  it("scales with the thickness of the glass", () => {
    expect(rayShift(0.6, 40)).toBeCloseTo(rayShift(0.6, 20) * 2, 8);
  });

  it("is strongest at the very edge and fades to nothing across the bezel", () => {
    const profile = refractionProfile(64, 24, 22);
    expect(profile.shift[0]).toBeCloseTo(1, 1);
    for (let index = 1; index < profile.shift.length; index++) expect(profile.shift[index]).toBeLessThanOrEqual(profile.shift[index - 1] + 1e-6);
    expect(profile.shift[profile.shift.length - 1]).toBeLessThan(0.05);
    expect(Math.max(...profile.shift)).toBeLessThanOrEqual(1);
  });

  it("reports the strongest shift in pixels, growing with the thickness", () => {
    const thin = refractionProfile(64, 24, 10);
    const thick = refractionProfile(64, 24, 20);
    expect(thick.maxShift).toBeGreaterThan(thin.maxShift * 1.8);
    expect(thick.maxShift).toBeGreaterThan(0);
  });
});
