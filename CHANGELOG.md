# Changelog

All notable changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com),
and the project uses [Semantic Versioning](https://semver.org). Each minor release has a glass-type codename
(see [docs/NAMING.md](docs/NAMING.md)).

## [Unreleased]

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
