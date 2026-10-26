# Opaline dev log

Newest first.

## 2026-10-26 · Beta 1 — Tauri v2, snapshot overlay (current)

Moved the launcher to Tauri v2 (Rust backend, TypeScript + CSS frontend) and, after the first Tauri cut, dropped OS
window materials altogether.

**Why the move** (see Beta 0 below for what went wrong):

- **Faster to iterate.** The UI hot-reloads; no stop-the-app, rebuild, relaunch loop for visual tweaks.
- **Cross-platform path.** Only icon extraction, the shared-desktop folder, window listing and capture are Windows-specific
  and sit behind `cfg(windows)`; a Linux port is realistic later.

**Why not acrylic/blur either.** The first Tauri cut used the same OS acrylic/blur as the WinUI beta, behind a transparent
window with a settings switch. Testing showed it still didn't look or behave well, and Windows gives no control over blur
radius. So the overlay now draws its own glass:

1. On the hotkey, Rust grabs a snapshot of the monitor *before* the overlay exists on screen.
2. The page shows it as a full-screen backdrop, blurred/tinted with CSS under the user's control.
3. Panes are glass cards with `backdrop-filter` plus a per-pane SVG displacement map (the "lens") for edge refraction.

Trade-off accepted: a live wallpaper is frozen while the overlay is open.

**Ported from Beta 0:** hotkey, desktop scan (user + shared), real shell icons (now through one serial STA worker with a
retry — the fix identified at the end of Beta 0), search, keyboard navigation.

**New:** panes with auto-organise, drag and drop, rename and a context menu; the rail (taskbar mirror) with window
previews; a settings pane; tray icon; single instance; launch-at-login option; rebindable hotkey; logo and icon set;
README, work order and contributor documents.

**Gotchas hit and solved**

- The Windows 260-character path limit broke Cargo's build scripts from this deeply nested folder (`LNK1104`);
  fixed with a short `CARGO_TARGET_DIR`.
- `backdrop-filter` can't see through an ancestor that has its own `filter`, `mask` or `backdrop-filter` (a "backdrop
  root"), so the popup layer is only dimmed, never blurred, and the grid is blurred as a sibling instead.
- Dev builds compile dependencies unoptimised; JPEG encoding and resizing took ~800 ms per window thumbnail. The dev
  profile now optimises dependencies, and the rail pre-loads thumbnails.

**Testing without touching the mouse.** The app is driven through WebView2's local debugging port from a small Node
script (evaluate, screenshot, key events), which also shows console errors.

**State when work paused (2026-10-26).** The app builds and runs; the overlay, icons, first-run panes, pane popup, settings pane,
context menu and rail all render correctly. The hotkey toggle, close paths (Esc / click-off / focus loss), drag and drop,
persistence, rail interactions, `cargo fmt`/`clippy` and CI have not been verified. The dev dependency optimisation and the rail's
thumbnail pre-loading were added after the last visual check. Everything outstanding, in order, is in
[WORKORDER.md](WORKORDER.md) §0 and §12; a ready-made prompt for continuing in Codex is in [docs/CODEX_PROMPT.md](docs/CODEX_PROMPT.md).

## 2026-10-25 · Beta 0 — WinUI 3 (failed, superseded)

Stack: WinUI 3 / C# on .NET 8, Windows App SDK 1.8, unpackaged and self-contained. Source is in
`archive/winui3-beta/`.

What worked

- Global hotkey (`RegisterHotKey`) toggling a borderless, always-on-top window.
- Desktop scan (user + shared desktop) and real icons through `IShellItemImageFactory`.
- Frosted acrylic via `DesktopAcrylicController`, glass icon plates, search pill, entrance animation.

What didn't

- **Glass control.** System acrylic has a fixed blur strength and only exposes tint / luminosity. First impression was
  "the window still isn't see-through"; making it clearer meant fighting the material rather than styling it.
- **Iteration speed.** Every visual change was stop app → `dotnet build` (~25 s) → relaunch.
- **Tooling friction.** A deeply nested project folder pushed the XAML compiler's generated paths past 260 characters
  (worked around by moving build output to a short path, which then compiled stale `obj/` files until it was excluded);
  `required`/`init` members broke the XAML compiler's generated type info; the first package restore took about 3.5 minutes.
- **Hard to test.** The window hides on focus loss, so screenshots raced focus. A `--pin` flag fixed that late.
- **Flaky icons.** Extracting ~45 icons concurrently made the shell fail some of them intermittently. The fix (one STA
  worker, one request at a time, retry once) was identified but not applied before the switch; Beta 1 ships it.
- **Windows only.** No route to Linux.

Takeaways carried forward: serial icon worker, `--pin` for testing, premultiplied-alpha icon handling, and the visual
design (glass plates, rim light, centered search pill), which was ported to CSS.

## Name

Working name: **Opaline** (opaline glass is the milky, translucent kind). Not checked for trademark, domain or
package-name availability yet.
