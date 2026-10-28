import { el } from "./dom";

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function recentDays(count: number, today = new Date()): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - count + index + 1);
    return localDateKey(date);
  });
}
export function dailyChart(days: string[], values: Record<string, number>, title: string, format: (value: number) => string): HTMLElement {
  const maximum = Math.max(1, ...days.map(day => values[day] || 0));
  const caption = el("figcaption", "chart-caption", ["Select a day to see its total."]);
  const bars = el("div", "chart-bars"); bars.setAttribute("role", "group"); bars.setAttribute("aria-label", title);
  bars.style.setProperty("--chart-days", String(days.length));
  const table = el("table", "sr-only", [el("caption", "", [title])]);
  for (const [index, day] of days.entries()) {
    const date = new Date(`${day}T12:00:00`);
    const label = date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    const value = values[day] || 0;
    const bar = el("button", "chart-day", [el("span", "chart-bar"), el("span", "chart-day-label", [days.length <= 7 || index % 5 === 0 || index === days.length - 1 ? String(date.getDate()) : ""])]);
    bar.type = "button"; bar.title = `${label}: ${format(value)}`; bar.setAttribute("aria-label", bar.title);
    bar.style.setProperty("--bar-height", `${Math.max(value ? 3 : 0, value / maximum * 100)}%`);
    const inspect = () => { caption.textContent = `${label} · ${format(value)}`; };
    bar.addEventListener("focus", inspect); bar.addEventListener("pointerenter", inspect); bar.addEventListener("click", inspect);
    bars.append(bar); table.append(el("tr", "", [el("th", "", [label]), el("td", "", [format(value)])]));
  }
  return el("figure", "daily-chart", [el("h2", "chart-title", [title]), bars, caption, table]);
}
