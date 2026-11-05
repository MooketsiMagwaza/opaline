import { byId } from "../core/dom";
import { countAxis, dailyChart, localDateKey, recentDays } from "../activity/charts";
import { PHASE_LABELS } from "./content";
import { onSettingsChange, settings, updateSettings } from "../settings/store";
import { closeAmbient, handleFocusKey, initAmbient, isAmbientOpen, openAmbient, tickAmbient } from "./ambient";
import {
  finishTimer,
  hasStarted,
  newTimer,
  remainingTime,
  resetTimer,
  restoreTimer,
  settleTimer,
  skipTimer,
  toggleTimer,
  type TimerDurations,
  type TimerPhase,
} from "./timer";

const TIMER_KEY = "opaline.focus";
const INTENTION_KEY = "opaline.focus.intention";
const durations = (): TimerDurations => ({ work: settings().focusMinutes * 60000, "short-break": settings().shortBreakMinutes * 60000, "long-break": settings().longBreakMinutes * 60000 });

let timer = newTimer(durations());
try { timer = restoreTimer(JSON.parse(localStorage.getItem(TIMER_KEY) || "null"), durations()); } catch { /* Invalid timer state starts fresh. */ }
let intention = "";
try { intention = (localStorage.getItem(INTENTION_KEY) || "").slice(0, 100); } catch { /* The intention remains session-only. */ }
let intentionSaveTimer: number | undefined;
let advanceConfirmUntil = 0;
let message = "";
let openFocusPage = () => {};

function setText(id: string, value: string) {
  const node = byId(id);
  if (node.textContent !== value) node.textContent = value;
}

function persistTimer() {
  try { localStorage.setItem(TIMER_KEY, JSON.stringify(timer)); }
  catch (error) { message = `Timer cannot be saved: ${String(error)}`; }
}

function persistIntentionSoon() {
  window.clearTimeout(intentionSaveTimer);
  intentionSaveTimer = window.setTimeout(() => {
    try { localStorage.setItem(INTENTION_KEY, intention); }
    catch (error) { message = `Intention cannot be saved: ${String(error)}`; renderTimer(); }
  }, 220);
}

function updateCompletion() {
  const next = settleTimer(timer, Date.now(), durations());
  if (next === timer) return;
  const workComplete = timer.phase === "work";
  timer = next;
  message = workComplete ? "Focus complete. Your break is ready when you are." : "Break complete. Ready for another clear session?";
  persistTimer();
  refreshFocus();
}

function clockText(milliseconds: number): string {
  const seconds = Math.ceil(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function defaultNote(started: boolean): string {
  if (timer.phase !== "work") return started ? "Let the break be a real pause. Focus will wait." : "Step away for a moment, then begin again deliberately.";
  return started ? "Stay with this session. Everything else can wait a little." : "Choose one useful outcome, then let the timer hold the boundary.";
}

function renderTimer() {
  const now = Date.now();
  const remaining = remainingTime(timer, now);
  const running = timer.endsAt !== null;
  const started = hasStarted(timer, now);
  const paused = !running && started;
  const clock = clockText(remaining);
  const today = timer.dailySessions[localDateKey()] || 0;
  const progress = timer.durationMs > 0 ? 1 - remaining / timer.durationMs : 0;
  const progressNode = byId("focus-progress");
  const progressValue = String(Math.max(0, Math.min(1, progress)));
  if (progressNode.style.getPropertyValue("--progress") !== progressValue) progressNode.style.setProperty("--progress", progressValue);

  setText("focus-clock", clock);
  setText("focus-phase", PHASE_LABELS[timer.phase]);
  setText("focus-state", running ? "In progress" : paused ? "Paused" : "Ready when you are");
  setText("focus-start", running ? "Pause" : paused ? "Resume" : "Start");
  setText("focus-title", intention || (timer.phase === "work" ? "Make room for one clear task." : "Give the pause your full attention."));
  setText("focus-note", message || defaultNote(started));
  setText("focus-completed", `${today} today · ${timer.completedSessions} completed`);
  setText("focus-today", String(today));
  setText("focus-total", String(timer.completedSessions));

  const nextIsLong = (timer.completedSessions + 1) % 4 === 0;
  setText("focus-next", timer.phase === "work" ? nextIsLong ? "Long" : "Short" : "Focus");
  setText("focus-next-kind", timer.phase === "work" ? "break" : "session");
  setText("focus-advance", now < advanceConfirmUntil ? "Confirm finish" : timer.phase === "work" ? "Finish session" : "Skip break");
  // A session that was never started has nothing to finish; skipping a break is always available.
  byId<HTMLButtonElement>("focus-advance").disabled = timer.phase === "work" && !started;

  document.querySelectorAll<HTMLButtonElement>("[data-timer-phase]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.timerPhase === timer.phase)));
  document.querySelectorAll<HTMLButtonElement>("[data-focus-preset]").forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.focusPreset) === settings().focusMinutes)));
  const custom = byId<HTMLInputElement>("focus-custom-minutes");
  if (document.activeElement !== custom) custom.value = String(settings().focusMinutes);

  const capsule = byId<HTMLButtonElement>("focus-capsule");
  capsule.hidden = !started;
  if (started) {
    setText("focus-capsule-phase", running ? PHASE_LABELS[timer.phase] : `${PHASE_LABELS[timer.phase]} paused`);
    setText("focus-capsule-clock", clock);
    capsule.setAttribute("aria-label", `${PHASE_LABELS[timer.phase]} ${paused ? "paused with" : "has"} ${clock} remaining. Open Focus.`);
  }
}

export function refreshFocus() {
  updateCompletion();
  renderTimer();
  byId("focus-chart").replaceChildren(dailyChart(recentDays(7), timer.dailySessions, "Focus sessions this week", count => `${count} session${count === 1 ? "" : "s"}`, countAxis));
}

function toggleCurrentTimer() {
  updateCompletion();
  timer = toggleTimer(timer, Date.now());
  message = "";
  advanceConfirmUntil = 0;
  persistTimer();
  renderTimer();
}

/** Controls that activate on Space themselves; taking the key would make them unusable from the keyboard. */
const ACTIVATES_ON_SPACE = "button, a[href], summary, select, [role='button'], [role='switch'], [role='tab']";

export function handleFocusPageKey(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement;
  const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
  const activatesOnSpace = target instanceof Element && target.closest(ACTIVATES_ON_SPACE) !== null;
  if (byId("focus-surface").hidden || event.code !== "Space" || editing || activatesOnSpace || event.ctrlKey || event.altKey || event.metaKey) return false;
  event.preventDefault();
  if (!event.repeat) toggleCurrentTimer();
  return true;
}

function advancePhase() {
  updateCompletion();
  const now = Date.now();
  if (timer.phase === "work" && !hasStarted(timer, now)) return;
  if (timer.phase === "work" && now >= advanceConfirmUntil) {
    advanceConfirmUntil = now + 3000;
    message = "Finish this session now and count it as completed?";
    renderTimer();
    window.setTimeout(() => { if (Date.now() >= advanceConfirmUntil) { advanceConfirmUntil = 0; renderTimer(); } }, 3050);
    return;
  }
  timer = timer.phase === "work" ? finishTimer(timer, now, durations()) : skipTimer(timer, now, durations());
  message = timer.phase === "work" ? "Break skipped. Choose the next clear task when you are ready." : "Session completed. Your break is ready when you are.";
  advanceConfirmUntil = 0;
  persistTimer();
  refreshFocus();
}

export function initFocus(showFocus: () => void = () => {}) {
  openFocusPage = showFocus;
  initAmbient(() => {
    const now = Date.now();
    const remaining = remainingTime(timer, now);
    return {
      intention,
      timer: hasStarted(timer, now) ? `${PHASE_LABELS[timer.phase]} · ${clockText(remaining)}` : "",
    };
  });
  const intentionInput = byId<HTMLInputElement>("focus-intention");
  intentionInput.value = intention;
  intentionInput.addEventListener("input", () => {
    intention = intentionInput.value.slice(0, 100);
    persistIntentionSoon();
    renderTimer();
  });
  byId("focus-intention-clear").addEventListener("click", () => {
    intention = "";
    intentionInput.value = "";
    persistIntentionSoon();
    renderTimer();
    intentionInput.focus();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-timer-phase]").forEach(button => button.addEventListener("click", () => {
    updateCompletion();
    timer = resetTimer(timer, durations(), button.dataset.timerPhase as TimerPhase);
    message = "";
    advanceConfirmUntil = 0;
    persistTimer();
    refreshFocus();
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-focus-preset]").forEach(button => button.addEventListener("click", () => {
    updateSettings({ focusMinutes: Number(button.dataset.focusPreset) });
  }));
  byId<HTMLInputElement>("focus-custom-minutes").addEventListener("change", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    updateSettings({ focusMinutes: Math.max(1, Math.min(90, Number(input.value) || settings().focusMinutes)) });
  });
  const preferenceInputs = {
    shortBreakMinutes: byId<HTMLInputElement>("focus-short-break"),
    longBreakMinutes: byId<HTMLInputElement>("focus-long-break"),
    quoteIntervalSeconds: byId<HTMLInputElement>("focus-quote-interval"),
    screenSaverIdleMinutes: byId<HTMLInputElement>("focus-saver-idle"),
  } as const;
  const preferenceRanges = {
    shortBreakMinutes: [1, 30], longBreakMinutes: [5, 60], quoteIntervalSeconds: [5, 120], screenSaverIdleMinutes: [1, 60],
  } as const;
  const saverEnabled = byId<HTMLInputElement>("focus-saver-enabled");
  const syncPreferences = () => {
    const current = settings();
    for (const [key, input] of Object.entries(preferenceInputs) as [keyof typeof preferenceInputs, HTMLInputElement][]) {
      if (document.activeElement !== input) input.value = String(current[key]);
    }
    saverEnabled.checked = current.screenSaverEnabled;
    byId<HTMLInputElement>("focus-saver-idle").disabled = !current.screenSaverEnabled;
  };
  for (const [key, input] of Object.entries(preferenceInputs) as [keyof typeof preferenceInputs, HTMLInputElement][]) {
    input.addEventListener("change", () => {
      const [min, max] = preferenceRanges[key];
      const value = Math.min(max, Math.max(min, Number(input.value) || settings()[key]));
      updateSettings({ [key]: value });
    });
  }
  saverEnabled.addEventListener("change", () => updateSettings({ screenSaverEnabled: saverEnabled.checked }));
  syncPreferences();
  byId("focus-start").addEventListener("click", toggleCurrentTimer);
  byId("focus-advance").addEventListener("click", advancePhase);
  byId("focus-reset").addEventListener("click", () => {
    timer = resetTimer(timer, durations());
    message = "Session reset. Completed sessions are kept.";
    advanceConfirmUntil = 0;
    persistTimer();
    refreshFocus();
  });
  byId("focus-capsule").addEventListener("click", () => openFocusPage());
  byId("focus-zen").addEventListener("click", () => openAmbient("zen"));
  byId("focus-saver").addEventListener("click", () => openAmbient("saver"));

  let previousDurations = JSON.stringify(durations());
  onSettingsChange(() => {
    const nextDurations = JSON.stringify(durations());
    if (timer.endsAt === null && timer.remainingMs === timer.durationMs && nextDurations !== previousDurations) {
      timer = resetTimer(timer, durations());
      persistTimer();
    }
    previousDurations = nextDurations;
    syncPreferences();
    if (!byId("focus-surface").hidden) refreshFocus();
    else renderTimer();
  });

  window.setInterval(() => {
    const focusVisible = !byId("focus-surface").hidden;
    const ambientOpen = isAmbientOpen();
    if (timer.endsAt !== null || focusVisible || ambientOpen) updateCompletion();
    if (focusVisible || ambientOpen || !byId("focus-capsule").hidden) renderTimer();
    if (ambientOpen) tickAmbient();
  }, 1000);
  refreshFocus();
}

export { closeAmbient, handleFocusKey, isAmbientOpen, openAmbient };
