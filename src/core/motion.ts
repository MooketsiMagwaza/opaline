/** Whether motion may play at all: the Animations setting is on and the system has not asked for reduced motion. */
export const motionAllowed = (): boolean => document.body.dataset.anim !== "false" && !matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Whether pages and sections should ease in: motion is allowed and the Fade between pages setting is on. */
export const fadesEnabled = (): boolean => document.body.dataset.pageFade === "true" && motionAllowed();

/**
 * Eases an element in (a short fade and rise) instead of letting it appear at once. The animation only paints its starting frame
 * and then lets go, so it never leaves a transform behind to fight the gesture preview or a later transition.
 */
export function fadeIn(element: HTMLElement) {
  if (!fadesEnabled()) return;
  element.classList.remove("fade-in");
  void element.offsetWidth; // restart the animation when the same element is shown again straight away
  element.classList.add("fade-in");
  const done = (event: AnimationEvent) => {
    if (event.target !== element || event.animationName !== "fade-in") return; // a child's animation is not ours
    element.classList.remove("fade-in");
    element.removeEventListener("animationend", done);
  };
  element.addEventListener("animationend", done);
}
