# Activity / Screen time feature

Owns local usage-report presentation and reusable daily charts.

- `index.ts` loads `UsageReport`, filters it, computes summaries, renders app rows and exposes `initUsage`, `refreshUsage`, `renderUsage` and
  `setUsageQuery`.
- `charts.ts` contains local-date keys, recent-day ranges and the accessible daily bar-chart renderer. Focus reuses only these date/chart
  helpers; it does not depend on Screen time state.
- `activity.css` owns insights, charts, toolbars and usage rows.

```mermaid
flowchart LR
  Native[usage_report command] --> Refresh[refreshUsage]
  Refresh --> Report[in-memory UsageReport]
  Search[global search query] --> Render[renderUsage]
  Report --> Render
  Render --> Insights[summary cards]
  Render --> Chart[dailyChart]
  Render --> Rows[app usage rows]
  Rows --> Menu[period/detail menu]
```

The frontend does not infer activity by polling windows. Native collection and persistence policy stay behind `core/api.ts`; this feature
only renders the returned report. Refresh errors must preserve the last valid report and show status rather than clearing the page.

