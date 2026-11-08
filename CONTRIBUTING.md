# Contributing to Opaline

Thanks for helping. This guide gets you from clone to pull request.

## Before you start

1. Read the [README](README.md) and the [work order](WORKORDER.md). Every feature has a requirement ID (`R-xx`) and a work package (`WP-n`) — pick one that isn't done, or open an issue to propose something new.
2. For anything bigger than a small fix, **open an issue first** so we can agree on the approach before you write code.
3. Be kind. This project follows the [code of conduct](CODE_OF_CONDUCT.md).

## Setting up

Prerequisites: Windows 11, Node.js 20+, Rust stable with the MSVC toolchain, WebView2 (see the README).

```bash
git clone https://github.com/YOUR-ACCOUNT/opaline.git
cd opaline
npm install
npm test
npm run tauri dev        # UI hot-reloads; Rust changes rebuild automatically
```

Useful while developing:

- `OPALINE_PIN=1` (or `--pin`) stops the overlay hiding when it loses focus, so you can inspect it and take screenshots.
- Debugging the page: set `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` before `npm run tauri dev`, then open `http://127.0.0.1:9222` in Edge or Chrome to inspect the overlay. It is a local, development-only switch; never ship with it.
- If the build fails with `LNK1104` from a deeply nested folder, set `CARGO_TARGET_DIR` to a short path (README).
- The UI is plain TypeScript + CSS — no framework. Keep it that way unless there is a strong reason.

## Project map

| Area | Files |
|---|---|
| Window lifecycle, hotkey, tray, commands | `src-tauri/src/lib.rs` |
| Screen & window capture | `src-tauri/src/capture.rs` |
| Desktop scan | `src-tauri/src/desktop.rs` |
| Icons (one STA worker) | `src-tauri/src/icons.rs` |
| App names and icons as Windows shows them (package family, Start menu, file details) | `src-tauri/src/identity.rs` |
| Installed apps, screen time, idle, workspaces, pickers, Windows key | `src-tauri/src/apps.rs`, `usage.rs`, `idle.rs`, `workspace.rs`, `picker.rs`, `start_menu.rs` |
| Startup log and panic hook (what a login start leaves behind) | `src-tauri/src/startup_log.rs` |
| Taskbar mirror (native side) | `src-tauri/src/taskbar.rs` |
| Persistent files | `src-tauri/src/store.rs` |
| UI entry, open/close lifecycle, keyboard | `src/app/launcher.ts` |
| Tile grid and pane popup | `src/grid/index.ts` |
| Grid drag/drop and folder/pane peeks | `src/grid/drag.ts`, `src/grid/peek.ts` |
| Taskbar mirror, hover previews and edge placement | `src/taskbar/index.ts`, `src/taskbar/taskbar.css` |
| Pages, navigation arrangements, gestures and their motion | `src/navigation/pages.ts`, `tray.ts`, `gestures.ts`, `gesture-motion.ts` |
| Panes (state) and data-driven auto-organise rules | `src/grid/groups.ts`, `src/grid/organize.ts`, `src/grid/organize-rules.ts` |
| Focus controller, ambient modes and timer rules | `src/focus/index.ts`, `src/focus/ambient.ts`, `src/focus/timer.ts` |
| Shell styles | `src/app/launcher.css` |
| Light-bending glass (physics and the per-element SVG filter) | `src/core/refraction.ts`, `src/core/glass.ts` |
| Page fades and hover intent | `src/core/motion.ts`, `src/core/hover-intent.ts` |
| Feature styles | `src/focus/focus.css`, `src/grid/grid.css`, `src/appearance/appearance.css`, `src/navigation/navigation.css`, `src/settings/settings.css` |
| Settings state, staged draft and the Settings panel | `src/settings/store.ts`, `src/settings/draft.ts`, `src/settings/panel.ts` |
| Live Settings preview and the Shortcuts & help page | `src/settings/launcher-preview.ts`, `src/settings/help.ts`, `src/data/shortcuts.ts` |
| Built-in and user visual presets, backgrounds | `src/appearance/presets.ts`, `src/appearance/user-presets.ts`, `src/appearance/background.ts` |
| Screen-time page and charts | `src/activity/index.ts`, `src/activity/charts.ts` |
| Home additions and shared app/folder picker | `src/grid/workspaces.ts`, `src/grid/item-picker.ts` |
| Context menu · icon cache · Rust commands · DOM helpers | `src/core/menu.ts`, `src/core/icons.ts`, `src/core/api.ts`, `src/core/dom.ts` |
| Logo and generated icons | `assets/logo.svg`, `npm run icons` |

## Checks that must pass

```bash
npm run build                                   # type-check + production bundle
npm test                                        # frontend/store unit tests (Vitest, in tests/)
npm run size                                    # production size budgets (220 KiB raw / 62 KiB gzip)
npm run docs:check                              # docs agree with the code: links, paths, versions, test counts, budgets
cargo fmt --manifest-path src-tauri/Cargo.toml  # formatting
cargo clippy --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo check --manifest-path src-tauri/Cargo.toml
```

CI runs the same on every pull request. For anything that changes the UI, also run the browser suite (`scripts/verify-ui.mjs`, demo data only; Playwright is
not a dependency, see [docs/TESTING.md](docs/TESTING.md) for how to point it at a browser). Then run through the relevant lines of the
[acceptance checklist](WORKORDER.md#9-acceptance-checklist-run-before-every-release) by hand — the overlay is a visual,
interactive app and not everything can be tested automatically.

## Code guidelines

- **Match the surrounding code**: naming, comment density, idiom. Comments explain *why*, not what.
- **Platform code stays isolated.** Anything Windows-specific goes behind `#[cfg(windows)]` with a harmless `#[cfg(not(windows))]` fallback, so the project keeps compiling elsewhere.
- **Never touch the user's files.** Opaline reads the Desktop; it does not move, rename or delete anything there.
- **No network access**, no telemetry, no remote code. If a feature needs one, discuss it in an issue first.
- **Shell icon calls go through the single icon worker.** Do not extract icons from several threads at once — it loses icons (this sank the first beta, see [DEVLOG.md](DEVLOG.md)).
- **Keep the glass cheap.** `backdrop-filter` is expensive on integrated GPUs. Use it on large panes, not on every tile, and make sure *Clear* and *Frost* still look right.
- Respect `prefers-reduced-motion`, keep everything reachable by keyboard, and keep text readable over any wallpaper.
- Tune with the settings, not magic numbers: new visual parameters should become a setting with a default in `src/settings/store.ts` and a control in the Settings panel.

## Commits and pull requests

- [Conventional Commits](https://www.conventionalcommits.org): `feat(panes): rename in the popup header`. Types and scopes are listed in [docs/NAMING.md](docs/NAMING.md).
- One logical change per pull request. Reference the requirement IDs (`Refs: R-06, WP3`).
- Update [WORKORDER.md](WORKORDER.md) statuses and [CHANGELOG.md](CHANGELOG.md) (`Unreleased`) in the same PR. Only mark an item `[x]` once you have verified it.
- Include a screenshot or short recording for any visual change, and say which Windows build and GPU you tested on.
- Keep the PR description honest: what you tested, what you didn't.

## Reporting bugs and asking for features

Use the issue templates. For bugs, include your Windows version, display scaling, whether a live wallpaper is running, and the contents of the app's console if you can (`npm run tauri dev`).

Security issues: **don't** open a public issue — see [SECURITY.md](SECURITY.md).

## Releases (maintainers)

1. Update `CHANGELOG.md` and bump the version everywhere it lives (the manifests, both lockfiles, the codename in `lib.rs`, the README's latest-release line and the UI suite's status fixture); the full list is step 3 of [docs/RELEASING.md](docs/RELEASING.md).
2. Run the full acceptance checklist.
3. Tag `vX.Y.Z` and title the release `Opaline X.Y "Codename"` (codenames in [docs/NAMING.md](docs/NAMING.md)).

## License

By contributing you agree that your contribution is licensed under the project's [MIT license](LICENSE).
