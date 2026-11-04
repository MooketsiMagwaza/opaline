import { byId } from "../core/dom";

export type GestureMode = "pinch" | "swipe";

/** What the motion needs to know about the page; pages.ts supplies it so this module never imports routing. */
export type GestureSource = {
  /** The element that moves: the Home content for a swipe, the whole page panel for a pinch. */
  locate: (mode: GestureMode) => HTMLElement | null;
  /** The visible page panel. The cue is sized and placed from it. */
  panel: () => HTMLElement | null;
  /** Name of what the gesture leads to, shown in the cue. Empty hides the cue. */
  destination: (direction: number, mode: GestureMode) => string;
};

// Preview and commit share these numbers, so the commit continues from exactly what the preview last painted.
const SWIPE_FOLLOW_PX = 56; // how far Home content follows a swipe at full progress
const PINCH_RANGE = .075; // how far the current page scales at full pinch progress
const EXPO_OUT = "cubic-bezier(.16,1,.3,1)";
const MOTION = {
  swipe: { outMs: 220, outEase: "cubic-bezier(.25,.6,.5,1)", exitPx: 88, inMs: 380, inEase: EXPO_OUT, inDelayMs: 40, enterPx: 72 },
  pinch: { outMs: 260, outEase: "cubic-bezier(.3,.5,.6,1)", exitScale: .14, inMs: 440, inEase: EXPO_OUT, inDelayMs: 70, enterScale: .11 },
} as const;
const SAFETY_MS = 1500; // a stalled animation must never leave the launcher refusing the next gesture

type Preview = { element: HTMLElement; mode: GestureMode; direction: number; progress: number };
type Run = { animations: Animation[]; elements: HTMLElement[]; ghost: HTMLElement | null; navigating: boolean };

let preview: Preview | null = null;
let run: Run | null = null;

const easeOut = (value: number): number => 1 - (1 - value) * (1 - value);
const fadeOf = (progress: number): number => progress ** 1.4;
const cue = (): HTMLElement => byId("gesture-cue");

export const motionAllowed = (): boolean => document.body.dataset.anim !== "false" && !matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Paints the live preview of a gesture in progress. */
export function showPreview(source: GestureSource, direction: number, progress: number, mode: GestureMode) {
  endTransition(); // a new gesture takes over from any motion still settling, which would otherwise hide the preview
  if (preview && preview.mode !== mode) clearPreview();
  const element = preview?.element ?? source.locate(mode);
  if (!element) return;

  const eased = easeOut(progress);
  element.dataset.gesturePreview = "true";
  element.dataset.gestureMode = mode;
  element.style.setProperty("--gesture-dir", String(direction));
  element.style.setProperty("--gesture-p", eased.toFixed(4));
  element.style.setProperty("--gesture-fade", fadeOf(eased).toFixed(4));
  preview = { element, mode, direction, progress: eased };
  paintCue(source, direction, eased, mode);
}

/** Releases the preview. The elements spring back through their CSS transition; nothing snaps. */
export function clearPreview(keepCue = false) {
  if (preview) {
    const { element } = preview;
    delete element.dataset.gesturePreview;
    delete element.dataset.gestureMode;
    for (const name of ["--gesture-dir", "--gesture-p", "--gesture-fade"]) element.style.removeProperty(name);
    preview = null;
  }
  if (!keepCue) hideCue();
}

// Only these two constant glyphs are ever written as markup; the destination name is always set as text.
const ARROWS = { previous: "M15 5l-7 7 7 7", next: "M9 5l7 7-7 7" } as const;

function paintCue(source: GestureSource, direction: number, progress: number, mode: GestureMode) {
  const label = source.destination(direction, mode);
  const node = cue();
  if (!label) { node.hidden = true; return; }

  const heading = direction > 0 ? "next" : "previous";
  if (node.hidden || node.dataset.mode !== mode || node.dataset.direction !== heading || node.dataset.label !== label) {
    const panel = source.panel();
    const shell = byId("shell").getBoundingClientRect();
    const box = panel?.getBoundingClientRect();
    if (box) {
      node.style.setProperty("--cue-x", `${box.left - shell.left}px`);
      node.style.setProperty("--cue-y", `${box.top - shell.top}px`);
      node.style.setProperty("--cue-w", `${box.width}px`);
      node.style.setProperty("--cue-h", `${box.height}px`);
    }
    node.innerHTML = `<span class="cue-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ARROWS[heading]}"/></svg></span><span class="cue-label"></span>`;
    node.querySelector(".cue-label")!.textContent = label;
    node.dataset.label = label;
    node.dataset.kicker = `${heading === "next" ? "Next" : "Previous"} ${mode === "pinch" ? "page" : "screen"}`;
    node.dataset.mode = mode;
    node.dataset.direction = heading;
    delete node.dataset.leaving;
    node.hidden = false;
  }
  node.style.setProperty("--gesture-p", progress.toFixed(4));
}

function hideCue() {
  const node = cue();
  node.hidden = true;
  delete node.dataset.leaving;
}

function outFrames(mode: GestureMode, direction: number, progress: number): Keyframe[] {
  if (mode === "swipe") {
    return [
      { transform: `translate3d(${-direction * progress * SWIPE_FOLLOW_PX}px, 0, 0)`, opacity: 1 - fadeOf(progress) * .62 },
      { transform: `translate3d(${-direction * MOTION.swipe.exitPx}px, 0, 0)`, opacity: 0 },
    ];
  }
  return [
    { transform: `scale(${1 + direction * progress * PINCH_RANGE})`, opacity: 1 - fadeOf(progress) * .5 },
    { transform: `scale(${1 + direction * MOTION.pinch.exitScale})`, opacity: 0 },
  ];
}

function inFrames(mode: GestureMode, direction: number): Keyframe[] {
  if (mode === "swipe") {
    return [
      { transform: `translate3d(${direction * MOTION.swipe.enterPx}px, 0, 0)`, opacity: 0 },
      { transform: "translate3d(0, 0, 0)", opacity: 1 },
    ];
  }
  return [
    { transform: `scale(${1 - direction * MOTION.pinch.enterScale})`, opacity: 0 },
    { transform: "scale(1)", opacity: 1 },
  ];
}

/**
 * A lifeless copy of the page that is leaving. The real page changes at once, so the launcher never waits on an animation,
 * and the copy plays the exit while the new page arrives, which gives a true cross-zoom or cross-slide with no blank frame.
 *
 * The whole panel is copied, ids included, because the stylesheet is keyed by them (#grid, #apps-surface, ...). That is safe
 * because the copy is appended last: getElementById returns the first match, which is always the real page. The copy loses
 * the page-surface class so no query for the visible page can ever select it. For a swipe the copy's glass is hidden and it
 * serves only as the clipping frame, so the glass is never doubled.
 */
function makeGhost(panel: HTMLElement, mode: GestureMode): HTMLElement {
  const ghost = panel.cloneNode(true) as HTMLElement;
  ghost.classList.remove("page-surface");
  ghost.hidden = false;
  ghost.inert = true;
  ghost.setAttribute("aria-hidden", "true");
  ghost.dataset.gestureGhost = mode;
  for (const node of [ghost, ...ghost.querySelectorAll<HTMLElement>("[data-gesture-preview], [data-gesture-committing]")]) {
    delete node.dataset.gesturePreview;
    delete node.dataset.gestureMode;
    delete node.dataset.gestureCommitting;
  }
  return ghost;
}

/** Puts the ghost exactly where the leaving panel was, above the real page. */
function mountGhost(ghost: HTMLElement, box: DOMRect) {
  const shell = byId("shell");
  const shellBox = shell.getBoundingClientRect();
  Object.assign(ghost.style, {
    position: "absolute",
    margin: "0",
    left: `${box.left - shellBox.left - shell.clientLeft}px`,
    top: `${box.top - shellBox.top - shell.clientTop}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    zIndex: "3",
  });
  shell.append(ghost);
}

/**
 * Changes page with motion. `navigate` runs at once; the leaving content continues from where the preview left it as a ghost
 * while the new content arrives, both on live elements inside the same clipping panel. No View Transition is involved: its
 * snapshots clip differently from the page, and it can stall until the pointer moves.
 */
export async function playCommit(source: GestureSource, direction: number, mode: GestureMode, navigate: () => void) {
  endTransition();
  const outgoing = preview?.element ?? source.locate(mode);
  const startProgress = preview?.mode === mode ? preview.progress : 0;
  const current: Run = { animations: [], elements: [], ghost: null, navigating: false };
  run = current;
  document.body.classList.add("gesture-transitioning");
  const safety = window.setTimeout(() => finish(current), SAFETY_MS);

  try {
    const panel = source.panel();
    let ghost: HTMLElement | null = null;
    let box: DOMRect | null = null;
    if (outgoing && panel) {
      current.elements.push(outgoing);
      outgoing.dataset.gestureCommitting = ""; // no spring-back transition while the commit takes over
      clearPreview(true);
      box = panel.getBoundingClientRect(); // untransformed now that the preview is gone
      ghost = makeGhost(panel, mode);
    }
    const node = cue();
    if (!node.hidden) node.dataset.leaving = "true"; // the ghost of the destination fades as the real page arrives

    current.navigating = true;
    navigate();
    current.navigating = false;
    const incoming = source.locate(mode);

    if (ghost && box) {
      mountGhost(ghost, box);
      current.ghost = ghost;
      // A swipe moves only the content inside the ghost panel, which stays put as the clipping frame; a pinch moves the whole panel.
      const leaving = mode === "swipe" ? ghost.querySelector<HTMLElement>(".home-motion") : ghost;
      if (leaving) {
        leaving.dataset.gestureCommitting = "";
        current.animations.push(play(leaving, "gesture-out", outFrames(mode, direction, startProgress), { duration: MOTION[mode].outMs, easing: MOTION[mode].outEase, fill: "forwards" }));
      }
    }
    if (incoming) {
      current.elements.push(incoming);
      current.animations.push(play(incoming, "gesture-in", inFrames(mode, direction), { duration: MOTION[mode].inMs, delay: MOTION[mode].inDelayMs, easing: MOTION[mode].inEase, fill: "both" }));
    }
    await Promise.all(current.animations.map((animation) => animation.finished));
  } catch {
    // A newer navigation cancelled this one; it has already cleaned up.
  } finally {
    window.clearTimeout(safety);
    finish(current);
  }
}

function play(element: HTMLElement, id: string, keyframes: Keyframe[], timing: KeyframeAnimationOptions): Animation {
  const animation = element.animate(keyframes, timing);
  animation.id = id;
  return animation;
}

function finish(finished: Run) {
  finished.animations.forEach((animation) => animation.cancel());
  finished.animations = [];
  finished.ghost?.remove();
  finished.ghost = null;
  finished.elements.forEach((element) => delete element.dataset.gestureCommitting);
  if (run === finished) {
    run = null;
    document.body.classList.remove("gesture-transitioning");
    hideCue();
  }
}

/** Stops a commit in flight, for navigation that does not come from a gesture. The commit's own page change is left alone. */
export function endTransition() {
  if (run && !run.navigating) finish(run);
}
