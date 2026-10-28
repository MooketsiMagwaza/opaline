import { api, type UsageReport } from "./api";
import { byId, el } from "./dom";
import { dailyChart, recentDays } from "./charts";
import { iconElement } from "./icons";
import { showMenu } from "./menu";

const periods = { today: "Today", week: "Last 7 days", month: "Last 30 days", all: "All time" } as const;
let period: keyof typeof periods = "today";
let report: UsageReport | null = null;
let error = "";
let pending = false;
let query = "";
let selectedApp: string | null = null;

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)} sec`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  return `${Math.floor(seconds / 3600)} hr ${Math.floor(seconds % 3600 / 60)} min`;
}
export function setUsageQuery(value: string) { query = value; if (!byId("screen-time-surface").hidden) renderUsage(); }
export function renderUsage() {
  const days = recentDays(period === "month" ? 30 : 7);
  const entries = (report?.entries ?? []).filter(entry => entry.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const rows = entries.map(entry => ({ ...entry, seconds: period === "today" ? entry.todaySeconds : period === "all" ? entry.totalSeconds : days.reduce((sum, day) => sum + (entry.dailySeconds?.[day] || 0), 0) }))
    .sort((first, second) => second.seconds - first.seconds || first.name.localeCompare(second.name));
  const total = rows.reduce((sum, entry) => sum + entry.seconds, 0);
  byId("usage-total").textContent = formatDuration(total);
  byId("usage-status").textContent = error || report?.saveError || (report?.supported === false ? "Screen time is available on Windows." : report?.enabled === false ? "Tracking paused. Saved history is kept." : "Foreground, maximised time only. Your history stays on this device.");
  byId("usage-insights").replaceChildren(
    el("div", "insight", [el("span", "row-hint", ["Apps used"]), el("strong", "", [String(rows.filter(entry => entry.seconds > 0).length)])]),
    el("div", "insight", [el("span", "row-hint", ["Most used"]), el("strong", "", [rows[0]?.seconds ? rows[0].name : "—"])]),
    el("div", "insight", [el("span", "row-hint", ["Daily average · 7d"]), el("strong", "", [formatDuration(rows.reduce((sum, entry) => sum + recentDays(7).reduce((daily, day) => daily + (entry.dailySeconds?.[day] || 0), 0), 0) / 7)])]),
  );
  const chosen = entries.find(entry => entry.id === selectedApp);
  const daily: Record<string, number> = {};
  for (const entry of chosen ? [chosen] : entries) for (const [day, seconds] of Object.entries(entry.dailySeconds || {})) daily[day] = (daily[day] || 0) + seconds;
  byId("usage-chart").replaceChildren(dailyChart(days, daily, chosen ? `${chosen.name} · Daily activity` : "Daily activity", formatDuration));
  const clearSelection = byId<HTMLButtonElement>("usage-all-apps"); clearSelection.hidden = !chosen;
  const maximum = Math.max(1, ...rows.map(entry => entry.seconds));
  byId("usage-list").replaceChildren(...(rows.length ? rows.map(entry => {
    const meter = el("span", "usage-fill"); meter.style.setProperty("--usage", `${entry.seconds / maximum * 100}%`);
    const row = el("button", "usage-row", [iconElement(entry.path, entry.name), el("span", "app-list-name", [entry.name]), meter, el("strong", "usage-duration", [formatDuration(entry.seconds)])]);
    row.type = "button"; row.setAttribute("aria-label", `${entry.name}: ${formatDuration(entry.seconds)}. Show daily history.`);
    row.setAttribute("aria-pressed", String(selectedApp === entry.id));
    row.addEventListener("click", () => { selectedApp = selectedApp === entry.id ? null : entry.id; renderUsage(); });
    return row;
  }) : [el("p", "page-empty", [error ? "Try refreshing screen time." : report ? "No time recorded yet. Use a maximised app to begin." : "Loading screen time…"])]));
}
export async function refreshUsage() {
  if (pending) return;
  pending = true;
  try { report = await api.screenTime(); error = ""; }
  catch (failure) { error = `Screen time unavailable: ${String(failure)}`; }
  finally { pending = false; if (!byId("screen-time-surface").hidden) renderUsage(); }
}
export function initUsage() {
  byId("usage-refresh").addEventListener("click", () => void refreshUsage());
  byId("usage-all-apps").addEventListener("click", () => { selectedApp = null; renderUsage(); });
  byId("usage-period").addEventListener("click", () => {
    const rect = byId("usage-period").getBoundingClientRect();
    showMenu(rect.left, rect.bottom + 8, Object.entries(periods).map(([value, label]) => ({ label, checked: period === value, action: () => {
      period = value as keyof typeof periods; byId("usage-period").textContent = `${label} ▾`; renderUsage();
    } })));
  });
}
