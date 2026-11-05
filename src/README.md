# Frontend architecture

Opaline is a framework-free TypeScript frontend organised by runtime ownership. The `src` root intentionally contains no runtime modules:
every implementation belongs to the application composition layer, shared core, or one feature folder.

## Directory map

| Folder | Owns | May depend on |
| --- | --- | --- |
| `app/` | boot, overlay lifecycle, global input and shared shell CSS | every feature and `core/` |
| `core/` | typed Tauri boundary, DOM helpers, icons, menus, hover intent, motion rules and the light-bending glass lens (refraction physics plus its SVG filter) | Tauri API; `settings/store.ts` only for glass and motion parameters |
| `data/` | static typed product data shared across features (the shortcut and help list) | nothing |
| `appearance/` | built-in material presets, backgrounds and versioned user visual profiles | settings types |
| `activity/` | screen-time loading, filtering, charts and duration formatting | core only |
| `focus/` | timer state machine, Focus page, ambient/quiet modes and CSS | core, activity date helpers, settings |
| `grid/` | Home tiles, panes, groups, workspaces, organisation, drag/drop and peeks | core and settings |
| `navigation/` | top-level pages, Home-screen routing, the destination tray, swipe/pinch recognition and motion, and navigation CSS | grid, activity, focus and settings adapters |
| `settings/` | validated settings store, staged draft, the six-section Settings panel (expandable to the window), live launcher simulation, Shortcuts & help and settings CSS | feature public APIs, `data/` |
| `taskbar/` | running/pinned app rail on any screen edge, thumbnail cache, hover preview lifecycle and placement CSS | core, settings and navigation |

## Dependency graph

```mermaid
flowchart LR
  HTML[index.html] --> APP[app/launcher]
  APP --> NAV[navigation]
  APP --> GRID[grid]
  APP --> SET[settings]
  APP --> FOCUS[focus]
  APP --> BAR[taskbar]
  NAV --> GRID
  NAV --> ACT[activity]
  NAV --> FOCUS
  NAV --> SET
  SET --> APPEAR[appearance]
  SET --> GRID
  SET --> ACT
  BAR --> NAV
  GRID --> CORE[core]
  ACT --> CORE
  FOCUS --> CORE
  SET --> CORE
  BAR --> CORE
  CORE --> TAURI[Tauri invoke/event API]
```

Feature modules must not import `app/`. Cross-feature calls use the owning feature's public exports; native commands go through
`core/api.ts`. CSS follows the same ownership rule: feature selectors live beside the feature, while only shell geometry and shared tokens
remain in `app/launcher.css`.

## Startup and state flow

```mermaid
sequenceDiagram
  participant DOM as index.html
  participant App as app/launcher.ts
  participant Store as settings/store.ts
  participant Native as core/api.ts
  participant Features as feature initialisers
  DOM->>App: module load
  App->>Store: applySettings()
  App->>Features: initialise controllers
  App->>Native: status + cached data requests
  Native-->>App: items, apps, rail and backdrop
  App->>Features: distribute typed results
  Features-->>DOM: render owned surfaces
  App->>Native: listen for show/hide and system events
```

## State ownership rules

- Persisted visual and behaviour settings live only in `settings/store.ts`.
- Pane membership, launch counts and manual Home positions live in `grid/groups.ts`.
- Named Home screens live in `grid/workspaces.ts`.
- Timer transitions stay pure in `focus/timer.ts`; DOM orchestration belongs in `focus/index.ts`.
- Settings edits are drafts until Done (`settings/draft.ts`); Cancel restores the saved values, and both buttons are disabled while nothing is staged. Hotkey and launch-at-login operations, and the Settings expand button, are explicit immediate actions.
- Whether motion may play (Animations, Fade between pages, reduced motion) is decided in one place, `core/motion.ts`.
- Backdrop pixels and window thumbnails are memory-only and are never included in exported visual profiles.

## Verification map

- `npm test` (64 Vitest tests in `tests/`) covers pure timer, settings normalisation and drafts, pane/group persistence, workspaces, organisation rules, drop geometry, chart axes, hover intent, refraction and user presets.
- `npm run build` type-checks every ownership boundary and produces the Vite bundle; `npm run size` then enforces the 220 KiB raw / 62 KiB gzip budgets.
- `scripts/verify-ui.mjs` drives the actual frontend with isolated native fixtures, including staged settings, live simulations, gesture tails, the taskbar on every edge and page fades.
- Rust tests and `scripts/verify-native.mjs` cover the native command boundary separately.

Each feature README documents its public API, internal data flow, invariants and extension points. Native architecture and performance budgets
remain in `docs/ARCHITECTURE.md`.
