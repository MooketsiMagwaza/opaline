# Changelog

All notable changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com),
and the project uses [Semantic Versioning](https://semver.org). Each minor release has a glass-type codename
(see [docs/NAMING.md](docs/NAMING.md)).

## [Unreleased]

### Added
- Rebuilt the Focus workflow around a clear intention, explicit ready/running/paused states, 25/50/custom durations, finish-versus-skip semantics, keyboard control, session summaries and a compact running-timer capsule.
- Added six Opaline-native visual starting points—Opaline Original, Windows Mica, One UI Glass, Apple Glass, Frutiger Aero and Deep Night—plus named user visual/layout presets. User presets capture appearance, panel and icon sizing, rail/bar choices and motion settings, and support validated local JSON import/export.
- Added Split Header, Navigation Taskbar and Dropdown Tray arrangements with live previews. Individual destinations can stay pinned or move into the overflow tray.
- Added staged Settings editing with a persistent bottom Done/Cancel bar. Navigation and appearance previews reuse the current in-memory backdrop and actual panel proportions without persisting the image.
- Added task-specific Settings previews: Home simulations only where Home is being changed, plus a looping pane-origin motion preview for Panes.
- Added a dependency-free build-size report and frontend size budget.
- Added a Navigation setting that lets a normal Opaline open start on Home or All apps; choosing All apps focuses Search on open.
- Added Desktop, Opaline Aero and locally optimised custom Opaline backgrounds. Frutiger Aero includes its own original landscape.

### Changed
- Completed the TypeScript feature-folder migration: the source root now contains documentation only, while app composition, shared core, Activity, Appearance, Focus, Grid/Home, Navigation, Settings and Taskbar own their runtime modules. Activity and Taskbar styling moved out of the shell stylesheet.
- Expanded feature documentation with public functions, state ownership, dependencies, invariants, extension points and Mermaid UML/flow/state/sequence diagrams.
- Reorganised Settings into Appearance, Home layout, Navigation and Taskbar sections so visual presentation, Home ordering, Opaline destinations and the Windows app mirror no longer overlap.
- Replaced the fixed dark Settings commit slab and status copy with compact material-aware Cancel/Done actions at the lower-right.
- Expanded Settings into a near-full-window workspace, removed unrelated Home previews from Screen time and Home screens, and moved Focus preferences onto the Focus page.
- Changed launcher search to accept type-to-search from Home and All apps instead of requiring a dedicated S shortcut.
- Removed per-card backdrop filtering from appearance previews so preset count does not multiply compositor work.
- Changed Settings from automatic application to an explicit validated commit; operating-system actions remain intentionally immediate.

### Fixed
- Replaced ghosted generic preset thumbnails and dot-box diagrams with a shared miniature of the actual launcher layout using current memory-only backdrop, app names, loaded app/taskbar icons and real configuration state.
- Expanded the six built-in presets into distinct complete material profiles. Windows Mica now uses a flatter, mostly opaque WinUI 3-inspired treatment instead of sharing Opaline Frost's material.
- Changed precision-touchpad recognition to commit once, consume the complete inertial tail and re-arm after a bounded quiet period. A 280 ms safety release prevents a stalled WebView2 View Transition from waiting for pointer movement; physical owner-device acceptance remains open.
- Inlined the already-loaded stylesheet into isolated Settings simulations, eliminating repeated preview stylesheet requests and transient black frames.

### Planning
- Scoped the planned 0.3.0 experience update: a Focus-first UI redesign, optional intention and completion feedback, a compact running timer, four-edge Opaline taskbar placement, a live panel customiser, and versioned restart caches with measured performance budgets.
- Kept backdrop captures and live window thumbnails memory-only; pane-internal ordering remains manual.
- Added an Activity Center feasibility track: Opaline alert history, opt-in Windows notification mirroring with bounded encrypted retention, an offline `.ics` agenda, and a possible direct read-only Google Calendar connector with no Opaline backend.
- Planned a toggleable pane-like Activity Center with Notifications, Agenda and News modules, four-edge visual placement previews, alignment/size controls, and direct RSS/Atom feeds with no Opaline news backend.

## [0.2.2] — 2026-11-01 "Borosilicate"

### Added
- Pane members can be reordered in place and keep their order after the pane closes or Opaline restarts.
- One-shot Home sorting actions for A–Z, Z–A and most-used order.

### Changed
- Dragging at a tile edge now previews a between-items insertion with a stable acrylic line; the tile centre retains the existing create/add-to-pane action.

## [0.2.1] — 2026-10-29 "Borosilicate"

### Fixed
- Enabled WebView2 pinch input; the owner confirmed physical pinch reaches Opaline in the preview. Pinch-in/out moves backward/forward through the Alt+1–5 pages.
- Two-finger horizontal swipes follow Home screens and wrap in both directions. Outside Home, swipes leave the current main page unchanged.
- Swipe and pinch now move the visible page during the gesture and slide the destination into place at the threshold; a short gesture eases back.
- Smoothed gesture input frames and replaced the abrupt page handoff with one eased transition between the outgoing and incoming pages.
- Home gestures now move page content over stationary acrylic; shorter swipes register and complete more quickly.
- Search no longer takes focus when Opaline opens or changes pages. Press S to focus it; Home swipes wrap in both directions.
- Zen and screen saver reuse the saved launcher backdrop and acrylic material. The saver rotates gentle break prompts.

### Known issue
- Swipe and pinch navigation can still feel laggy or miss a short gesture on the owner's trackpad. Further input tuning and real-device profiling are tracked in W-51; keyboard, arrows and Home dots remain available.

## [0.2.0] — 2026-10-28 "Borosilicate"

### Added
- Four-icon header with All apps and Screen time left of search, Focus and Settings right; Home moved beside the bottom taskbar.
- Home sub-screens for saved collections, with Tab/Shift+Tab cycling and Alt+1–5 shortcuts for the five main pages.
- Read-only Desktop Home with dot-only navigation and two empty custom screens on a fresh profile.
- Full-page Settings with controls that apply as they change, plus screenshots of every section.
- Original illustrative blank-desktop screenshot showing hidden icons without personal desktop data.
- Workspace item picker with Windows app search, native folder/file selection and advanced path entry.
- Grouped daily charts with tighter bar spacing and a more compact Focus/Pomodoro layout and Zen presentation.
- 500 ms group/folder hover peeks with icon grids, bounded read-only folder listing and keyboard-focus access.
- Focus page with a configurable Pomodoro timer, completion graph, Zen reminders and an optional in-app idle screen saver.
- Seven- and thirty-day screen-time charts, per-app drill-down and a styled period menu backed by local daily history.
- Acrylic custom scrollbars with a width setting, plus a smaller bottom taskbar and larger app surface.
- Owner coding rules from the supplied screenshot in `AGENTS.md`.
- Named app/folder/file collections inside custom screens; Home-only side arrows, Ctrl+Tab page cycling and Ctrl+B compact mode.
- Touch and trackpad swipe/pinch page navigation on the launcher canvas.
- Local foreground maximised-app screen time: Today / All time, pause/resume and clear; idle and sleep gaps excluded.
- Reactivated the retained taskbar mirror at the bottom with a bounded decoded thumbnail cache, shared requests, background refresh and GDI downsampling before readback.
- Opt-in Windows-key tap opens All apps; off by default, preserving Windows chords, native Start-button click and Ctrl+Esc.
- Windows desktop handling for Opaline and its backdrop cache; real workspace/multi-monitor acceptance remains open.
- Group-origin popup motion, full two-line tile labels, scrollable grid edges, keyboard submenus/modal focus and stricter settings validation.
- Message-by-message work orders, Apple/Figma guidance notes, isolated checks and GitHub artwork using current appearance, familiar apps and synthetic folders.
- Full-screen overlay opened with Ctrl+Alt+Space, drawn over a blurred snapshot of the screen.
- Desktop items from the user and shared Desktop folders, with real shell icons.
- Search, keyboard navigation, tray icon, `--hidden` and `--pin` launch flags.
- Panes (groups) with automatic organisation, renaming, drag and drop and a context menu.
- Spatial canvas positioning for loose files, folders and panes, persisted across display sizes.
- Acrylic styling over the captured backdrop (superseding the earlier liquid-lens experiment).
- Transparent clear-canvas fast path and a short app-grid opening motion.
- One rounded apps surface with a centred, reorderable grid; loose apps are plain icon + name, while pane mini-icons sit inside one rounded bubble with the name below.
- A bottom Home button and a functional alphabetical Windows AppsFolder catalogue.
- A Reset grid order action that preserves pane membership and Desktop files.
- The previously disabled taskbar rail is reactivated at the owner's request; its lens remains dormant.
- Narrowed and centred the app surfaces; sparse grid rows stay aligned to the leftmost grid columns.
- A unified acrylic surface system with direct backdrop-blur, tint-strength and tint-colour controls.
- Rail: taskbar mirror with hover window previews.
- Windows 11 Taskband registry pins and packaged-app launch paths in the rail.
- Settings page covering the glass, layout, rail, behaviour, hotkey and launch at login.
- Unit tests for pane organization/storage, display names, icon pixel conversion and Taskband parsing.
- Tag-driven Windows release workflow for NSIS, MSI and portable ZIP artifacts with SHA-256 checksums.
- Project documentation: README, work orders, architecture/testing/releasing guidance, contribution and security policies, naming and CI.

### Changed
- Replaced the fabric-wave entrance with a small 200 ms grid pop; removed the obsolete entrance and page-shortcut settings.
- Extracted a stateful item picker and smaller keyboard handlers in line with the owner's coding standards.
- Reworked the demo into coherent IDE, dev tools, project, notes and reference groups; Android Studio now appears with VS Code.
- Removed the top-left page switcher and shutdown orb; centered plain arrows outside the app surface and placed matching All apps/Focus icons left of search and Screen time/Settings icons right of it.
- Removed the Opaline icon from the taskbar mirror, matched its height to search and hid its overflow scrollbar while keeping horizontal scroll available.
- Prefer larger window icons and limit optional hover magnification to reduce blur.
- Running taskbar apps prefer their window icon, with shortcut icons as fallback; the All apps dock button uses the Opaline mark.
- Startup registers readiness before Desktop/icon warming finishes and loads independent stores concurrently. Launch-at-login now shows its current state explicitly.
- Replaced the OS acrylic/blur window material with a self-rendered backdrop, so blur, tint and refraction are fully controllable.
- Clear mode now skips capture and opens as a transparent full-screen surface; frosted modes retain the snapshot fallback.
- Backdrop capture downsamples in GDI, lens maps are bounded and cached, and non-critical refreshes occur after first paint.
- Dock magnification pushes neighbouring icons apart to avoid clipping.
- Search and rail now read as independent floating surfaces; theme changes reuse the same hierarchy across popup, settings, previews and menus.
- Removed widget mockups; the taskbar mirror sits beside Home navigation.

### Notes
- Pre-release. Local TypeScript, frontend and Rust unit tests pass. Hotkey/focus, drag persistence, tray, installer and CI still need the
  real release acceptance pass —
  see [WORKORDER.md](WORKORDER.md#0-current-status) for the per-requirement status and the ordered next actions.
- Added for contributors: `AGENTS.md`, `docs/TESTING.md`, `docs/CODEX_PROMPT.md`, and `scripts/cdp.mjs` to drive the running app.

## History before 0.1.0

- **Beta 0 — WinUI 3 (failed, superseded).** First attempt with WinUI 3 / C#. Kept in `archive/winui3-beta/`; the story is in [DEVLOG.md](DEVLOG.md).
