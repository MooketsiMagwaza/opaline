import { api } from "./api";
import { byId } from "./dom";
import { dailyChart, localDateKey, recentDays } from "./charts";
import { onSettingsChange, settings } from "./settings";
import { newTimer, remainingTime, resetTimer, restoreTimer, settleTimer, toggleTimer, type TimerDurations, type TimerPhase } from "./timer";

const TIMER_KEY = "opaline.focus";
const phaseLabels: Record<TimerPhase, string> = { work: "Focus", "short-break": "Short break", "long-break": "Long break" };
const reminders = [
  "Make room for one thing at a time.", "A quiet beginning is still a beginning.", "You can take the next step without seeing the whole path.",
  "Let the task become smaller, not the day longer.", "Attention grows where you choose to place it.", "A pause can be part of the work.",
  "Finish one small thing with care.", "Leave space between the thought and the next action.", "Progress can be gentle and still be real.",
  "Return to what matters in this moment.", "The next useful step is enough for now.", "Give your eyes a horizon and your mind a little room.",
  "A clear surface can invite a clear thought.", "You do not have to carry every unfinished task at once.", "Rest is a rhythm, not a reward.",
  "Choose the pace you can return to tomorrow.", "Let a little silence do some of the work.", "Something simple, done well, is a good place to begin.",
  "Your attention is allowed to come back slowly.", "There is room to begin again.", "Take the time to notice what is already complete.",
  "Keep the next promise small enough to keep.", "A steady hour begins with a single minute.", "One thing finished leaves more room than many things hurried.",
];
const durations = (): TimerDurations => ({ work: settings().focusMinutes * 60000, "short-break": settings().shortBreakMinutes * 60000, "long-break": settings().longBreakMinutes * 60000 });
let timer = newTimer(durations());
try { timer = restoreTimer(JSON.parse(localStorage.getItem(TIMER_KEY) || "null"), durations()); } catch { /* Invalid timer state starts a fresh session, without changing usage data. */ }
let ambient: "zen" | "saver" | null = null;
let automaticSaver = false;
let returnFocus: HTMLElement | null = null;
let quoteIndex = 0;
let quotePaused = false;
let quoteChangedAt = Date.now();
let ambientOpenedAt = 0;
let message = "";

function persistTimer() {
  try { localStorage.setItem(TIMER_KEY, JSON.stringify(timer)); }
  catch (error) { message = `Timer cannot be saved: ${String(error)}`; }
}
function updateCompletion() {
  const next = settleTimer(timer, Date.now(), durations());
  if (next !== timer) { const workComplete = timer.phase === "work"; timer = next; message = workComplete ? "Focus complete. Take a break when you are ready." : "Break complete. Ready for another focus session?"; persistTimer(); refreshFocus(); }
}
function clockText(milliseconds: number): string {
  const seconds = Math.ceil(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function renderTimer() {
  const remaining = remainingTime(timer, Date.now());
  byId("focus-clock").textContent = clockText(remaining);
  byId("focus-phase").textContent = phaseLabels[timer.phase];
  byId("focus-progress").style.setProperty("--progress", String(1 - remaining / timer.durationMs));
  byId("focus-start").textContent = timer.endsAt === null ? "Start" : "Pause";
  byId("focus-note").textContent = message || "Stay with one task. Your next break will be ready when this session ends.";
  document.querySelectorAll<HTMLButtonElement>("[data-timer-phase]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.timerPhase === timer.phase)));
  byId("focus-completed").textContent = `${timer.dailySessions[localDateKey()] || 0} today · ${timer.completedSessions} completed`;
  if (ambient) byId("ambient-timer").textContent = timer.endsAt !== null ? `${phaseLabels[timer.phase]} · ${clockText(remaining)}` : "";
}
export function refreshFocus() {
  updateCompletion(); renderTimer();
  byId("focus-chart").replaceChildren(dailyChart(recentDays(7), timer.dailySessions, "Focus sessions this week", count => `${count} session${count === 1 ? "" : "s"}`));
}
function changeQuote(direction = 1) {
  quoteIndex = (quoteIndex + direction + reminders.length) % reminders.length;
  quoteChangedAt = Date.now();
  byId("zen-quote").textContent = reminders[quoteIndex];
  byId("zen-position").textContent = `Small reminders · ${quoteIndex + 1} / ${reminders.length}`;
}
export const isAmbientOpen = (): boolean => ambient !== null;
export function openAmbient(mode: "zen" | "saver", automatic = false) {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  ambient = mode; automaticSaver = automatic; ambientOpenedAt = Date.now(); quotePaused = false;
  const canvas = byId("ambient"); canvas.hidden = false; canvas.dataset.mode = mode;
  byId("ambient-title").textContent = mode === "zen" ? "A little room to think" : "Opaline";
  byId("zen-quote").textContent = reminders[quoteIndex];
  byId("zen-position").textContent = `Small reminders · ${quoteIndex + 1} / ${reminders.length}`;
  byId("zen-pause").textContent = "Pause quotes";
  quoteChangedAt = Date.now(); renderTimer();
  updateAmbientClock();
  byId("ambient-close").focus();
}
function updateAmbientClock() {
  const now = new Date();
  byId("ambient-clock").textContent = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  byId("ambient-date").textContent = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  byId("ambient-content").style.setProperty("--drift", `${Math.sin(Date.now() / 60000) * 18}px`);
}
export function closeAmbient(hideAutomatic = true) {
  if (!ambient) return;
  const hide = automaticSaver && hideAutomatic;
  ambient = null; automaticSaver = false; byId("ambient").hidden = true;
  if (hide) void api.hide();
  else if (returnFocus?.isConnected) returnFocus.focus();
}
export function handleFocusKey(event: KeyboardEvent): boolean {
  if (!ambient) return false;
  if (ambient === "saver" || event.key === "Escape") { event.preventDefault(); closeAmbient(); return true; }
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); changeQuote(event.key === "ArrowRight" ? 1 : -1); return true; }
  if (event.code === "Space" && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); quotePaused = !quotePaused; return true; }
  if (event.key === "Tab") {
    const controls = [...byId("ambient").querySelectorAll<HTMLButtonElement>("button")].filter(button => button.getClientRects().length);
    const index = controls.indexOf(document.activeElement as HTMLButtonElement);
    event.preventDefault(); controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
  }
  return true;
}
export function initFocus() {
  document.querySelectorAll<HTMLButtonElement>("[data-timer-phase]").forEach(button => button.addEventListener("click", () => { updateCompletion(); timer = resetTimer(timer, durations(), button.dataset.timerPhase as TimerPhase); message = ""; persistTimer(); refreshFocus(); }));
  byId("focus-start").addEventListener("click", () => { updateCompletion(); timer = toggleTimer(timer, Date.now()); message = ""; persistTimer(); renderTimer(); });
  byId("focus-reset").addEventListener("click", () => { timer = resetTimer(timer, durations()); message = "Session reset. Completed sessions are kept."; persistTimer(); refreshFocus(); });
  byId("focus-zen").addEventListener("click", () => openAmbient("zen"));
  byId("focus-saver").addEventListener("click", () => openAmbient("saver"));
  byId("ambient-close").addEventListener("click", () => closeAmbient());
  byId("zen-next").addEventListener("click", () => changeQuote());
  byId("zen-prev").addEventListener("click", () => changeQuote(-1));
  byId("zen-pause").addEventListener("click", () => { quotePaused = !quotePaused; byId("zen-pause").textContent = quotePaused ? "Resume quotes" : "Pause quotes"; });
  byId("ambient").addEventListener("pointermove", () => { if (ambient === "saver" && Date.now() - ambientOpenedAt > 1000) closeAmbient(); });
  let previousDurations = JSON.stringify(durations());
  onSettingsChange(() => { const nextDurations = JSON.stringify(durations()); if (timer.endsAt === null && nextDurations !== previousDurations) { timer = resetTimer(timer, durations()); persistTimer(); } previousDurations = nextDurations; if (!byId("focus-surface").hidden) refreshFocus(); });
  window.setInterval(() => {
    updateCompletion();
    if (!byId("focus-surface").hidden || ambient) renderTimer();
    if (ambient) {
      updateAmbientClock();
      if (ambient === "zen" && !quotePaused && Date.now() - quoteChangedAt >= settings().quoteIntervalSeconds * 1000) changeQuote();
    }
  }, 1000);
  refreshFocus();
}
