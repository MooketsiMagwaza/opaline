# Testing Opaline

Opaline is a visual, interactive, full-screen app, so most checking happens against the running app. This page explains how to run
it, how to drive it without touching your mouse, and what a good check looks like. The release checklist is
[WORKORDER §9](../WORKORDER.md#9-acceptance-checklist-run-before-every-release).

## 1. Run it for development

```powershell
# PowerShell, from the repo root
$env:CARGO_TARGET_DIR = "$env:LOCALAPPDATA\opaline-target"   # short build path (see AGENTS.md)
$env:OPALINE_PIN = "1"                                       # don't hide when focus is lost
npm run tauri dev
```

The first build compiles Tauri and its dependencies (several minutes); later ones are incremental. The overlay opens by itself on
start-up. Close it with **Esc**, quit with **Ctrl+Q** or the tray icon's *Quit*.

Clear canvas is the fast path: the transparent window opens without taking a screenshot. Turn **Clear canvas** off when validating the
snapshot timing; debug builds print `opaline: backdrop capture took ...` to the terminal. Measure both paths separately.

## 2. Drive the page over the DevTools protocol

WebView2 can expose Chrome's DevTools protocol on a local port. Start the app with it on, then use `scripts/cdp.mjs`:

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222 --remote-allow-origins=*"
npm run tauri dev
```

This is **local and development-only**. Any local process can control the page while the port is open, so never ship with it and
stop the app when you are done. You can also open `http://127.0.0.1:9222` in Edge or Chrome to inspect the page by hand.

Write a JSON file of steps and run it (node 22+, no dependencies):

```powershell
node scripts/cdp.mjs steps.json out
```

| Step | Does |
|---|---|
| `{ "eval": "js expression" }` | evaluates in the page (awaits promises) and prints the JSON result; exceptions are reported |
| `{ "shot": "name" }` | saves `out/name.png` — the page as rendered, including blur and lens |
| `{ "key": "Escape" }` | dispatches a key press |
| `{ "wait": 500 }` | sleeps |

Console messages and exceptions from the page are printed at the end. Example — open the first pane and confirm Esc closes it:

```json
[
  { "wait": 1500 },
  { "eval": "document.querySelector('.pane-tile').click(); 'opened'" },
  { "wait": 600 },
  { "eval": "({ open: document.getElementById('popup').classList.contains('open'), name: document.querySelector('.pane-name').value })" },
  { "shot": "popup" },
  { "key": "Escape" },
  { "wait": 400 },
  { "eval": "document.getElementById('popup').classList.contains('open')" }
]
```

Tips

- Call the Rust commands directly from an `eval`:
  `(async () => { const { api } = await import('/src/core/api.ts'); return (await api.rail()).map(i => i.name); })()`.
- Hover effects need real events: `el.dispatchEvent(new PointerEvent('pointerenter'))`. Context menu:
  `el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }))`.
- Write the steps file **without a byte-order mark** (PowerShell 5.1's `Set-Content -Encoding UTF8` adds one and `JSON.parse` fails).
  Use `[System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding $false))`.
- Screenshots of the real app contain your folder and app names. Keep them out of commits.
- Tests that change panes edit your real `groups.json`. Undo what you did (for example press the popup's *Ungroup* on a pane you
  created) before you finish.

## 3. What the page driver can't check

Use the real keyboard and mouse for: the **global hotkey**, whether the overlay **takes focus** when the hotkey is pressed from another
app, **focus-loss hiding** (run without `OPALINE_PIN`), the **tray icon**, **single-instance** wake-up (launch the exe twice), **launch at
login**, true drag and drop between tiles, and anything involving a second monitor.

## 4. Whole-screen captures

To see the overlay as the user does (full screen), find the window titled `Opaline` for the `opaline` process, then copy its rectangle
from the screen. Mark your capture script DPI-aware first (`SetProcessDPIAware`) or the rectangle will be wrong on scaled displays.

## 5. Checks to run before a pull request

Everything automated below runs against demo data and mocked native calls; none of it replaces the owner's checks on real Windows. For 0.3.0,
use the native acceptance list in [§11 of V0_3_WORKORDER.md](V0_3_WORKORDER.md#11-verification-matrix) and the owner checklist in
[SESSION_WORKORDER.md](SESSION_WORKORDER.md) (a historical record of the 0.2 intake whose remaining Windows checks still apply). W-51 records swipe and pinch lag on the
owner's trackpad; keep it open until a physical retest passes.

**Unit tests.** `npm test` runs the Vitest suite in `tests/` (64 Vitest unit tests: organisation, groups, drag order, settings and staged drafts, workspaces, the Focus timer,
chart axes, hover intent, refraction and user presets). `cargo test` runs the Rust tests (18: display names, pixels, Taskband matching, app identity and usage attribution).

**Size budgets.** After `npm run build`, `npm run size` (`scripts/measure-build.mjs`) enforces 220 KiB raw and 62 KiB gzip for the frontend and reports the native artifact sizes.

**Documentation.** `npm run docs:check` (`scripts/check-docs.mjs`, no dependencies) fails when a Markdown link, image or named path is broken, a version, test count or size budget quoted in prose disagrees with the code, or a Rust module, native command, source folder or Settings section is missing from the docs. Update the document it names, not the check.

**Browser UI suite.** `scripts/verify-ui.mjs` drives the Vite page in an isolated headless browser with demo fixtures and mocked native calls. It covers: navigation by header,
taskbar, tray, Taskbar ends and sidebar; Alt+1–5; Home screens with the plus page, add, rename and remove; the read-only Desktop Home; Windows app search and the simulated picker;
pinch and two-finger swipe routing with wraparound, live preview and cancellation; consecutive swipes; hover intent for the tray, previews and pane peeks; the taskbar at every edge
and alignment (preview direction, clearance, scrolling); Settings as a panel (staged Done and Cancel, grey-out, expand, six sections, previews, help); presets and light bending
(a pixel-diff against the flat render); page fades and their toggle; compact mode; screen-time and Focus charts with axes; timer, Zen, screen saver, reduced motion and
responsive layout. It regenerates the public screenshots in `docs/images/` from synthetic folder, preview and usage data, and writes `ui-verification.local.json`
(git-ignored). `scripts/capture-blank-desktop.mjs` renders the separate blank-desktop illustration.

To run it, start Vite (`npm run dev`, port 1420), then run `node scripts/verify-ui.mjs`. Playwright is not a dependency of the repo: provide it through Node resolution or
`OPALINE_PLAYWRIGHT_MODULE`, point `OPALINE_BROWSER_PATH` at an installed Chromium, Chrome or Edge, and set `OPALINE_VERIFY_URL` if Vite is not on port 1420. A real run
overwrites the tracked screenshots, so review `git status` afterwards. The suite retries its gesture-preview helper and prints a warning when it does; repeated failures are not
expected. See [UI_GUIDANCE.md](UI_GUIDANCE.md) for app-icon attribution. Headless Chrome cannot verify real touch or trackpad events, WebView2 rendering, taskbar icon parity,
Windows-key routing, virtual desktops, idle wake or login startup.

For native checks, debug builds accept an absolute `OPALINE_TEST_DATA` directory. This isolates both the JSON stores and WebView2 profile, disables legacy-store migration, and is ignored in release builds. Seed `groups.json` with `organized: true` to avoid first-run grouping, and use `--hidden --pin` for API checks without occupying the screen. `scripts/verify-native.mjs` reads live app/catalogue/taskbar/usage/hook data and measures cold captures. Its optional `--isolated-persistence` mutations require `{ "testProfile": true }` in that isolated `config.json`; it refuses to run them without the marker. The optional `--export-demo-icons` exports only a fixed list of public app identities, with no install paths in the manifest. Stop the debug process when finished; never ship its remote-debugging switch.

```bash
npm run build
npm test
cargo fmt   --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets
cargo test --manifest-path src-tauri/Cargo.toml --locked
cargo check --manifest-path src-tauri/Cargo.toml --locked
```

Plus the relevant lines of the acceptance checklist, run for real.
