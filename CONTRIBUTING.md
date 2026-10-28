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
| Taskbar mirror | `src-tauri/src/taskbar.rs` |
| Persistent files | `src-tauri/src/store.rs` |
| UI entry, open/close lifecycle, keyboard | `src/launcher.ts` |
| Tile grid, pane popup, drag & drop | `src/grid.ts` |
| Rail and hover previews | `src/rail.ts` |
| Panes (state) and auto-organise rules | `src/groups.ts`, `src/organize.ts` |
| Glass and lens | `src/glass.ts`, `src/launcher.css` |
| Settings (state) and the full Settings page | `src/settings.ts`, `src/panel.ts` |
| Home additions and shared app/folder picker | `src/home.ts`, `src/item-picker.ts` |
| Context menu · icon cache · Rust commands · DOM helpers | `src/menu.ts`, `src/icons.ts`, `src/api.ts`, `src/dom.ts` |
| Logo and generated icons | `assets/logo.svg`, `npm run icons` |

## Checks that must pass

```bash
npm run build                                   # type-check + production bundle
npm test                                        # frontend/store unit tests
cargo fmt --manifest-path src-tauri/Cargo.toml  # formatting
cargo clippy --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo check --manifest-path src-tauri/Cargo.toml
```

CI runs the same on every pull request. Then run through the relevant lines of the
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
- Tune with the settings, not magic numbers: new visual parameters should become a setting with a default and a place in the Settings page.

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

1. Update `CHANGELOG.md`, bump the version in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`.
2. Run the full acceptance checklist.
3. Tag `vX.Y.Z` and title the release `Opaline X.Y "Codename"` (codenames in [docs/NAMING.md](docs/NAMING.md)).

## License

By contributing you agree that your contribution is licensed under the project's [MIT license](LICENSE).
