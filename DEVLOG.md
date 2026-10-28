# Opaline dev log

Newest first.

## 2026-10-28 · 0.2.0 Borosilicate Home navigation preview

The owner simplified the hierarchy after reviewing the six-icon candidate. Home moved to the left of the bottom taskbar. Existing named collections, including Dev tools, are now Home screens reached with Tab and Shift+Tab; their saved `workspaces.json` data is retained. Four header destinations remain around search: All apps and Screen time on the left, Focus and Settings on the right. Alt+1–5 follows Home, All apps, Screen time, Focus, Settings. Ctrl+Tab switches those top-level pages.

The owner clarified that Home itself must be the Windows Desktop, read-only. Its item count, text pager and Add control were removed; the pager shows dots only. New installations begin with empty Screen 2 and Screen 3. App, folder and file additions belong to custom screens, through a stateful `ItemPicker` with Windows app search, native browsing, duplicate checks and save feedback. The obsolete direct-Home metadata path was deleted. Side arrows now cycle the Home screens, including custom screens, and disappear on other main pages. The keyboard path was split into popup focus, dismissal, page shortcuts and type-to-search handlers, following the standards in `AGENTS.md`.

Settings uses the main page surface and applies existing controls immediately, without a modal Done step. The fabric wave and its obsolete setting were removed. Only the already prepared app grid makes a roughly 200 ms upward pop, and reduced motion disables it. The demo gallery covers the main pages, custom screens and picker, all Settings sections, Focus modes, pane, compact taskbar and preview. An original synthetic blank-desktop illustration shows hidden icons without exposing the owner's wallpaper or notifications. Native Windows key routing, picker, login startup, virtual desktops, icon parity, timing and owner visual acceptance remain open before a draft PR.

The final isolated UI pass rendered 24 screenshots at 1280 × 800 and checked layouts down to 600 × 600. It exercised Home arrow and dot navigation, custom-screen persistence, app search, picker focus, Focus, screen time, Settings and cached preview presentation. The desktop preview process is running for owner testing; its real Windows interactions are still acceptance checks.

## 2026-10-28 · Workspaces, local screen time and retained taskbar

The owner requested named Alt+number spaces, maximised-app time, keyboard page switching, a compact bottom taskbar, faster cached previews, a Windows-key opt-in, smooth pane-origin motion, current appearance in realistic GitHub artwork, and a test-first draft PR. The complete intake is `docs/SESSION_WORKORDER.md`.

Reused the retained rail and Windows enumeration, moved it horizontally, added a 32-entry decoded preview cache with shared requests/background refresh, and moved thumbnail scaling into GDI before CPU readback. Native cold checks measured 66.5–131.6 ms; cached demo presentation measured 13–17 ms. No cold 50 ms claim is made.

Native usage sampling persists local executable/current-day totals while hidden, excluding idle and sleep gaps. Spaces live in their own metadata file. Windows virtual-desktop APIs move only Opaline and invalidate cross-desktop backdrop reuse. Windows-key routing is off by default and preserves shell recovery paths; real key/desktop acceptance remains open.

The owner's latest saved Appearance values were read without modification (10 px blur, 16% tint, small icons). Numbered corner controls replace the wide bottom page strip after a clipping report. Tile labels no longer shrink vertically or disappear beneath an unconditional fade mask. App icons in the demo artwork are recognisable public app identities; personal folder names and real screen captures are excluded.

Process inspection confirmed WebView2 already has Opaline as its parent; Task Manager's grouping is a separate presentation. The supported Tauri process model is retained. The branch and local commit are for owner testing; push/draft PR wait for the owner's test result.

## 2026-10-26 · Release-candidate hardening

Continued Beta 1 with two goals: make the common open path feel immediate and turn the repository into a publishable project.

- **Rail deferred.** The taskbar mirror remains in source but is deprecated to a later roadmap phase. The current build skips enumeration
  refreshes, thumbnails, rail lens work and the Rail settings section.
- **Focused pages.** Home and All Apps are the only active pages. Widget mockups were removed; widgets and calendar remain documented
  roadmap work. All Apps now enumerates the real Windows AppsFolder after first paint instead of repeating Desktop entries.

- **Transparent fast path.** Clear canvas now asks Rust to skip the screen capture and shows the transparent WebView directly. Frosted
  modes keep the snapshot path because WebView backdrop filters cannot reliably sample the Windows compositor behind the window.
- **Capture path.** Snapshot mode downsamples in GDI before readback, cutting the documented target from 2.3 million pixels to roughly
  0.55 million on the 16:10 target display. After hiding, Opaline refreshes and decodes the next backdrop while the window is invisible; a real debug warm-open
  measurement fell to 25.7 ms request-to-visible while the uncached path stayed below the 300 ms target.
- **Render path.** Desktop and Taskband refreshes happen after the first visible frame on warm opens. Lens work is batched, cached and
  bounded to 320 px maps; unrelated settings no longer rebuild every lens.
- **Centred grid.** Loose items, folders and panes can be reordered only in snapped grid cells and retain their order. Search temporarily returns
  to a compact grid without changing the saved layout.
- **Page scaffold.** Home shares a floating previous/next switcher with the alphabetical installed-app catalogue. Catalogue work remains
  off the visible-frame path.
- **Motion.** The toggleable entrance unfolds the complete, pre-arranged grid upward as one lightweight fabric layer. Large glass
  surfaces and individual tiles no longer animate independently, avoiding delayed content and expensive backdrop re-rasterisation.
  Reduced motion removes the sequence. Dock magnification pushes neighbours away so enlarged icons do not overlap or clip.
- **Surface hierarchy.** One rounded surface holds the centred app grid. Loose apps/folders use bare icon + name; panes put mini-icons
  inside one rounded bubble with the name below. Search and the rail remain independent floating surfaces.
- **Acrylic system.** The active UI now uses one consistent acrylic vocabulary. Appearance exposes backdrop blur, tint strength and tint
  colour; cards deliberately avoid per-item backdrop filters so visual tuning does not multiply GPU work.
- **Windows integration.** The rail reads Taskband registry order and packaged-app IDs as well as `.lnk` pins. The NSIS bundle places
  Opaline directly in the Start Menu, removes its unwanted Desktop shortcut, and keeps launch-at-login opt-in.
- **Quality and release.** Added frontend and Rust tests, release artifact automation, publishing metadata and release documentation.

The local automated gates are clean. Real hotkey/focus, pointer persistence, installer, multi-monitor and CI checks remain explicit
release blockers rather than being marked complete without observation. The acrylic bright/dark, persistence, reduced-motion and GPU
matrix in `docs/THEME_WORKORDER.md` is also required before the visual package is marked verified.

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
