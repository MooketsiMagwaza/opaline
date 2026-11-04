import { describe, expect, it } from "vitest";
import { localDateKey, recentDays } from "../src/activity/charts";
import { finishTimer, newTimer, remainingTime, restoreTimer, settleTimer, skipTimer, toggleTimer, type TimerDurations } from "../src/focus/timer";

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

  it("distinguishes finishing a session from skipping it", () => {
    const now = Date.parse("2026-11-02T09:00:00");
    const initial = newTimer(durations);
    const skipped = skipTimer(initial, now, durations);
    expect(skipped.phase).toBe("short-break");
    expect(skipped.completedSessions).toBe(0);
    expect(skipped.dailySessions).toEqual({});

    const finished = finishTimer(initial, now, durations);
    expect(finished.phase).toBe("short-break");
    expect(finished.completedSessions).toBe(1);
    expect(finished.dailySessions[localDateKey(new Date(now))]).toBe(1);
    expect(finishTimer(finished, now, durations).phase).toBe("work");
  });

  it("makes calendar days across month boundaries", () => {
    expect(recentDays(3, new Date("2026-11-01T12:00:00"))).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
  });
});
