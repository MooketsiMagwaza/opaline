# Opaline — Work Order

The single source of truth for what Opaline must do, how it is built, what has actually been checked, and what comes next.
Everything in the original brief is traceable to a requirement ID (`R-xx`). Pull requests and commits should reference the IDs
they touch.

**Release in progress:** `0.1.0` · codename **Annealed** (see [docs/NAMING.md](docs/NAMING.md))
**Platforms:** Windows 11 first. Linux is a planned port (R-17); platform-specific code stays behind `cfg(windows)`.
**Last updated:** 2026-10-28 — workspace/screen-time candidate on `feat/workspaces-screen-time`.

**Current request intake:** [SESSION_WORKORDER.md](docs/SESSION_WORKORDER.md) lists every owner request from this chat, including named spaces, taskbar/icon parity, screen time and charts, Focus/Zen/saver, startup, screenshots, coding rules and the owner-test-before-PR gate.

**Status legend** — `[x]` verified working on a real machine (how is noted) · `[~]` implemented, not yet verified or only partly
verified · `[ ]` not started. **Priority:** P0 ships in 0.1.0 · P1 next · P2 later. Mark `[x]` only for things you have seen work.

---

## 0. Current status

**28 October candidate:** named workspaces, local screen time with daily graphs, numbered corner navigation, compact mode, the reactivated bottom taskbar mirror, cached previews, Windows-key opt-in, settings validation, group-origin popup motion, Focus timer, Zen and an opt-in screen saver are implemented. Browser checks cover keyboard/navigation/persistence/layout with demo fixtures. Native checks enumerated 197 apps, read eight rail entries, captured a preview, round-tripped workspace storage/pause state, and confirmed the Windows-key hook is available but off. Cached demo preview presentation measured 9–33 ms; native cold captures measured 66.5–131.6 ms. The current Windows login preference is off. Real key/chord, window-icon parity, login start, virtual-desktop/PowerToys, pointer, installer and CI acceptance remain open. The earlier observations below are historical evidence, not verification of every new path.

The app **builds and runs**. It was started with `npm run tauri dev`, and its page was driven and screenshotted through
WebView2's local debugging port (`scripts/cdp.mjs`, see [docs/TESTING.md](docs/TESTING.md)) on the target laptop
(Windows 11, Intel Iris Xe, 1920×1200 at 150 % scaling).

**Seen working**

- Full-screen overlay opens both through the snapshot path and through the transparent, capture-free clear-canvas path; no flash of an empty window.
- All 45 Desktop items (user + shared Desktop) listed with their **real icons**, including `.lnk` shortcuts, folders and an `.exe`.
- First-run **auto-organise** produced 12 panes (IDEs, AI & code agents, Dev tools, Browsers, Chat, Creative, Notes & planning,
  Games & music, Utilities, University, Code projects, Archive) and left 8 items loose, exactly as the rules in §6 intend.
- **Pane popup** opens from its tile with the pane's name and members; **Esc** closes it.
- The current **acrylic styling** gives search, Home, All Apps, settings, popup and menus one consistent fill, rim and shadow; the earlier
  lens treatment was removed from the active path.
- **Settings pane** opens with five active sections (Appearance, Layout, Behaviour, Panes, About); Appearance exposes blur and tint, launch at login was observed off, and rail settings are feature-flagged out.
- **Context menu** renders with Open / Open file location / Copy path / Add to pane ▸.
- **Search** filters the grid ("dis" → Discord).
- **Rail** lists the pinned File Explorer entry and the running Claude window with a running dot; hovering opens the preview card.
- The global **Ctrl+Alt+Space** hotkey opens and closes the overlay from another foreground app; **Esc** closes the full overlay.
- Transparent request-to-visible measurements on the target laptop were 9.2–49.2 ms across stable warm opens; one 57.1 ms open and 72–84 ms rebuild/jitter outliers were also recorded.
- UI type-checks (`tsc --noEmit` clean); Rust compiles with no errors.
- The logo rasterises and the full icon set is generated from it (`npm run icons`).
- Frontend/store/theme tests (10) and Rust unit tests (9) pass locally; production UI bundle and NSIS release installer are clean.

**Not yet verified** (do these first — §12 step 2)

- Closing the whole overlay with **click on empty space** and **focus loss**; Esc and the hotkey were exercised successfully.
- **Drag and drop**, **rename persistence**, **ungroup**, **remove from pane**, and that `groups.json` is written and survives a restart.
- **Settings persistence** and the live effect of each control; **Frost** and **Clear** styles; behaviour on a bright wallpaper.
- Hotkey **rebinding**, **launch at login**, **tray icon**, **single-instance** wake-up.
- **Rail**: click to focus/launch, magnification, thumbnails after the optimisation below, and whether the list matches the real taskbar
  (only two entries appeared; Windows 11 stores some pins in the registry rather than as shortcuts — see §13).
- **Performance**: snapshot-path latency, idle memory and scrolling smoothness. The transparent warm path is approximately at its 50 ms target, with the outliers noted above.
- The NSIS release installer builds locally; its install/uninstall pass, the remaining real interaction matrix and GitHub CI/tag release have not yet completed. Local build, format, Clippy, unit tests and locked Cargo check are clean.

**Changed after the last visual check (unverified):** clear canvas is now a transparent, capture-free fast path; backdrop capture
downsamples in GDI; warm opens defer Desktop/rail refreshes; lenses are bounded/cached; centred grid ordering, Taskband registry pins,
collision-aware dock motion and the fabric opening sequence were added. These need the real-app pass before their statuses become `[x]`.

## 1. Objective

A frosted, liquid-glass desktop launcher. Press **Ctrl+Alt+Space** and a full-screen overlay appears over a blurred, tinted
snapshot of whatever is on screen. On it:

- every item from your Desktop folders, as glass tiles with their real icons;
- named **panes** (groups) like Start-menu or iPad folders, organised automatically and editable by hand;
- a search bar that finds anything instantly;
- a compact **taskbar mirror** along the bottom (pinned and running apps) with cached window previews on hover;
- a settings pane controlling every parameter of the glass.

Desktop icons stay hidden in Explorer. The files stay in the Desktop folder. **Opaline only reads them.**

## 2. Brief → requirements

| ID | Requirement | Pri | Status | Notes |
|----|-------------|-----|--------|-------|
| R-01 | **Ctrl+Alt+Space** toggles the launcher; the combo is rebindable in settings | P0 | `[~]` | Global open/close toggling observed; rebinding not exercised |
| R-02 | Items come straight from the Desktop folders (user + shared, OneDrive-aware); files are never moved, renamed or deleted | P0 | `[x]` | 45 items incl. shared desktop; read-only by construction. OneDrive-redirected desktop untested |
| R-03 | Real icons for `.lnk`, `.exe`, folders, documents | P0 | `[x]` | All 45 shown on one cold start. Ten-cycle repeatability not yet checked |
| R-04 | Search: instant, ranked, Enter launches the top hit, arrows navigate, typing anywhere searches | P0 | `[~]` | Filtering seen; Enter / arrows / type-anywhere not exercised |
| R-05 | Panes: drag a tile onto another to make one, onto a pane to add, click to open the popup grid | P0 | `[~]` | Panes + popup seen; drag and drop not exercised |
| R-06 | Pane naming: rename in place; names persist; new panes open into rename | P0 | `[~]` | Name field renders; rename + persistence not exercised |
| R-07 | Auto-organise (IDEs, AI & code agents, dev tools, …), done for the user on first run, re-runnable | P0 | `[x]` | First run verified (12 panes). "Organise now" button not exercised |
| R-08 | Consistent acrylic look: softened backdrop remains recognisable, with clear borders and restrained highlights | P0 | `[~]` | Looks right on a dark backdrop; bright-wallpaper and GPU passes remain |
| R-09 | Works over a transparent desktop / live wallpaper (snapshot of what is on screen) | P0 | `[~]` | Snapshot path works; not tried with a live wallpaper running |
| R-10 | Closes on **Esc**, empty-space click, focus loss, and the hotkey | P0 | `[~]` | Whole-overlay Esc and hotkey close observed; empty-space click and focus loss not exercised |
| R-11 | Settings pane: acrylic blur/tint, layout, behaviour, hotkey, launch at login, about | P0 | `[~]` | Focused Appearance controls render; per-control persistence pass remains |
| R-12 | Rename / ungroup / remove / add to pane via right-click as well as dragging | P0 | `[~]` | Menu renders; actions not exercised |
| R-13 | **Rail**: bottom taskbar mirror (pinned + running); click focuses or launches | P0 | `[~]` | Retained implementation reactivated; native enumeration checked; full parity/focus/launch pass pending |
| R-14 | Cached rail hover previews, click to focus, optional magnification | P0 | `[~]` | Decoded bounded cache, shared requests, background refresh and GDI downsampling; owner hover/focus pass pending |
| R-15 | Identity & repo: logo, naming, README, contributing, license, changelog, CI, templates | P0 | `[~]` | Public metadata and release workflow are prepared; CI/tag release and demo screenshots remain unverified |
| R-16 | Convenience: usage ordering, open file location, copy path, tray, launch at login | P0 | `[~]` | Implemented; none exercised |
| R-17 | Linux port later | P2 | `[ ]` | Non-Windows stubs compile in principle; never built |
| R-18 | WinUI 3 attempt logged as a failed beta, source archived | P0 | `[x]` | `DEVLOG.md`, `archive/winui3-beta/` |
| R-19 | Live wallpaper and taskbar transparency are external tools; document compatibility | P0 | `[~]` | Documented in README; not tested with either tool |
| R-20 | Loose items, folders and panes can be reordered only in a centred, snapped grid and persist across display sizes | P0 | `[~]` | Implemented with ordered metadata; real pointer/restart pass pending ([grid work order](docs/SPATIAL_WORKORDER.md)) |
| R-21 | Acrylic canvas uses a downsampled snapshot and a hidden-window warm cache; retained clear mode provides a capture-free experimental path | P0 | `[~]` | Uncached debug open measured at 252.5 ms; cached warm open at 25.7 ms. Release measurements remain |
| R-22 | Toggleable fabric-unfold entrance and collision-aware dock motion respect reduced motion | P0 | `[~]` | Single-layer grid unfold implemented; live visual/GPU pass pending |
| R-23 | One rounded surface holds the app grid; loose apps use icon + name without a bubble; panes use one rounded mini-icon bubble with the name below | P0 | `[~]` | Hierarchy observed in the real app; long-label/clipping/theme matrix pending ([theme work order](docs/THEME_WORKORDER.md)) |
| R-24 | Search floats independently from the canvas and item cards | P0 | `[~]` | Search active; deprecated rail is feature-flagged off |
| R-25 | One persistent acrylic engine exposes blur intensity, tint strength and tint colour | P0 | `[~]` | Implemented; migration/persistence/contrast/GPU matrix pending |
| R-26 | Floating page navigation exposes Home and the installed-app catalogue without slowing the first frame | P1 | `[~]` | Windows AppsFolder enumeration runs after presentation; complete keyboard pass remains |
| R-27 | Named app/file/folder spaces; Alt+1 Desktop, Alt+2–9 custom | P0 | `[~]` | Serialized metadata, rename/remove/pin, direct folder paths; W-03 |
| R-28 | Local maximised foreground-app time, Today / All time, pause and clear | P0 | `[~]` | Native sampler, date/sleep tests; owner usage/idle/restart pass remains; W-01 |
| R-29 | Numbered corner pages, cycle shortcut and compact taskbar view | P0 | `[~]` | Browser keyboard/persistence/layout checks; W-02/W-05/W-18 |
| R-30 | Opt-in Windows-key tap opens All apps; Windows chords retained | P0 | `[~]` | Hook available, off by default; real key/chord acceptance required; W-08 |
| R-31 | Current Windows desktop receives Opaline; desktop-aware backdrop cache | P0 | `[~]` | Documented COM interface; real desktop/PowerToys pass remains; W-04 |
| R-32 | Group-origin popup motion and readable two-line labels | P0 | `[~]` | Browser origin/reduced-motion checks; native pointer pass remains; W-15/W-18 |
| R-33 | Custom scrollbar and a larger centre surface with a compact bottom taskbar | P0 | `[~]` | Browser layout screenshots and narrow bounds; W-19/W-21 |
| R-34 | Running app icons match their Windows taskbar identity | P0 | `[~]` | Window-icon path precedes shortcut fallback; real ChatGPT comparison remains; W-20 |
| R-35 | Period menu, 7/30-day usage graphs, per-app progression | P0 | `[~]` | Browser chart/menu checks; daily native history tests; W-23/W-24 |
| R-36 | Pomodoro timer with configurable breaks, progress and persistence | P0 | `[~]` | Deadline/transition unit tests and browser UI check; native/restart pass remains; W-25 |
| R-37 | Zen reminders and optional in-app idle screen saver | P1 | `[~]` | Browser mode checks; real idle and wake pass remains; W-26 |
| R-38 | Faster hidden startup and clear launch-at-login state | P0 | `[~]` | Concurrent boot, deferred UI work, bounded icon cache; next-sign-in test remains; W-27 |
| R-39 | Use Opaline brand mark for All apps rather than a Windows logo | P0 | `[~]` | Rendered demo screenshot; native pass remains; W-22 |
| R-40 | Adopt owner coding rules from the supplied screenshot | P0 | `[~]` | Added to AGENTS.md and applied to touched code; W-28 |
| R-41 | Demo groups reflect realistic app/folder relationships | P0 | `[~]` | Browser screenshot and fixture assertions; W-29 |
| R-42 | Taskbar icons remain sharp; Opaline does not add its own dock button | P0 | `[~]` | Larger window icon and lower hover scale; real taskbar comparison pending; W-30/W-31 |
| R-43 | Plain text section links, numbered workspace arrows and hover peeks | P0 | `[~]` | Browser interaction/layout checks; Windows pointer pass pending; W-32/W-33 |
| R-44 | Taskbar scrollbar hidden and taskbar/search heights match | P0 | `[~]` | Computed-style and rendered viewport check; native scaling pass pending; W-34/W-35 |

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
3. The UI sets the backdrop, waits for it to decode, loads Desktop items if needed, then calls `present`. Apps, icons and taskbar refresh after the first frame.
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

### WP5 — Acrylic surfaces (R-08, R-09, R-23, R-24, R-25)
- [x] Backdrop: snapshot with CSS blur/saturation/brightness + tint, oversized to hide blur edges
- [x] Large floating/transient surfaces: translucent gradient, `backdrop-filter`, inner highlights, specular rim and shadow
- [x] One acrylic token set with direct blur, tint-strength and tint-colour controls; dormant refraction code is not on the render path
- [~] One rounded apps surface · centred grid with left-aligned sparse rows · plain app/folder icon + label · pane mini-icon bubble + label below · independently floating search
- **Accept:** complete the bright/dark, card-clipping, persistence, migration, reduced-motion and integrated-GPU matrix in
  `docs/THEME_WORKORDER.md`; no per-card backdrop filters.

### WP6 — Bottom taskbar mirror (R-13, R-14) · reactivated
- [x] `taskbar`: enumerate windows with Alt-Tab rules; group by executable; read the pinned-taskbar folder; resolve link targets
- [x] Rail UI renders (pinned + running, running dot, window-count badge)
- [~] Hover preview card opens; thumbnails (`PrintWindow`, `PW_RENDERFULLCONTENT`) — re-test speed; click to focus; magnification; click to launch
- [~] Decoded cache hits render immediately; stale images refresh in background; requests deduplicate; closed handles are evicted and cache is bounded to 32. Cached target ≤50 ms; cold captures measured separately.
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
- [~] Publishing metadata and tag-release workflow prepared; CI run, signed artifacts and screenshots with demo data remain
- **Accept:** a stranger can clone, build, run and contribute using only the repo.

### WP10 — Linux port (R-17) · P2
- [ ] Capture via PipeWire/portal (Wayland) and X11 fallback
- [ ] Icons from the icon theme / `.desktop` files; items from `~/Desktop` and `.desktop` entries
- [ ] Window list/previews per compositor (best effort) or hide the rail
- [ ] CI job on `ubuntu-latest`

### WP11 — Quality
- [x] Frontend unit tests: organisation, groups, ordering, settings validation, workspace writes and focus deadline/phase transitions (18 tests passed locally, 28 October)
- [x] Rust unit tests: display names, pixels, Taskband matching and usage/date/sleep attribution (11 tests passed locally, 28 October)
- [ ] Manual pass of §9 before each release
- [~] Performance budget: transparent stable warm opens 9.2–49.2 ms on the target laptop, with one 57.1 ms open and 72–84 ms rebuild/jitter outliers; snapshot show ≤ 300 ms, idle ≤ 120 MB and scrolling still need measurement

### WP12 — Focus, progression and startup (R-33–R-40)
- [~] Custom scrollbar, larger app surface and compact taskbar; verify at 100/150/200% Windows scaling.
- [~] Running-window icons precede shortcut icons; compare ChatGPT and other apps to the Windows taskbar.
- [~] Screen-time period menu, daily graphs, per-app detail and local 90-day retention; verify rollover and idle behaviour.
- [~] Pomodoro deadline and fourth-session long break; verify hide/reopen and OS restart. Zen and the optional saver need real pointer/keyboard/idle wake checks.
- [~] Hidden startup registers the hotkey before Desktop, icon or rail warming finishes. Login toggle clearly reports off/on; verify a stable binary path after Windows sign-in.
- [~] Rendered demo screenshots and owner coding rules; preview test first, then draft PR.

### WP13 — Demo and navigation consistency (R-41–R-44)
- [~] Logical demo fixture: IDEs include Android Studio; project folders live in Code projects; only sample loose folders remain.
- [~] Running-window icons prefer the larger asset; optional dock hover scale is limited. Owner icon comparison remains.
- [~] Header has bare text links for sections, numbered workspace buttons and page arrows; dock no longer has an Opaline launcher button.
- [~] Two-second pane/folder peek and keyboard access; native folder read is bounded. Browser timing and content checked.
- [~] Taskbar scrollbar hidden, horizontal scrolling retained and taskbar/search heights both 52 px. Native scaling check remains.

## 5. Settings inventory

| Section | Setting | Default |
|---|---|---|
| Appearance | Acrylic blur · tint colour · tint strength | New profiles: 22 px · `#0b1226` · 20%; saved values preserved |
| Layout | Icon size S / M / L · show names | M · on |
| | Panes first · sort loose items by name / most used | on · name |
| | Reset grid order (keeps panes) | action |
| Layout | Compact navigation (Ctrl+B) | off |
| | Surface width · taskbar icon size · scrollbar width | 960 px · 30 px · 8 px |
| Taskbar | Show mirror · magnify · previews | on · off · on |
| Behaviour | Close on empty-space click · close on focus loss · animations | on · on · on |
| | Hotkey · launch at login | Ctrl+Alt+Space · off |
| | Page cycling · pane opening duration · fabric opening | Shift+Tab (or Ctrl+Tab) · 320 ms · on |
| | Use Opaline for the Windows key | off; native Start-button click / Ctrl+Esc retained |
| Workspaces | Add / rename / remove up to eight spaces | Dev tools initially; Desktop always Alt+1 |
| Screen time | Pause / resume · clear history | tracking on while Opaline runs; local only |
| Focus | Session · short break · long break · quote interval | 25 min · 5 min · 15 min · 25 sec |
| | Automatic screen saver · idle time | off · 5 min |
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

`groups.json` (app data directory, `%APPDATA%\io.github.mooketsimagwaza.opaline`; legacy pre-release data is copied forward once):

```json
{
  "version": 1,
  "organized": true,
  "groups": [{ "id": "ides", "name": "IDEs", "items": ["C:\\Users\\you\\Desktop\\Visual Studio Code.lnk"] }],
  "launches": { "C:\\Users\\you\\Desktop\\Claude.lnk": 12 }
}
```

`config.json`: `{ "hotkey": "ctrl+alt+space" }`. `workspaces.json` stores named spaces; `screen-time.json` stores executable/current-day totals and pause state; `shell.json` stores Windows-key routing. Visual/layout settings live in webview local storage under `opaline.settings`.

## 8. Rust ↔ UI contract

Commands: `ready` · `present` · `list_items` · `get_icon(path)` · `launch(path)` · `reveal(path)` · `rail_items` · `thumbnail(hwnd)` ·
`focus_window(hwnd)` · `hide_launcher` · `quit` · `status` · `set_hotkey(combo)` · `set_behavior(closeOnBlur)` · `set_backdrop_capture(enabled)` · `load_store(name)` ·
`save_store(name, json)` · `list_apps` · `workspace_item(path)` · `screen_time` · `set_screen_time(enabled)` · `clear_screen_time` · `start_menu_status` · `set_start_menu(enabled)`. Events: `launcher-prepare { snapshot, reuseSnapshot, page }`, `launcher-hidden`, `launcher-page`, `launcher-backdrop-cache`. Stores accept only `groups.json`, `config.json`, `workspaces.json`, `screen-time.json` and `shell.json`.

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
12. `npm test`, `npm run build`, `cargo fmt --check`, `cargo clippy`, `cargo test` and `cargo check` are clean; CI is green.
13. Acrylic snapshot mode stays under its warm-open budget, and fabric opening motion can be disabled.
14. Move a loose item, folder and pane; restart and confirm their positions persist (full pass in `docs/SPATIAL_WORKORDER.md`).
15. Complete `docs/THEME_WORKORDER.md`: consistent acrylic, centred app surface, pane bubbles, left-aligned sparse rows, persistence, contrast and no clipping.
16. Complete `docs/SESSION_WORKORDER.md`: workspace shortcuts/persistence, compact mode, cached previews, Win-key opt-in/chords, real usage/idle/sleep, virtual-desktop/PowerToys compatibility. Draft PR only after the owner's test result.

## 10. Risks & decisions

| Risk / decision | Notes |
|---|---|
| OS blur materials (acrylic, blur) looked and behaved poorly | **Decided:** don't use them. Clear mode is a transparent WebView; frosted modes render their own snapshot. |
| SVG filters inside `backdrop-filter` are Chromium-only | Fine for WebView2; Linux WebKitGTK falls back to Frost. Feature-detect and degrade. |
| Snapshot freezes a live wallpaper while open | Accepted; the entrance transition hides the freeze. |
| `PrintWindow` can't capture some protected or minimised windows | Show a placeholder; never block the rail on a failed thumbnail. |
| Foreground lock may stop the overlay taking focus when the hotkey is pressed from another app | **Untested.** Fallback: `SetForegroundWindow`/`AttachThreadInput`. Without focus, Esc won't reach the page. |
| Windows 260-character path limit | Build from a short folder, or set `CARGO_TARGET_DIR` to a short path (hit twice during development). |
| Pinned taskbar apps live in two places | Classic `.lnk` pins and self-describing Taskband registry entries are merged; unfamiliar future blob formats fall back to the shortcut folder. |
| Store/UWP apps share `ApplicationFrameHost.exe` | Each window gets its own rail entry named by its title. |
| Dev builds are slow for image work | Dependencies optimised in the dev profile. |
| A remote debugging port is used for testing | Local, development-only, never in a release build. Documented in docs/TESTING.md. |

## 11. Convenience ideas (beyond 0.1)

**P1** — finish App Library usage ordering and design opt-in widgets · hide items · pane colours and emoji · recent-items strip ·
close-window button in rail previews · run as administrator · layout/theme export-import · additional named palettes · clock/date widget ·
Quick Look preview on Space.

**P2** — command palette (calculator, unit conversion, web search, run command) · per-pane hotkeys · drop files from other apps onto a
pane · Linux and macOS ports · settings sync via a plain file · scripting/plugin hooks.

App Library, calendar, widgets and the reversible Start-style surface are specified separately in
[docs/PLATFORM_ROADMAP.md](docs/PLATFORM_ROADMAP.md).

## 12. Next actions (ordered — start at the top)

0. **Owner-test the 28 October candidate first.** Follow `docs/SESSION_WORKORDER.md`. Alt+1–9 selects spaces and the taskbar is active. Review the runnable build and local verification; create the draft PR only after the owner's test result. Do not publish a release as part of this change.

1. **Confirm the clean gate in CI.** The local `npm test`, `npm run build`, `cargo fmt --check`, Clippy with warnings denied,
   `cargo test --locked` and `cargo check --locked` gates are clean. Run the same workflow on GitHub before marking CI verified.
2. **Verify the "not yet verified" list in §0**, using `scripts/cdp.mjs` for page behaviour and the real keyboard for the hotkey, focus
   and tray paths. Fix what breaks. Flip statuses to `[x]` only for things you saw work; note how in the Notes column.
   Priorities: hotkey toggle and focus (R-01, R-10) → drag/drop/rename/persistence (R-05, R-06) → settings persistence (R-11) →
   rail click/preview/magnify (R-13, R-14) → single instance, tray, autostart (R-16).
3. **Rail completeness.** Compare the merged folder/Taskband rail with the real taskbar and exercise a packaged app. *Done when:* all pins appear and launch.
4. **Tune motion and glass.** Test the active acrylic controls on bright and live wallpapers; measure integrated-GPU cost. Target about
   50 ms for the transparent warm-open path and ≤ 300 ms for snapshot mode; report measured values rather than guessing.
5. **Spatial pass.** Complete every acceptance step in `docs/SPATIAL_WORKORDER.md` without moving a real Desktop file.
6. **Theme pass.** Complete `docs/THEME_WORKORDER.md` on bright/dark imagery and the target Intel GPU; fix clipping before screenshots.
7. **Publish pass.** Build/install NSIS and MSI, capture README screenshots with demo data, run CI, then tag `v0.1.0` to create the release artifacts.
8. **Then P1 features** from §11, one work package at a time, each with acceptance criteria added here first.

## 13. Known issues

- Fabric motion and real pointer grid reordering have not had their full real-app pass yet.
- Taskband parsing deliberately consumes only self-describing link names/AppUserModelIDs from the undocumented blob and falls back safely.
- Native cold thumbnails measured 66.5–131.6 ms after GDI downsampling. Cached demo presentation measured 13–17 ms; owner cached-hover parity remains open.
- `Esc` in the pane-name field both closes the popup and bubbles to the global handler; confirm the intended order.
- The GitHub workflows cannot be marked verified until they run on the public remote.
- Windows-key routing and virtual-desktop/PowerToys compatibility need real key/workflow testing; the Windows-key option remains off by default.

## 14. Out of scope (external tools)

- **Live wallpaper:** Wallpaper Engine (paid, largest library) or Lively Wallpaper (free, open source). Opaline snapshots whatever is on screen.
- **Taskbar background:** a tool such as TranslucentTB. Opaline does not modify the taskbar.
- Hiding Explorer's desktop icons: the Windows setting *View → Show desktop icons* (Opaline never changes it).

## 15. Publishing metadata

| Where | Placeholder |
|---|---|
| `src-tauri/tauri.conf.json`, `docs/NAMING.md` | `io.github.mooketsimagwaza.opaline` |
| Security/conduct contact | GitHub private contact for `@MooketsiMagwaza` |
| License | `MooketsiMagwaza and Opaline contributors` |
| Repository / author | `https://github.com/MooketsiMagwaza/opaline` · `MooketsiMagwaza` |
| Name | Trademark, domain and package-registry availability of "Opaline" still requires an external legal/availability check |
