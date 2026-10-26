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
- Liquid-glass styling with lens refraction, plus Frost and Clear styles.
- Rail: taskbar mirror with hover window previews.
- Settings pane covering the glass, layout, rail, behaviour, hotkey and launch at login.
- Project documentation: README, work order, contributing guide, code of conduct, security policy, naming scheme, CI.

### Changed
- Replaced the OS acrylic/blur window material with a self-rendered backdrop, so blur, tint and refraction are fully controllable.

### Notes
- Pre-release. The app builds and runs; the overlay, icons, first-run panes, popup, settings pane, context menu and rail render.
  The hotkey toggle, the close paths, drag and drop, persistence, rail interactions and CI are not yet verified —
  see [WORKORDER.md](WORKORDER.md#0-status-at-pause) for the per-requirement status and the ordered next actions.
- Added for contributors: `AGENTS.md`, `docs/TESTING.md`, `docs/CODEX_PROMPT.md`, and `scripts/cdp.mjs` to drive the running app.

## History before 0.1.0

- **Beta 0 — WinUI 3 (failed, superseded).** First attempt with WinUI 3 / C#. Kept in `archive/winui3-beta/`; the story is in [DEVLOG.md](DEVLOG.md).
