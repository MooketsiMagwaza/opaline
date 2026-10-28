import { describe, expect, it } from "vitest";
import { localDateKey, recentDays } from "../src/charts";
import { newTimer, remainingTime, restoreTimer, settleTimer, toggleTimer, type TimerDurations } from "../src/timer";

const durations: TimerDurations = { work: 25 * 60000, "short-break": 5 * 60000, "long-break": 15 * 60000 };

describe("focus timer", () => {
  it("uses a deadline so a hidden window does not pause the session", () => {
    const start = Date.parse("2026-10-28T09:00:00");
    const running = toggleTimer(newTimer(durations), start);
    expect(remainingTime(running, start + 10 * 60000)).toBe(15 * 60000);
    const paused = toggleTimer(running, start + 10 * 60000);
    expect(remainingTime(paused, start + 60 * 60000)).toBe(15 * 60000);
    expect(restoreTimer(JSON.parse(JSON.stringify(paused)), durations)).toEqual(paused);
  });

  it("records completed focus sessions and offers a long break after four", () => {
    const start = Date.parse("2026-10-28T09:00:00");
    let state = newTimer(durations);
    for (let index = 0; index < 4; index++) {
      state = settleTimer(toggleTimer({ ...state, phase: "work", durationMs: durations.work, remainingMs: durations.work }, start), start + durations.work, durations);
    }
    expect(state.phase).toBe("long-break");
    expect(state.completedSessions).toBe(4);
    expect(state.dailySessions[localDateKey(new Date(start))]).toBe(4);
  });

  it("makes calendar days across month boundaries", () => {
    expect(recentDays(3, new Date("2026-11-01T12:00:00"))).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
  });
});
