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
  `(async () => { const { api } = await import('/src/api.ts'); return (await api.rail()).map(i => i.name); })()`.
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

For this candidate, run the owner checklist in [SESSION_WORKORDER.md](SESSION_WORKORDER.md) before creating the draft PR. Browser/demo checks do not replace the real Windows-key, virtual-desktop, pointer, installer and CI gates.

`scripts/verify-ui.mjs` uses an isolated browser context and mocked native calls to check four-icon navigation, Alt+1–5, dot-only Home screens, read-only Desktop Home, custom-screen additions, Windows app search and simulated picker selection, workspace persistence, popup geometry, popup focus, full-page Settings, compact mode, 500 ms icon-grid pane/folder peeks, taskbar scrollbar and height, grouped screen-time and Focus charts, timer, Zen, saver, reduced motion and responsive layout. It regenerates public UI screenshots with saved appearance values and synthetic folder/preview/usage data. `scripts/capture-blank-desktop.mjs` renders a separate original blank-desktop illustration as PNG. Start Vite first; provide Playwright through Node resolution or `OPALINE_PLAYWRIGHT_MODULE`, and optionally `OPALINE_BROWSER_PATH` for an installed Chromium/Edge binary. See [UI_GUIDANCE.md](UI_GUIDANCE.md) for app-icon attribution. These checks cannot verify real Windows taskbar icon parity, Win-key routing, virtual desktops, idle wake or login startup; use the owner test in `SESSION_WORKORDER.md` for those.

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
