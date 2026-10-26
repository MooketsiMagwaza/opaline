# Opaline — Work Order

The single source of truth for what Opaline must do, how it is built, what has actually been checked, and what comes next.
Everything in the original brief is traceable to a requirement ID (`R-xx`). Pull requests and commits should reference the IDs
they touch.

**Release in progress:** `0.1.0` · codename **Annealed** (see [docs/NAMING.md](docs/NAMING.md))
**Platforms:** Windows 11 first. Linux is a planned port (R-17); platform-specific code stays behind `cfg(windows)`.
**Last updated:** 2026-10-26 — work paused after the first end-to-end run (see §0).

**Status legend** — `[x]` verified working on a real machine (how is noted) · `[~]` implemented, not yet verified or only partly
verified · `[ ]` not started. **Priority:** P0 ships in 0.1.0 · P1 next · P2 later. Mark `[x]` only for things you have seen work.

---

## 0. Status at pause

The app **builds and runs**. It was started with `npm run tauri dev`, and its page was driven and screenshotted through
WebView2's local debugging port (`scripts/cdp.mjs`, see [docs/TESTING.md](docs/TESTING.md)) on the target laptop
(Windows 11, Intel Iris Xe, 1920×1200 at 150 % scaling).

**Seen working**

- Full-screen overlay opens with a snapshot of the screen as a blurred, tinted backdrop; no flash of an empty window.
- All 45 Desktop items (user + shared Desktop) listed with their **real icons**, including `.lnk` shortcuts, folders and an `.exe`.
- First-run **auto-organise** produced 12 panes (IDEs, AI & code agents, Dev tools, Browsers, Chat, Creative, Notes & planning,
  Games & music, Utilities, University, Code projects, Archive) and left 8 items loose, exactly as the rules in §6 intend.
- **Pane popup** opens from its tile with the pane's name and members; **Esc** closes it.
- Liquid-glass styling: search pill, buttons, popup, rail, settings pane and context menu all render with blur, specular rim and the
  lens filter (`backdrop-filter: blur() url(#lens-n)` confirmed in computed style, 8 filters generated).
- **Settings pane** opens with its six sections (Glass, Layout, Rail, Behaviour, Panes, About) and live values.
- **Context menu** renders with Open / Open file location / Copy path / Add to pane ▸.
- **Search** filters the grid ("dis" → Discord).
- **Rail** lists the pinned File Explorer entry and the running Claude window with a running dot; hovering opens the preview card.
- UI type-checks (`tsc --noEmit` clean); Rust compiles with no errors.
- The logo rasterises and the full icon set is generated from it (`npm run icons`).

**Not yet verified** (do these first — §12 step 2)

- The **hotkey** itself: the overlay was always opened by the app's own start-up path or a second launch, never by pressing Ctrl+Alt+Space.
- Closing the whole overlay with **Esc**, **click on empty space**, **focus loss** and the hotkey (development runs used pinned mode).
- **Drag and drop**, **rename persistence**, **ungroup**, **remove from pane**, and that `groups.json` is written and survives a restart.
- **Settings persistence** and the live effect of each control; **Frost** and **Clear** styles; behaviour on a bright wallpaper.
- Hotkey **rebinding**, **launch at login**, **tray icon**, **single-instance** wake-up.
- **Rail**: click to focus/launch, magnification, thumbnails after the optimisation below, and whether the list matches the real taskbar
  (only two entries appeared; Windows 11 stores some pins in the registry rather than as shortcuts — see §13).
- **Performance**: time from hotkey to visible, idle memory, scrolling smoothness.
- `cargo fmt`, `cargo clippy`, release build, and CI have not been run.

**Changed after the last visual check (unverified):** dependencies are now optimised in dev builds (`[profile.dev.package."*"]`),
and the rail pre-loads window thumbnails when the overlay opens. The first thumbnail took ~800 ms before this.

## 1. Objective

A frosted, liquid-glass desktop launcher. Press **Ctrl+Alt+Space** and a full-screen overlay appears over a blurred, tinted
snapshot of whatever is on screen. On it:

- every item from your Desktop folders, as glass tiles with their real icons;
- named **panes** (groups) like Start-menu or iPad folders, organised automatically and editable by hand;
- a search bar that finds anything instantly;
- a **rail** on the edge that mirrors the taskbar (pinned and running apps) and shows window previews on hover;
- a settings pane controlling every parameter of the glass.

Desktop icons stay hidden in Explorer. The files stay in the Desktop folder. **Opaline only reads them.**

## 2. Brief → requirements

| ID | Requirement | Pri | Status | Notes |
|----|-------------|-----|--------|-------|
| R-01 | **Ctrl+Alt+Space** toggles the launcher; the combo is rebindable in settings | P0 | `[~]` | Registered at start-up (status reported OK); toggling and rebinding not exercised |
| R-02 | Items come straight from the Desktop folders (user + shared, OneDrive-aware); files are never moved, renamed or deleted | P0 | `[x]` | 45 items incl. shared desktop; read-only by construction. OneDrive-redirected desktop untested |
| R-03 | Real icons for `.lnk`, `.exe`, folders, documents | P0 | `[x]` | All 45 shown on one cold start. Ten-cycle repeatability not yet checked |
| R-04 | Search: instant, ranked, Enter launches the top hit, arrows navigate, typing anywhere searches | P0 | `[~]` | Filtering seen; Enter / arrows / type-anywhere not exercised |
| R-05 | Panes: drag a tile onto another to make one, onto a pane to add, click to open the popup grid | P0 | `[~]` | Panes + popup seen; drag and drop not exercised |
| R-06 | Pane naming: rename in place; names persist; new panes open into rename | P0 | `[~]` | Name field renders; rename + persistence not exercised |
| R-07 | Auto-organise (IDEs, AI & code agents, dev tools, …), done for the user on first run, re-runnable | P0 | `[x]` | First run verified (12 panes). "Organise now" button not exercised |
| R-08 | Liquid-glass look: blurred, frosted backdrop still recognisable; lens refraction + specular rims | P0 | `[~]` | Looks right on a dark backdrop; tune on a bright wallpaper; check GPU cost |
| R-09 | Works over a transparent desktop / live wallpaper (snapshot of what is on screen) | P0 | `[~]` | Snapshot path works; not tried with a live wallpaper running |
| R-10 | Closes on **Esc**, empty-space click, focus loss, and the hotkey | P0 | `[~]` | Esc closes the pane popup; whole-overlay close paths not exercised |
| R-11 | Settings pane: every glass parameter, layout, behaviour, hotkey, launch at login, about | P0 | `[~]` | Renders with all sections; per-control effect and persistence not exercised |
| R-12 | Rename / ungroup / remove / add to pane via right-click as well as dragging | P0 | `[~]` | Menu renders; actions not exercised |
| R-13 | **Rail**: vertical taskbar mirror (pinned + running); click focuses or launches | P0 | `[~]` | Renders; click, completeness vs real taskbar not verified |
| R-14 | Rail hover previews with thumbnails, click to focus, dock-style magnification | P0 | `[~]` | Card opens; thumbnail load time re-test needed; magnify not exercised |
| R-15 | Identity & repo: logo, naming, README, contributing, license, changelog, CI, templates | P0 | `[~]` | All written, logo + icons generated; CI never run; placeholders remain (§15) |
| R-16 | Convenience: usage ordering, open file location, copy path, tray, launch at login | P0 | `[~]` | Implemented; none exercised |
| R-17 | Linux port later | P2 | `[ ]` | Non-Windows stubs compile in principle; never built |
| R-18 | WinUI 3 attempt logged as a failed beta, source archived | P0 | `[x]` | `DEVLOG.md`, `archive/winui3-beta/` |
| R-19 | Live wallpaper and taskbar transparency are external tools; document compatibility | P0 | `[~]` | Documented in README; not tested with either tool |

## 3. Architecture

```
┌─ Rust (src-tauri/src) ───────────────────────────┐   ┌─ UI (src/, TypeScript + CSS) ─────────────┐
│ lib.rs      hotkey · tray · window lifecycle ·    │   │ launcher.ts  open/close, keyboard, wiring │
│             commands                              │   │ grid.ts      tiles, panes, popup, drag    │
│ capture.rs  screen snapshot, window thumbnails    │◄─►│ rail.ts      taskbar strip + previews     │
│ desktop.rs  scan Desktop folders                  │   │ panel.ts     settings pane                │
│ icons.rs    one STA worker, shell icons → PNG     │   │ groups.ts / organize.ts  panes + rules    │
│ taskbar.rs  running windows + pinned items        │   │ settings.ts  settings state → CSS vars    │
│ store.rs    groups.json / config.json             │   │ glass.ts     lens (SVG displacement maps) │
└───────────────────────────────────────────────────┘   │ menu.ts · icons.ts · api.ts · dom.ts      │
                                                        └───────────────────────────────────────────┘
```

**Show sequence** (why there is no OS blur material any more):

1. Hotkey → Rust captures the monitor under the cursor *before* the window is on screen and downsamples it to a JPEG.
2. Rust fits the hidden window to that monitor (borderless full-screen) and emits `launcher-prepare { snapshot }`.
3. The UI sets the backdrop, waits for it to decode, loads items and the rail, then calls `present`.
4. Rust shows and focuses the window; the UI transitions the stage in.

If the UI never answers, Rust presents anyway after 900 ms. On first launch the overlay opens when the UI calls `ready`.
The snapshot is a still image, so a live wallpaper is frozen while the overlay is open — a deliberate trade for full control of
blur, tint and lensing.

**Rules:** no network access · Desktop files are read-only to Opaline (panes are metadata) · anything platform-specific is behind
`cfg(windows)` with a harmless non-Windows branch · shell icon calls only ever go through the single icon worker.

**CSS fact that cost time:** `backdrop-filter` only sees content inside the nearest "backdrop root" ancestor — any ancestor with
`filter`, `mask`, `opacity < 1`, `clip-path` or its own `backdrop-filter`. Glass panes must therefore be children of `#shell` /
`.stage` and never inside the masked `#grid-layer` or a blurred layer.

## 4. Work packages

### WP1 — Overlay & capture (R-01, R-08, R-09, R-10)
- [x] Borderless full-screen window fitted to the cursor's monitor, always on top, no taskbar entry (seen: 1920×1200, foreground)
- [x] `capture`: GDI `BitBlt` of the monitor → downscale → JPEG data URL (backdrop matched the screen)
- [x] `launcher-prepare` → `present` handshake
- [~] 900 ms safety net · hide on empty-space click / focus loss (ignored 500 ms after presenting) / hotkey
- [~] `--pin` / `OPALINE_PIN`: used throughout development; works
- **Accept:** hotkey shows the overlay in under ~300 ms on the target laptop; no flash; Esc and click-off both close it.

### WP2 — Desktop items & icons (R-02, R-03)
- [x] Scan user + shared desktop; skip hidden/system/`desktop.ini`; strip `.lnk`/`.url`; de-duplicate by name
- [x] Icons via `IShellItemImageFactory` on one STA thread, serial, retry once; premultiplied BGRA → RGBA PNG
- **Accept:** all items show their real icon, repeatably (ten open/close cycles); missing icons fall back to a letter tile.

### WP3 — Panes (R-05, R-06, R-07, R-12)
- [x] `groups.json` load/save code, pruning of vanished items (write/restart persistence **not yet verified**)
- [x] Auto-organise rules; first-run run seen
- [x] Pane tile with mini icon grid; popup that grows from the tile; `Esc` closes it
- [~] Drag & drop (tile→tile creates a pane, tile→pane adds, popup member→outside removes)
- [~] Context menu actions · rename · ungroup
- **Accept:** panes survive restart; rename persists; deleting a Desktop file removes it from its pane; ungrouping returns members to the grid.

### WP4 — Search & keyboard (R-04, R-16)
- [~] Contains-match with prefix first; panes match by name; Enter launches/opens the top hit; ↓ into the grid; arrows by tile and row; typing anywhere focuses search
- [~] Optional "most used" ordering
- **Accept:** every action reachable without the mouse.

### WP5 — Liquid glass (R-08, R-09)
- [x] Backdrop: snapshot with CSS blur/saturation/brightness + tint, oversized to hide blur edges
- [x] Panes: translucent gradient, `backdrop-filter`, inner highlights, specular rim, shadow
- [x] Lens: per-pane SVG displacement map from a rounded-rect signed-distance field, applied via `backdrop-filter: url(#…)`, rebuilt on resize
- [~] Styles **Liquid** (seen) · **Frost** · **Clear** (not seen) · reduced-motion handling
- **Accept:** backdrop blurred but recognisable; edges visibly bend what is behind them; Frost/Clear degrade cleanly; no jank on integrated GPU.

### WP6 — Rail (R-13, R-14)
- [x] `taskbar`: enumerate windows with Alt-Tab rules; group by executable; read the pinned-taskbar folder; resolve link targets
- [x] Rail UI renders (pinned + running, running dot, window-count badge)
- [~] Hover preview card opens; thumbnails (`PrintWindow`, `PW_RENDERFULLCONTENT`) — re-test speed; click to focus; magnification; click to launch
- **Accept:** rail matches the real taskbar apart from the system tray and documented Store-app edge cases; previews within ~300 ms.

### WP7 — Settings pane (R-11)
- [x] Sections and controls render from a schema (`panel.ts`)
- [~] Every control applies live and persists · hotkey recorder · launch-at-login switch · reset
- **Accept:** each setting in §5 reachable, persists across restarts, does what its label says.

### WP8 — Lifecycle & behaviour (R-01, R-10, R-16)
- [~] Tray icon (toggle on click, Show/Quit) · single instance (second launch opens the overlay) · `--hidden` for login start
- [ ] Multi-monitor: open on the cursor's monitor and re-fit when it changes (code present, untested)
- **Accept:** quitting leaves no process behind; a second launch doesn't fight over the hotkey.

### WP9 — Identity & repo (R-15, R-18)
- [x] README, WORKORDER, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, LICENSE, CHANGELOG, templates, CI file, AGENTS.md, docs/
- [x] Logo (`assets/logo.svg`) and generated icon set (`npm run icons`)
- [x] DEVLOG with the failed WinUI 3 beta; source in `archive/winui3-beta/`
- [ ] CI run green · placeholders replaced (§15) · screenshots with demo data
- **Accept:** a stranger can clone, build, run and contribute using only the repo.

### WP10 — Linux port (R-17) · P2
- [ ] Capture via PipeWire/portal (Wayland) and X11 fallback
- [ ] Icons from the icon theme / `.desktop` files; items from `~/Desktop` and `.desktop` entries
- [ ] Window list/previews per compositor (best effort) or hide the rail
- [ ] CI job on `ubuntu-latest`

### WP11 — Quality
- [ ] Unit tests: auto-organise rules and group store (pure TypeScript — easiest first win)
- [ ] Rust tests: `desktop::display_name`, BGRA→RGBA conversion
- [ ] Manual pass of §9 before each release
- [ ] Performance budget: show ≤ 300 ms, idle ≤ 120 MB, no dropped frames while scrolling

## 5. Settings inventory

| Section | Setting | Default |
|---|---|---|
| Glass | Style: Liquid / Frost / Clear | Liquid |
| | Backdrop blur · colour · brightness | 16 px · 1.35× · 0.96× |
| | Tint colour · tint strength | `#0b1226` · 16 % |
| | Pane blur · lens strength · corner roundness | 8 px · 70 % · 30 px |
| | Tile glass | 24 % |
| Layout | Icon size S / M / L · show names | M · on |
| | Panes first · sort loose items by name / most used | on · name |
| Rail | Show rail · side · magnify · previews | on · right · on · on |
| Behaviour | Close on empty-space click · close on focus loss · animations | on · on · on |
| | Hotkey · launch at login | Ctrl+Alt+Space · off |
| Panes | Organise for me · Ungroup all | actions |
| About | Version, codename, quit, reset all settings | |

## 6. Auto-organise rules (first match wins; a new pane needs ≥ 2 members)

| Pane | Matches |
|---|---|
| IDEs | Android Studio, Visual Studio / VS Code, IntelliJ family, Kate, Sublime, Notepad++, Cursor, Zed, Eclipse, Xcode |
| AI & code agents | ChatGPT, Claude, Gemini, Copilot, Codex, Perplexity, Ollama, LM Studio, Wispr |
| Dev tools | Docker, DBeaver, Postman, Git clients, Warp / terminals, WSL, virtual machines |
| Notes & planning | Notion, Notion Calendar, Obsidian, OneNote, Todoist, Trello |
| Browsers | Firefox, Edge, Chrome, Brave, Opera, Vivaldi |
| Chat | Discord, WhatsApp, Telegram, Slack, Teams, Zoom |
| Creative | Krita, Blender, GIMP, Inkscape, OBS, Huion/Wacom drivers, DaVinci, Figma |
| Games & music | Steam, Epic, Spotify, VLC |
| Utilities | Download managers, WizTree, 7-Zip, PowerToys, ShareX |
| University *(folders)* | `Semester_*`, `UniStuff`, lecture/course/module/vault names |
| Code projects *(folders)* | `*-source`, `Projects`, `*Tinker*`, repo/workspace names |
| Archive *(folders)* | `BACKUPS`, `Legacy*`, archive/old names |

Rules live in `src/organize.ts` as plain data. Anything that matches nothing stays loose.

## 7. Data formats

`groups.json` (app data directory, `%APPDATA%\dev.opaline.launcher`):

```json
{
  "version": 1,
  "organized": true,
  "groups": [{ "id": "ides", "name": "IDEs", "items": ["C:\\Users\\you\\Desktop\\Visual Studio Code.lnk"] }],
  "launches": { "C:\\Users\\you\\Desktop\\Claude.lnk": 12 }
}
```

`config.json`: `{ "hotkey": "ctrl+alt+space" }` (Rust needs it before the UI exists). Everything else lives in the webview's local
storage under `opaline.settings`.

## 8. Rust ↔ UI contract

Commands: `ready` · `present` · `list_items` · `get_icon(path)` · `launch(path)` · `reveal(path)` · `rail_items` · `thumbnail(hwnd)` ·
`focus_window(hwnd)` · `hide_launcher` · `quit` · `status` · `set_hotkey(combo)` · `set_behavior(closeOnBlur)` · `load_store(name)` ·
`save_store(name, json)`. Event: `launcher-prepare { snapshot }`. `load_store`/`save_store` accept only `groups.json` and `config.json`.

## 9. Acceptance checklist (run before every release)

1. Hotkey opens and closes the overlay; rebinding works; a taken combo shows an error and keeps the old one.
2. Backdrop matches the screen, including over a live wallpaper; no stale frame from the previous open.
3. Every Desktop item has its icon on a cold start and after ten open/close cycles.
4. Create a pane by dragging, rename it, add and remove items, restart — all still there.
5. Auto-organise on a fresh profile produces the panes in §6 and leaves unmatched items loose.
6. Search finds items inside panes; Enter launches; Esc clears, then closes.
7. Empty-space click, Esc, focus loss and the hotkey all close it; clicking a tile or the rail does not.
8. Rail lists the real taskbar apps; hover shows previews; click focuses; minimised windows restore.
9. Every setting applies live and survives a restart; reset restores defaults.
10. Second monitor: opens on the cursor's monitor.
11. Tray icon: toggle and quit work; no process left after quitting.
12. `npm run build`, `cargo fmt --check`, `cargo clippy` and `cargo check` are clean; CI is green.

## 10. Risks & decisions

| Risk / decision | Notes |
|---|---|
| OS blur materials (acrylic, blur) looked and behaved poorly | **Decided:** don't use them. The overlay renders its own blur from a snapshot. The first Tauri cut used acrylic and was replaced. |
| SVG filters inside `backdrop-filter` are Chromium-only | Fine for WebView2; Linux WebKitGTK falls back to Frost. Feature-detect and degrade. |
| Snapshot freezes a live wallpaper while open | Accepted; the entrance transition hides the freeze. |
| `PrintWindow` can't capture some protected or minimised windows | Show a placeholder; never block the rail on a failed thumbnail. |
| Foreground lock may stop the overlay taking focus when the hotkey is pressed from another app | **Untested.** Fallback: `SetForegroundWindow`/`AttachThreadInput`. Without focus, Esc won't reach the page. |
| Windows 260-character path limit | Build from a short folder, or set `CARGO_TARGET_DIR` to a short path (hit twice during development). |
| Pinned taskbar apps live in two places | Classic pins are `.lnk` files in `…\User Pinned\TaskBar`; newer pins are in the registry `Taskband` value. Only the first is read today. |
| Store/UWP apps share `ApplicationFrameHost.exe` | Each window gets its own rail entry named by its title. |
| Dev builds are slow for image work | Dependencies optimised in the dev profile. |
| A remote debugging port is used for testing | Local, development-only, never in a release build. Documented in docs/TESTING.md. |

## 11. Convenience ideas (beyond 0.1)

**P1** — drag to reorder tiles and panes · pin/hide items · pane colours and emoji · Alt+1…9 opens the nth pane · recent-items strip ·
close-window button in rail previews · run as administrator · layout export/import · theme presets (Frost, Liquid, Midnight, Daylight) ·
clock/date widget · Quick Look preview on Space.

**P2** — command palette (calculator, unit conversion, web search, run command) · per-pane hotkeys · drop files from other apps onto a
pane · Linux and macOS ports · settings sync via a plain file · scripting/plugin hooks.

## 12. Next actions (ordered — start at the top)

1. **Make the baseline clean.** `npm install`; `npm run build`; `cargo fmt`; `cargo clippy --all-targets` (fix findings);
   `cargo check --locked`. Initialise git in a real folder (not a deeply nested one) and commit. Push only when the owner says so.
   *Done when:* all four commands are clean and CI would pass.
2. **Verify the "not yet verified" list in §0**, using `scripts/cdp.mjs` for page behaviour and the real keyboard for the hotkey, focus
   and tray paths. Fix what breaks. Flip statuses to `[x]` only for things you saw work; note how in the Notes column.
   Priorities: hotkey toggle and focus (R-01, R-10) → drag/drop/rename/persistence (R-05, R-06) → settings persistence (R-11) →
   rail click/preview/magnify (R-13, R-14) → single instance, tray, autostart (R-16).
3. **Rail completeness.** Compare the rail with the real taskbar. Add the registry `Taskband` pins (see §10), keep order sensible, and handle
   Store apps' icons. *Done when:* a user's pinned apps all appear and launch.
4. **Tune the glass.** Test Liquid / Frost / Clear on a bright wallpaper and with a live wallpaper running; adjust defaults for
   legibility; measure GPU cost on the integrated GPU and cut effects if it janks. Re-check show latency (≤ 300 ms).
5. **Tests.** Unit-test `organize.ts` and `groups.ts` (e.g. Vitest); Rust tests for `display_name` and BGRA→RGBA.
6. **Polish for publishing.** Replace the placeholders in §15; capture README screenshots *with demo data* (the development
   screenshots show the owner's real folder names); run the CI; draft the first release (`v0.1.0 "Annealed"`).
7. **Then P1 features** from §11, one work package at a time, each with acceptance criteria added here first.

## 13. Known issues

- The closed pane popup keeps its last member tiles in the DOM, so `document.querySelectorAll('.tile')` also counts them. Clear the popup when it closes.
- The rail showed only File Explorer and Claude; the real taskbar may have more pins (see §10).
- First thumbnail took ~800 ms in an unoptimised dev build; unverified after the fix.
- `Esc` in the pane-name field both closes the popup and bubbles to the global handler; confirm the intended order.
- No automated tests exist.

## 14. Out of scope (external tools)

- **Live wallpaper:** Wallpaper Engine (paid, largest library) or Lively Wallpaper (free, open source). Opaline snapshots whatever is on screen.
- **Taskbar background:** a tool such as TranslucentTB. Opaline does not modify the taskbar.
- Hiding Explorer's desktop icons: the Windows setting *View → Show desktop icons* (Opaline never changes it).

## 15. Placeholders to replace before publishing

| Where | Placeholder |
|---|---|
| `src-tauri/tauri.conf.json`, `docs/NAMING.md` | bundle identifier `dev.opaline.launcher` — use a domain you own or `io.github.<handle>.opaline` |
| `CODE_OF_CONDUCT.md`, `SECURITY.md` | `<add a contact address before publishing>` |
| `LICENSE` | "Opaline contributors" — put the copyright holder you want |
| `README.md`, `package.json`, `src-tauri/Cargo.toml` | repository URL, authors |
| Name | Trademark, domain and package-registry availability of "Opaline" has **not** been checked |
