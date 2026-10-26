# AGENTS.md — guide for coding agents working on Opaline

Opaline is a Windows-first desktop launcher built with **Tauri v2** (Rust backend, plain TypeScript + CSS UI). It opens a
full-screen frosted-glass overlay on a hotkey, showing the user's Desktop items grouped into panes, a taskbar-mirror rail with
window previews, and a settings pane. Read these, in order, before changing anything:

1. [WORKORDER.md](WORKORDER.md) — §0 what is verified, §2 requirements, §12 **next actions**, §13 known issues.
2. [DEVLOG.md](DEVLOG.md) — why decisions were made, including the failed WinUI 3 beta and what was learned.
3. [docs/TESTING.md](docs/TESTING.md) — how to run and drive the app without touching the user's mouse.
4. [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/NAMING.md](docs/NAMING.md) — conventions, vocabulary, commit format.

## Commands

```bash
npm install
npm run tauri dev          # app with hot-reloading UI; Rust changes rebuild automatically
npm run build              # tsc + vite production bundle (the type-check)
npm run icons              # re-rasterise assets/logo.svg and regenerate src-tauri/icons
cargo fmt   --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets
cargo check --manifest-path src-tauri/Cargo.toml --locked
```

## Environment gotchas (Windows)

- **260-character path limit.** From a deeply nested folder, Cargo build scripts fail with `LNK1104`. Build from a short folder or
  set `CARGO_TARGET_DIR` to a short path first (PowerShell: `$env:CARGO_TARGET_DIR = "$env:LOCALAPPDATA\opaline-target"`). Do not
  change the system long-path setting.
- **PowerShell 5.1** is the default shell: no `&&`, `Set-Content -Encoding UTF8` writes a BOM (breaks JSON), and its file APIs can't
  open paths over 260 characters (use `[System.IO.File]::…('\\?\' + $path)`).
- `OPALINE_PIN=1` (or `--pin`) stops the overlay hiding on focus loss. Use it for any visual work.
- The overlay is **full-screen and always on top**. If it ever traps the screen: the tray icon's *Quit*, `Ctrl+Q`, or end the
  `opaline` process.
- Starting `tauri dev` twice, or leaving a stale instance, makes the single-instance plugin hand over to the old process. Stop old
  `opaline`, `node` (vite) and `cargo` processes first. Port 1420 is the dev server.

## Rules of the road

- **Never touch the user's Desktop files.** Opaline reads them; panes are metadata in `groups.json`. Tests must not move, rename or
  delete anything on a real Desktop, and must restore any pane changes they make to the user's real data.
- **No network access, no telemetry.** The snapshot and window thumbnails stay in memory.
- **Do not enable launch-at-login** or change any system setting while testing; the control exists for the user.
- **Icon extraction goes through the single worker** in `icons.rs`. Concurrent shell icon calls lose icons (this sank the first beta).
- **Platform code stays isolated** behind `cfg(windows)` with a non-Windows fallback.
- **`backdrop-filter` rule:** glass panes must not sit inside an element with `filter`, `mask`, `opacity < 1`, `clip-path` or its own
  `backdrop-filter`, or they will blur nothing (see WORKORDER §3).
- Keep glass cheap: large panes only, never one `backdrop-filter` per tile. Frost and Clear must still look right.
- New visual parameters become **settings** (default in `settings.ts`, a control in `panel.ts`), not magic numbers.
- Match the surrounding code: naming, comment density, idiom. Comments say *why*.
- **Statuses are honest.** Mark a work-order item `[x]` only after you have seen it work, and say how in the Notes column. Update
  `CHANGELOG.md` (Unreleased) and `WORKORDER.md` in the same change.
- Screenshots of the real app show the owner's folder and app names. Do not commit them; use demo data for README images.
- Don't push, publish, or create remote repositories unless the owner explicitly asks.

## Layout

```
src/            UI: launcher.ts (entry) grid.ts rail.ts panel.ts groups.ts organize.ts glass.ts settings.ts menu.ts icons.ts api.ts dom.ts launcher.css
src-tauri/src/  Rust: lib.rs capture.rs desktop.rs icons.rs taskbar.rs store.rs
scripts/        make-icons.mjs (logo → icons) · cdp.mjs (drive the running app over the DevTools protocol)
assets/         logo.svg (+ generated PNG)
archive/        winui3-beta — the failed first attempt, kept for reference only; do not build or extend it
docs/           NAMING.md · TESTING.md · CODEX_PROMPT.md
```

## Definition of done for a change

`npm run build`, `cargo fmt --check`, `cargo clippy` and `cargo check` are clean · the relevant lines of WORKORDER §9 were exercised
for real · statuses and changelog updated · no personal data in the diff · the PR/commit says what was and wasn't tested.
