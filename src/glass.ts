import { materialSettings, settings } from "./settings";

/**
 * The lens: what makes a pane bend the backdrop behind its edges like a slab of glass.
 *
 * Each lensed element gets its own SVG filter. A displacement map is drawn from the signed
 * distance field of the element's rounded rectangle: inside a bezel band along the edge, pixels
 * are pushed along the outward normal, strongest at the very edge. `feDisplacementMap` applies
 * it, and `backdrop-filter: url(#…)` runs the filter on whatever is behind the element.
 * Chromium (WebView2) supports this; other engines ignore it and fall back to Frost.
 */
const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_DISPLACEMENT = 30;

type Lens = {
  element: HTMLElement;
  filter: SVGFilterElement;
  id: string;
  signature: string;
};

const lenses = new Map<HTMLElement, Lens>();
const pending = new Set<Lens>();
const mapCache = new Map<string, string>();
let counter = 0;
let frame = 0;
const MAX_MAP_DIMENSION = 256;

function defs(): SVGDefsElement {
  return document.querySelector<SVGDefsElement>("#lens-defs defs")!;
}

export function attachLens(element: HTMLElement) {
  if (lenses.has(element)) return;

  const id = `lens-${++counter}`;
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.id = id;
  filter.setAttribute("filterUnits", "userSpaceOnUse");
  // linearRGB would shift the map's neutral value (128) and skew everything
  filter.setAttribute("color-interpolation-filters", "sRGB");
  defs().append(filter);

  const lens: Lens = { element, filter, id, signature: "" };
  lenses.set(element, lens);

  new ResizeObserver(() => schedule(lens)).observe(element);
  schedule(lens);
}

export function refreshLenses() {
  // The signature already includes every setting that changes lens output.
  // Scheduling without invalidating it makes unrelated settings effectively free.
  for (const lens of lenses.values()) schedule(lens);
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

function rebuild(lens: Lens) {
  const { element, filter, id } = lens;
  const s = settings();
  const material = materialSettings(s);

  // Solid, Frosted and Clear are pure CSS; drop inline overrides so the stylesheet decides.
  if (s.glassStyle !== "liquid" && s.glassStyle !== "custom") {
    setBackdrop(element, null);
    lens.signature = "";
    return;
  }

  // A Custom material with no refraction is ordinary CSS glass. Avoid allocating
  // an SVG displacement texture when it would have a zero-pixel effect.
  if (s.glassStyle === "custom" && material.refraction <= 0) {
    setBackdrop(element, null);
    lens.signature = "";
    return;
  }

  const width = Math.round(element.offsetWidth);
  const height = Math.round(element.offsetHeight);
  if (width < 12 || height < 12) return; // hidden for now; the observer fires again when shown

  const radius = Math.min(parseFloat(getComputedStyle(element).borderTopLeftRadius) || 24, width / 2, height / 2);
  const bezel = Math.min(Math.max(radius * 0.85, 14), Math.min(width, height) / 2 - 2);
  const signature = `${width}x${height}:${radius}:${bezel}:${material.refraction}:${material.paneBlur}`;

  if (signature !== lens.signature) {
    lens.signature = signature;

    // The displacement texture is smoothly scaled by feImage, so generating it
    // at a bounded resolution preserves the edge shape without blocking a frame
    // on a settings-sized, full-resolution canvas.
    const scale = Math.min(1, MAX_MAP_DIMENSION / Math.max(width, height));
    const mapWidth = Math.max(12, Math.round(width * scale));
    const mapHeight = Math.max(12, Math.round(height * scale));
    const mapRadius = radius * scale;
    const mapBezel = bezel * scale;
    const mapKey = `${mapWidth}x${mapHeight}:${mapRadius.toFixed(2)}:${mapBezel.toFixed(2)}`;
    let mapUrl = mapCache.get(mapKey);
    if (!mapUrl) {
      mapUrl = displacementMap(mapWidth, mapHeight, mapRadius, mapBezel);
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

    const displace = document.createElementNS(SVG_NS, "feDisplacementMap");
    displace.setAttribute("in", "SourceGraphic");
    displace.setAttribute("in2", "map");
    displace.setAttribute("scale", String(MAX_DISPLACEMENT * material.refraction));
    displace.setAttribute("xChannelSelector", "R");
    displace.setAttribute("yChannelSelector", "G");

    filter.setAttribute("x", "0");
    filter.setAttribute("y", "0");
    filter.setAttribute("width", String(width));
    filter.setAttribute("height", String(height));
    filter.replaceChildren(map, displace);
  }

  setBackdrop(element, `blur(${material.paneBlur}px) url(#${id}) saturate(1.7) brightness(1.08)`);
}

/** R and G encode the displacement along x and y (128 = none); B and A are constant. */
function displacementMap(width: number, height: number, radius: number, bezel: number): string {
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
        // 1 at the edge, easing to 0 where the bezel ends
        const strength = Math.pow(1 - depth / bezel, 2.2);

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

        dx = nx * strength;
        dy = ny * strength;
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
