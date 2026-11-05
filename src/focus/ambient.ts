import { api } from "../core/api";
import { byId } from "../core/dom";
import { FOCUS_REMINDERS, SAVER_PROMPTS } from "./content";
import { settings } from "../settings/store";

type AmbientMode = "zen" | "saver";
type AmbientContext = { intention: string; timer: string };

let readContext: () => AmbientContext = () => ({ intention: "", timer: "" });
let ambient: AmbientMode | null = null;
let automaticSaver = false;
let returnFocus: HTMLElement | null = null;
let quoteIndex = 0;
let saverPromptIndex = 0;
let quotePaused = false;
let quoteChangedAt = Date.now();
let ambientOpenedAt = 0;

function setText(id: string, value: string) {
  const node = byId(id);
  if (node.textContent !== value) node.textContent = value;
}

function syncQuotePause() {
  setText("zen-pause", quotePaused ? "Resume reminders" : "Pause reminders");
}

function changeQuote(direction = 1) {
  quoteIndex = (quoteIndex + direction + FOCUS_REMINDERS.length) % FOCUS_REMINDERS.length;
  quoteChangedAt = Date.now();
  setText("zen-quote", FOCUS_REMINDERS[quoteIndex]);
  setText("zen-position", `Small reminders · ${quoteIndex + 1} / ${FOCUS_REMINDERS.length}`);
}

function updateClock() {
  const now = new Date();
  setText("ambient-clock", now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }));
  setText("ambient-date", now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }));
  const drift = settings().animations && !matchMedia("(prefers-reduced-motion: reduce)").matches ? Math.sin(Date.now() / 60000) * 18 : 0;
  byId("ambient-content").style.setProperty("--drift", `${drift}px`);
}

export const isAmbientOpen = (): boolean => ambient !== null;

export function openAmbient(mode: AmbientMode, automatic = false) {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  ambient = mode;
  automaticSaver = automatic;
  ambientOpenedAt = Date.now();
  quotePaused = false;
  const { intention, timer } = readContext();
  const canvas = byId("ambient");
  canvas.hidden = false;
  canvas.dataset.mode = mode;
  document.body.classList.add("ambient-open");
  setText("ambient-title", mode === "zen" ? "Immersive focus" : "Opaline");
  setText("zen-quote", mode === "saver" ? SAVER_PROMPTS[saverPromptIndex] : intention || FOCUS_REMINDERS[quoteIndex]);
  setText("zen-position", mode === "zen" && intention ? "Current intention" : `Small reminders · ${quoteIndex + 1} / ${FOCUS_REMINDERS.length}`);
  setText("ambient-timer", timer);
  syncQuotePause();
  quoteChangedAt = Date.now();
  updateClock();
  byId("ambient-close").focus();
}

export function closeAmbient(hideAutomatic = true) {
  if (!ambient) return;
  const hide = automaticSaver && hideAutomatic;
  ambient = null;
  automaticSaver = false;
  byId("ambient").hidden = true;
  document.body.classList.remove("ambient-open");
  if (hide) void api.hide();
  else if (returnFocus?.isConnected) returnFocus.focus();
}

export function handleFocusKey(event: KeyboardEvent): boolean {
  if (!ambient) return false;
  if (ambient === "saver" || event.key === "Escape") { event.preventDefault(); closeAmbient(); return true; }
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); changeQuote(event.key === "ArrowRight" ? 1 : -1); return true; }
  if (event.code === "Space" && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); quotePaused = !quotePaused; syncQuotePause(); return true; }
  if (event.key === "Tab") {
    const controls = [...byId("ambient").querySelectorAll<HTMLButtonElement>("button")].filter(button => button.getClientRects().length);
    const index = controls.indexOf(document.activeElement as HTMLButtonElement);
    event.preventDefault();
    controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
  }
  return true;
}

export function tickAmbient() {
  if (!ambient) return;
  updateClock();
  setText("ambient-timer", readContext().timer);
  if (ambient === "zen" && !quotePaused && Date.now() - quoteChangedAt >= settings().quoteIntervalSeconds * 1000) changeQuote();
  if (ambient === "saver" && Date.now() - quoteChangedAt >= settings().quoteIntervalSeconds * 1000) {
    saverPromptIndex = (saverPromptIndex + 1) % SAVER_PROMPTS.length;
    quoteChangedAt = Date.now();
    setText("zen-quote", SAVER_PROMPTS[saverPromptIndex]);
  }
}

export function initAmbient(context: () => AmbientContext) {
  readContext = context;
  byId("ambient-close").addEventListener("click", () => closeAmbient());
  byId("zen-next").addEventListener("click", () => changeQuote());
  byId("zen-prev").addEventListener("click", () => changeQuote(-1));
  byId("zen-pause").addEventListener("click", () => { quotePaused = !quotePaused; syncQuotePause(); });
  byId("ambient").addEventListener("pointermove", () => { if (ambient === "saver" && Date.now() - ambientOpenedAt > 1000) closeAmbient(); });
}
