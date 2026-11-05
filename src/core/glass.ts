import { materialSettings, settings } from "../settings/store";
import { refractionProfile } from "./refraction";

/**
 * The lens: what makes a panel bend the desktop behind its edges like a slab of thick glass, rather than only frosting it.
 *
 * Each lensed element gets its own SVG filter. A displacement map is drawn from the signed distance field of the element's
 * rounded rectangle: inside a bezel band along the edge, every pixel is told where to sample the backdrop from, using the
 * physically-based shift in `refraction.ts` (Snell's law over a convex squircle edge), strongest at the edge and fading to
 * nothing across the flat top. `feDisplacementMap` applies it, once per colour channel with a slightly different strength so
 * the edge disperses light like real glass, and `backdrop-filter: url(#…)` runs the whole filter on whatever is behind the
 * element. Chromium (WebView2) supports this; other engines ignore it and fall back to frosting.
 *
 * It costs GPU time on every frame the backdrop changes, so it is off unless the material asks for refraction.
 */
const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_MAP_DIMENSION = 256;
const PROFILE_SAMPLES = 128;
/** The glass is this thick relative to its bezel, which sets how far the strongest ray is thrown. */
const THICKNESS_PER_BEZEL = 0.9;
/** Blue bends more than red; these are the per-channel scales, as a fraction of the base displacement. */
const DISPERSION = { r: 0.94, g: 1, b: 1.06 } as const;
/** The elements that wear the lens: the large panels and the controls docked around them. */
const LENSED = ".page-surface, #search-wrap, .header-nav, #home-dock, #rail";

type Lens = {
  element: HTMLElement;
  filter: SVGFilterElement;
  observer: ResizeObserver;
  id: string;
  signature: string;
};

const lenses = new Map<HTMLElement, Lens>();
const pending = new Set<Lens>();
const mapCache = new Map<string, string>();
let counter = 0;
let frame = 0;

function defs(): SVGDefsElement {
  return document.querySelector<SVGDefsElement>("#lens-defs defs")!;
}

function attachLens(element: HTMLElement) {
  if (lenses.has(element)) return;

  const id = `lens-${++counter}`;
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.id = id;
  filter.setAttribute("filterUnits", "userSpaceOnUse");
  // linearRGB would shift the map's neutral value (128) and skew everything
  filter.setAttribute("color-interpolation-filters", "sRGB");
  defs().append(filter);

  const observer = new ResizeObserver(() => schedule(lens));
  const lens: Lens = { element, filter, observer, id, signature: "" };
  lenses.set(element, lens);
  observer.observe(element);
  schedule(lens);
}

function detachLens(lens: Lens) {
  lens.observer.disconnect();
  lens.filter.remove();
  setBackdrop(lens.element, null);
  lenses.delete(lens.element);
  pending.delete(lens);
}

/** Puts the lens on the panels when the material bends light, takes it off when it does not, and brings it up to date. */
export function syncLenses() {
  if (materialSettings(settings()).refraction > 0) {
    for (const element of document.querySelectorAll<HTMLElement>(LENSED)) attachLens(element);
    // The signature already includes every setting that changes lens output, so unrelated changes cost nothing.
    for (const lens of lenses.values()) schedule(lens);
  } else {
    for (const lens of [...lenses.values()]) detachLens(lens);
  }
}

function schedule(lens: Lens) {
  pending.add(lens);
  if (frame) return;

  frame = requestAnimationFrame(() => {
    frame = 0;
    const batch = [...pending];
    pending.clear();
    for (const queued of batch) rebuild(queued);
  });
}

function setBackdrop(element: HTMLElement, value: string | null) {
  for (const property of ["backdrop-filter", "-webkit-backdrop-filter"]) {
    if (value) element.style.setProperty(property, value);
    else element.style.removeProperty(property);
  }
}

/** Each matrix keeps one colour channel and the alpha, so the three shifted copies can be added back together. */
const KEEP_CHANNEL = {
  r: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
  g: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
  b: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0",
} as const;

/** The backdrop displaced by `scale` pixels, reduced to one colour channel. */
function channel(name: keyof typeof KEEP_CHANNEL, scale: number, base: SVGFEDisplacementMapElement): SVGElement[] {
  const displace = base.cloneNode() as SVGFEDisplacementMapElement;
  displace.setAttribute("scale", scale.toFixed(2));
  displace.setAttribute("result", `shifted-${name}`);
  const isolate = document.createElementNS(SVG_NS, "feColorMatrix");
  isolate.setAttribute("in", `shifted-${name}`);
  isolate.setAttribute("type", "matrix");
  isolate.setAttribute("values", KEEP_CHANNEL[name]);
  isolate.setAttribute("result", `channel-${name}`);
  return [displace, isolate];
}

function rebuild(lens: Lens) {
  const { element, filter, id } = lens;
  const material = materialSettings(settings());

  if (material.refraction <= 0) {
    setBackdrop(element, null);
    lens.signature = "";
    return;
  }

  const width = Math.round(element.offsetWidth);
  const height = Math.round(element.offsetHeight);
  if (width < 12 || height < 12) return; // hidden for now; the observer fires again when shown

  const radius = Math.min(parseFloat(getComputedStyle(element).borderTopLeftRadius) || 24, width / 2, height / 2);
  const bezel = Math.min(Math.max(radius, 16), Math.min(width, height) / 2 - 2);
  const signature = `${width}x${height}:${radius}:${bezel}:${material.refraction}:${material.paneBlur}`;

  if (signature !== lens.signature) {
    lens.signature = signature;

    const thickness = bezel * THICKNESS_PER_BEZEL;
    const profile = refractionProfile(PROFILE_SAMPLES, bezel, thickness);

    // The displacement texture is smoothly scaled by feImage, so generating it at a bounded resolution preserves the edge shape
    // without blocking a frame on a settings-sized, full-resolution canvas.
    const scale = Math.min(1, MAX_MAP_DIMENSION / Math.max(width, height));
    const mapWidth = Math.max(12, Math.round(width * scale));
    const mapHeight = Math.max(12, Math.round(height * scale));
    const mapRadius = radius * scale;
    const mapBezel = bezel * scale;
    const mapKey = `${mapWidth}x${mapHeight}:${mapRadius.toFixed(2)}:${mapBezel.toFixed(2)}:${thickness.toFixed(2)}`;
    let mapUrl = mapCache.get(mapKey);
    if (!mapUrl) {
      mapUrl = displacementMap(mapWidth, mapHeight, mapRadius, mapBezel, profile.shift);
      if (mapCache.size >= 32) mapCache.delete(mapCache.keys().next().value!);
      mapCache.set(mapKey, mapUrl);
    }

    const map = document.createElementNS(SVG_NS, "feImage");
    map.setAttribute("href", mapUrl);
    map.setAttribute("x", "0");
    map.setAttribute("y", "0");
    map.setAttribute("width", String(width));
    map.setAttribute("height", String(height));
    map.setAttribute("preserveAspectRatio", "none");
    map.setAttribute("result", "map");

    // feDisplacementMap moves a pixel by scale * (value - 0.5), so a full-strength map value moves it by half the scale: double the
    // strongest shift to get it exactly. The refraction setting scales how much of that is applied.
    const strength = 2 * profile.maxShift * material.refraction;
    const base = document.createElementNS(SVG_NS, "feDisplacementMap");
    base.setAttribute("in", "SourceGraphic");
    base.setAttribute("in2", "map");
    base.setAttribute("xChannelSelector", "R");
    base.setAttribute("yChannelSelector", "G");

    const [shiftedR, keepR] = channel("r", strength * DISPERSION.r, base);
    const [shiftedG, keepG] = channel("g", strength * DISPERSION.g, base);
    const [shiftedB, keepB] = channel("b", strength * DISPERSION.b, base);
    const addRG = document.createElementNS(SVG_NS, "feBlend");
    addRG.setAttribute("in", "channel-r");
    addRG.setAttribute("in2", "channel-g");
    addRG.setAttribute("mode", "screen");
    addRG.setAttribute("result", "channels-rg");
    const addB = document.createElementNS(SVG_NS, "feBlend");
    addB.setAttribute("in", "channels-rg");
    addB.setAttribute("in2", "channel-b");
    addB.setAttribute("mode", "screen");

    filter.setAttribute("x", "0");
    filter.setAttribute("y", "0");
    filter.setAttribute("width", String(width));
    filter.setAttribute("height", String(height));
    filter.replaceChildren(map, shiftedR, keepR, shiftedG, keepG, shiftedB, keepB, addRG, addB);
  }

  setBackdrop(element, `blur(${material.paneBlur}px) url(#${id}) saturate(1.7) brightness(1.08)`);
}

/**
 * R and G encode where each pixel samples the backdrop from, as a fraction of the strongest shift (128 = none). The shift points
 * inward: seen through a convex edge, the backdrop at the rim is drawn from further in, which is what magnifies it.
 */
function displacementMap(width: number, height: number, radius: number, bezel: number, shift: Float32Array): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(width, height);
  const data = image.data;

  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const insetX = halfWidth - radius;
  const insetY = halfHeight - radius;
  const last = shift.length - 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x + 0.5 - halfWidth;
      const py = y + 0.5 - halfHeight;

      // signed distance to the rounded rectangle (negative inside)
      const qx = Math.abs(px) - insetX;
      const qy = Math.abs(py) - insetY;
      const outsideX = Math.max(qx, 0);
      const outsideY = Math.max(qy, 0);
      const outside = Math.hypot(outsideX, outsideY);
      const depth = -(outside + Math.min(Math.max(qx, qy), 0) - radius);

      let dx = 0;
      let dy = 0;
      if (depth > 0 && depth < bezel) {
        const position = (depth / bezel) * last;
        const lower = Math.floor(position);
        const amount = shift[lower] + (shift[Math.min(last, lower + 1)] - shift[lower]) * (position - lower);

        // the outward normal at this point of the outline, turned around to point inward
        let nx: number;
        let ny: number;
        if (qx > 0 && qy > 0) {
          nx = (outsideX / (outside || 1)) * Math.sign(px);
          ny = (outsideY / (outside || 1)) * Math.sign(py);
        } else if (qx > qy) {
          nx = Math.sign(px);
          ny = 0;
        } else {
          nx = 0;
          ny = Math.sign(py);
        }

        dx = -nx * amount;
        dy = -ny * amount;
      }

      const index = (y * width + x) * 4;
      data[index] = 128 + dx * 127;
      data[index + 1] = 128 + dy * 127;
      data[index + 2] = 128;
      data[index + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}
