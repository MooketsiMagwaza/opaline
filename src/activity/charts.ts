import { el } from "../core/dom";

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function recentDays(count: number, today = new Date()): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - count + index + 1);
    return localDateKey(date);
  });
}

/** A y-axis: where the top of the chart sits, the labelled ticks up to it, and how a tick is written. */
export type Axis = { top: number; ticks: number[]; label: (tick: number) => string };
const MAX_INTERVALS = 4;

/** Round steps, so the top tick sits just above the data and the axis never needs more than four intervals. */
function roundAxis(maximum: number, steps: number[], label: Axis["label"]): Axis {
  const step = steps.find(candidate => maximum / candidate <= MAX_INTERVALS) ?? steps[steps.length - 1];
  const top = Math.max(1, Math.ceil(maximum / step)) * step;
  return { top, ticks: Array.from({ length: top / step + 1 }, (_, index) => index * step), label };
}

const MINUTE = 60, HOUR = 3600;
export function timeAxis(maximumSeconds: number): Axis {
  const steps = [MINUTE, 5 * MINUTE, 10 * MINUTE, 15 * MINUTE, 30 * MINUTE, HOUR, 2 * HOUR, 3 * HOUR, 4 * HOUR, 6 * HOUR, 12 * HOUR];
  return roundAxis(maximumSeconds, steps, seconds => {
    if (seconds === 0) return "0";
    if (seconds < HOUR) return `${seconds / MINUTE}m`;
    const hours = seconds / HOUR;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
  });
}
export function countAxis(maximum: number): Axis {
  return roundAxis(maximum, [1, 2, 5, 10, 20, 50, 100], tick => String(tick));
}

export function dailyChart(days: string[], values: Record<string, number>, title: string, format: (value: number) => string, axisFor: (maximum: number) => Axis): HTMLElement {
  const axis = axisFor(Math.max(0, ...days.map(day => values[day] || 0)));
  const today = localDateKey();
  const caption = el("figcaption", "chart-caption", ["Select a day to see its total."]);
  const bars = el("div", "chart-bars"); bars.setAttribute("role", "group"); bars.setAttribute("aria-label", title);
  const table = el("table", "sr-only", [el("caption", "", [title])]);
  for (const [index, day] of days.entries()) {
    const date = new Date(`${day}T12:00:00`);
    const label = date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    const value = values[day] || 0;
    // A week names every weekday; a month labels every fifth day and each month's first, so the axis stays readable.
    const labelled = days.length <= 7 || index % 5 === 0 || index === days.length - 1 || date.getDate() === 1;
    const secondLine = days.length <= 7 ? date.toLocaleDateString(undefined, { weekday: "short" }) : date.getDate() === 1 || index === 0 ? date.toLocaleDateString(undefined, { month: "short" }) : "";
    const track = el("span", "chart-track", [el("span", "chart-bar")]);
    const dayLabel = el("span", "chart-day-label", labelled ? [el("span", "", [String(date.getDate())]), el("small", "", [secondLine])] : []);
    const bar = el("button", "chart-day", [track, dayLabel]);
    bar.type = "button"; bar.title = `${label}: ${format(value)}`; bar.setAttribute("aria-label", bar.title);
    if (day === today) bar.dataset.today = "true";
    bar.style.setProperty("--bar-height", `${Math.max(value ? 2 : 0, value / axis.top * 100)}%`);
    const inspect = () => { caption.textContent = `${label} · ${format(value)}`; };
    bar.addEventListener("focus", inspect); bar.addEventListener("pointerenter", inspect); bar.addEventListener("click", inspect);
    bars.append(bar); table.append(el("tr", "", [el("th", "", [label]), el("td", "", [format(value)])]));
  }
  bars.style.setProperty("--chart-days", String(days.length));

  // Both the labels and the faint rules are placed by the same tick values, so they cannot disagree.
  const labels = el("div", "chart-axis", [...axis.ticks].reverse().map(tick => el("span", "", [axis.label(tick)])));
  const rules = el("div", "chart-rules", axis.ticks.map(tick => { const rule = el("span"); rule.style.bottom = `${tick / axis.top * 100}%`; return rule; }));
  labels.setAttribute("aria-hidden", "true"); rules.setAttribute("aria-hidden", "true");
  const plot = el("div", "chart-plot", [labels, el("div", "chart-area", [rules, bars])]);
  plot.style.setProperty("--chart-days", String(days.length));
  return el("figure", "daily-chart", [el("h2", "chart-title", [title]), plot, caption, table]);
}
