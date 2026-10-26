# Changelog

All notable changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com),
and the project uses [Semantic Versioning](https://semver.org). Each minor release has a glass-type codename
(see [docs/NAMING.md](docs/NAMING.md)).

## [Unreleased] — 0.1.0 "Annealed"

### Added
- Full-screen overlay opened with Ctrl+Alt+Space, drawn over a blurred snapshot of the screen.
- Desktop items from the user and shared Desktop folders, with real shell icons.
- Search, keyboard navigation, tray icon, `--hidden` and `--pin` launch flags.
- Panes (groups) with automatic organisation, renaming, drag and drop and a context menu.
- Spatial canvas positioning for loose files, folders and panes, persisted across display sizes.
- Acrylic styling over the captured backdrop (superseding the earlier liquid-lens experiment).
- Transparent clear-canvas fast path and a toggleable fabric-unfold entrance that animates one lightweight content layer rather than every glass surface.
- One rounded apps surface with a centred, reorderable grid; loose apps are plain icon + name, while pane mini-icons sit inside one rounded bubble with the name below.
- A floating page switcher with Home and a functional alphabetical Windows AppsFolder catalogue.
- A Reset grid order action that preserves pane membership and Desktop files.
- Temporarily feature-flagged the taskbar rail off, including its refresh, thumbnails, lens and settings section.
- Narrowed and centred the app surfaces; sparse grid rows stay aligned to the leftmost grid columns.
- A unified acrylic surface system with direct backdrop-blur, tint-strength and tint-colour controls.
- Rail: taskbar mirror with hover window previews.
- Windows 11 Taskband registry pins and packaged-app launch paths in the rail.
- Settings pane covering the glass, layout, rail, behaviour, hotkey and launch at login.
- Unit tests for pane organization/storage, display names, icon pixel conversion and Taskband parsing.
- Tag-driven Windows release workflow for NSIS, MSI and portable ZIP artifacts with SHA-256 checksums.
- Project documentation: README, work orders, architecture/testing/releasing guidance, contribution and security policies, naming and CI.

### Changed
- Replaced the OS acrylic/blur window material with a self-rendered backdrop, so blur, tint and refraction are fully controllable.
- Clear mode now skips capture and opens as a transparent full-screen surface; frosted modes retain the snapshot fallback.
- Backdrop capture downsamples in GDI, lens maps are bounded and cached, and non-critical refreshes occur after first paint.
- Dock magnification pushes neighbouring icons apart to avoid clipping.
- Search and rail now read as independent floating surfaces; theme changes reuse the same hierarchy across popup, settings, previews and menus.
- Removed the widget mockups and deprecated the taskbar rail from the active interface to keep the launcher focused.

### Notes
- Pre-release. Local TypeScript, frontend and Rust unit tests pass. Hotkey/focus, drag persistence, tray, installer and CI still need the
  real release acceptance pass —
  see [WORKORDER.md](WORKORDER.md#0-current-status) for the per-requirement status and the ordered next actions.
- Added for contributors: `AGENTS.md`, `docs/TESTING.md`, `docs/CODEX_PROMPT.md`, and `scripts/cdp.mjs` to drive the running app.

## History before 0.1.0

- **Beta 0 — WinUI 3 (failed, superseded).** First attempt with WinUI 3 / C#. Kept in `archive/winui3-beta/`; the story is in [DEVLOG.md](DEVLOG.md).
