/**
 * How a slab of glass with a rounded edge bends the light behind it, after Snell's law. Pure maths, so it can be tested;
 * `glass.ts` turns it into a displacement map for an SVG filter.
 *
 * The surface rises from the outer edge to a flat top. Looking straight down, a ray meets that surface at an angle set by its
 * slope, bends toward the normal as it enters the glass, and lands on the backdrop shifted sideways by the thickness times the
 * tangent of how far it was turned. The shift is largest where the surface is steepest (the very edge) and fades to nothing
 * over the flat top, which is what makes the edge of real glass magnify and warp whatever is behind it.
 */
export const GLASS_INDEX = 1.5; // refractive index of glass; air is 1

/** Height of a convex squircle edge: 0 at the outer edge (x = 0) to 1 where the flat top begins (x = 1). */
export const squircleHeight = (x: number): number => Math.pow(1 - Math.pow(1 - x, 4), 1 / 4);

/** Sideways shift, in the units of `thickness`, of a ray meeting a surface whose slope (rise over run) is `slope`. */
export function rayShift(slope: number, thickness: number): number {
  const incident = Math.atan(Math.abs(slope)); // angle between the vertical ray and the surface normal
  const refracted = Math.asin(Math.sin(incident) / GLASS_INDEX);
  return thickness * Math.tan(incident - refracted);
}

export type RefractionProfile = {
  /** Shift at each sample from the outer edge (index 0) inwards, as a fraction of `maxShift` (1 is the strongest). */
  shift: Float32Array;
  /** The strongest shift in pixels, which is the `scale` the displacement filter needs. */
  maxShift: number;
};

/**
 * One slice through the edge, sampled `samples` times across a bezel `bezel` pixels wide. Radial symmetry lets one slice serve
 * the whole outline: the map rotates it around the shape. `thickness` is how thick the glass is in pixels.
 */
export function refractionProfile(samples: number, bezel: number, thickness: number): RefractionProfile {
  const step = 0.001;
  const shifts = new Float32Array(samples);
  let strongest = 0;
  for (let index = 0; index < samples; index++) {
    // Keep clear of x = 0, where the squircle is vertical and the slope runs to infinity.
    const x = Math.min(1 - step, Math.max(0.004, index / (samples - 1)));
    const rise = (squircleHeight(x + step) - squircleHeight(x - step)) / (2 * step); // per unit of bezel width
    shifts[index] = rayShift((rise * thickness) / bezel, thickness);
    strongest = Math.max(strongest, shifts[index]);
  }
  for (let index = 0; index < samples; index++) shifts[index] = strongest > 0 ? shifts[index] / strongest : 0;
  return { shift: shifts, maxShift: strongest };
}
