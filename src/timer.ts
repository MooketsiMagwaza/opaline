import { localDateKey } from "./charts";

export type TimerPhase = "work" | "short-break" | "long-break";
export type TimerDurations = Record<TimerPhase, number>;
export type TimerState = { phase: TimerPhase; durationMs: number; remainingMs: number; endsAt: number | null; completedSessions: number; dailySessions: Record<string, number> };
export function newTimer(durations: TimerDurations, phase: TimerPhase = "work"): TimerState {
  return { phase, durationMs: durations[phase], remainingMs: durations[phase], endsAt: null, completedSessions: 0, dailySessions: {} };
}
export function restoreTimer(value: unknown, durations: TimerDurations): TimerState {
  const fresh = newTimer(durations);
  if (!value || typeof value !== "object") return fresh;
  const saved = value as Partial<TimerState>;
  if (!["work", "short-break", "long-break"].includes(saved.phase || "")) return fresh;
  if (!Number.isFinite(saved.durationMs) || !Number.isFinite(saved.remainingMs)) return fresh;
  return { ...fresh, phase: saved.phase!, durationMs: Math.max(60000, Math.min(5400000, saved.durationMs!)), remainingMs: Math.max(0, Math.min(saved.durationMs!, saved.remainingMs!)), endsAt: typeof saved.endsAt === "number" && Number.isFinite(saved.endsAt) ? saved.endsAt : null, completedSessions: Math.max(0, Math.floor(Number(saved.completedSessions) || 0)), dailySessions: Object.fromEntries(Object.entries(saved.dailySessions || {}).filter(([day, count]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isInteger(count) && count >= 0).slice(-90)) };
}
export const remainingTime = (state: TimerState, now: number): number => state.endsAt === null ? state.remainingMs : Math.max(0, Math.min(state.durationMs, state.endsAt - now));
export function settleTimer(state: TimerState, now: number, durations: TimerDurations): TimerState {
  if (state.endsAt === null || now < state.endsAt) return state;
  const completedWork = state.phase === "work";
  const completedSessions = state.completedSessions + Number(completedWork);
  const dailySessions = { ...state.dailySessions };
  if (completedWork) { const day = localDateKey(new Date(state.endsAt)); dailySessions[day] = (dailySessions[day] || 0) + 1; }
  for (const day of Object.keys(dailySessions).sort().slice(0, -90)) delete dailySessions[day];
  const phase: TimerPhase = completedWork ? completedSessions % 4 === 0 ? "long-break" : "short-break" : "work";
  return { phase, durationMs: durations[phase], remainingMs: durations[phase], endsAt: null, completedSessions, dailySessions };
}
export function toggleTimer(state: TimerState, now: number): TimerState {
  return state.endsAt === null ? { ...state, endsAt: now + state.remainingMs } : { ...state, remainingMs: remainingTime(state, now), endsAt: null };
}
export function resetTimer(state: TimerState, durations: TimerDurations, phase = state.phase): TimerState {
  return { ...state, phase, durationMs: durations[phase], remainingMs: durations[phase], endsAt: null };
}
