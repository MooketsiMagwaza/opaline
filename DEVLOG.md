# Opaline dev log

Newest first.

## 2026-11-04 · Review pass, gesture motion, hover intent and the settled 0.3.0 scope

The unreleased 0.3 work was reviewed end to end on branch `feat/v0.3-experience`: five confirmed bugs (Focus Space handling, a never-started session being recordable as finished, Done reverting live edits, preset id collisions, silent save failures) and several smaller ones were fixed and are covered by the UI suite and unit tests.

Swipe and pinch were reworked. The preview is now driven by three custom properties and only transform/opacity; a swipe moves just the Home content over stationary glass (nothing clips), a pinch zooms the page and cross-zooms into the destination, and a commit navigates at once while a ghost clone animates out. View Transitions were dropped: they morph geometry, clip differently and can stall in WebView2 until the pointer moves. Motion in flight no longer blocks the next gesture.

Popups gained shared hover-intent rules (`core/hover-intent.ts`): a safe-triangle plus distance test keeps a popup open while the pointer travels to it along a diagonal path, and once one popup is open its neighbours open at once. The navigation tray became a real dropdown. While testing, the launcher stage turned out to be scrollable because of its oversize blurred backdrop, so a focus could shift the whole UI by about 10 px; it now clips. The raw code budget is 190 KiB (gzip unchanged at 60 KiB; 52.2 KiB used).

The 0.3.0 scope is settled in `docs/V0_3_WORKORDER.md` §0: what is built ships; completion feedback goes to 0.3.x, taskbar placement, the customiser and the restart cache to 0.4.0, and the Activity Center to 0.5.0. Everything above was verified in headless Chrome only; the physical trackpad, WebView2 and the native checklist remain the owner's acceptance steps.

## 2026-11-02 · Settings and input quality pass

The owner asked for the 0.3 bootstrap to stop treating one full Home simulation as the answer to every Settings task. Settings now takes
nearly the full launcher window, with a shorter heading and compact bottom Cancel/Done buttons. The real Home simulation appears only in
Appearance, Home layout, Navigation and Taskbar. Screen time and Home screens keep their working area, while Panes has a dedicated looping
open-from-tile demonstration driven by the staged motion duration. Focus timing, break, Zen and Quiet Clock preferences moved onto the
Focus page itself.

Home and All apps now support type-to-search: the first printable key focuses Search and becomes the first query character. Search remains
out of the way on Focus, Settings, menus and text controls. The precision-touchpad recogniser no longer guesses whether a rising delta is a
new stroke. It consumes a committed tail until 240 ms of quiet, and page navigation has a separate 280 ms safety release for the WebView2
case where `ViewTransition.finished` waits for mouse movement before resolving. Automated replay covers a decaying forceful tail and a
second swipe without pointer movement; physical owner-device feel still requires confirmation.

Appearance now owns an Opaline-specific background choice: current Desktop, the bundled original Opaline Aero landscape, or a custom image
downsampled and compressed locally before persistence. Frutiger Aero selects that landscape as part of its full preset recipe. Preview
iframes receive the already-loaded stylesheet inline, avoiding repeated stylesheet calls and the transient black/ghost frames seen when
seven simulations loaded together. The bundled landscape was reduced from 347.9 KiB at 1672×941 to 138.8 KiB at 1280×720. The measured
frontend is 171.3 KiB raw / 48.6 KiB gzip for code and UI, plus the bounded raster asset; code and total-package budgets are reported
separately.

## 2026-11-02 · 0.3 implementation starts with Focus, presets and module boundaries

Implementation began without changing the 0.2.2 manifest version. Focus now separates pure timer transitions, ambient/quiet modes and
DOM control, with finish and skip intentionally accounting for sessions differently. The page has an intention, explicit timer state,
duration controls, summaries and a compact active-session capsule. Grid hover previews and drag/drop moved into their own controllers,
Focus styling moved out of `launcher.css`, and organise categories became typed static data instead of controller-embedded rules.

Appearance now offers six named Opaline-native starting points and a local collection of user-named visual/layout presets. A user
preset captures acrylic values, sizing, labels, rail and compact-bar choices; collections import and export as a validated versioned
JSON document. No backend, dependency or background request was added. Preview cards deliberately use ordinary gradients rather than
one backdrop-filter each.

Navigation now has three live arrangements: the original split header, a compact destination taskbar beside Home, and a dropdown tray.
Pin switches keep selected destinations primary and move the rest to overflow; Alt+1–5 remains available. The Settings previews and
applied launcher controls use the same Opaline tokens. Focus, Grid, Appearance and Navigation each own their CSS and a feature README;
`launcher.css` is being reduced to shared shell and material rules rather than remaining the owner of every screen.

The owner rejected abstract preview diagrams and automatic Settings writes. Appearance and Navigation cards now simulate the proposed
layout over the current in-memory backdrop with the saved panel proportion; no image enters local storage or exported presets. Settings
uses an in-memory draft with a sticky Done/Cancel boundary. Browser acceptance verifies that an uncommitted navigation change leaves
the launcher unchanged, Done applies it, and Cancel restores the saved selection.

The first simulation still layered a generic panel/search diagram over every card and the built-in presets changed only blur and tint,
so the owner correctly reported ghosted previews and themes that were not meaningfully distinct. The renderer now uses one miniature
launcher over the current memory-only backdrop, populated with the session's loaded app and taskbar icon images. Each built-in carries a
complete material recipe and an explicit material profile. Windows Mica is flatter, 90% opaque, low-blur and 12 px rounded; One UI,
Apple Glass, Frutiger Aero, Deep Night and Opaline Original each have separate surface/shadow/highlight behavior. Automated coverage
checks six unique preview recipes, the absence of the discarded outer ghost layer, real preview images and the applied Mica variables.

The owner isolated the long-standing gesture miss: after one horizontal trackpad swipe, another swipe did not register until the mouse
moved, while pinch continued to work. The wheel controller kept its swipe burst locked for 350 ms and extended that lock with the
touchpad's inertial tail; changing to pinch reset the mode, explaining why pinch escaped the stale state. The candidate now treats
120 ms of wheel silence as the physical burst boundary and 160 ms as a new-burst gap. Browser acceptance performs two same-direction
Home swipes back-to-back after only the page transition, with no mouse movement. W-51 remains partial until the owner confirms this on
the physical trackpad.

The first re-arm candidate exposed the opposite failure on a forceful swipe: its inertial tail could survive the 120 ms timer and be
interpreted as another page movement after the View Transition. The recogniser now handles committed input before asking whether the
page is temporarily navigable, consumes the entire decaying tail with a 560 ms quiet fallback, and recognises a new stroke from a
direction change or rising impulse. The browser check injects a large swipe plus eight decaying events across the transition and asserts
one move, then sends a new same-direction stroke without mouse movement and asserts the second move.

The owner also rejected the remaining preview cards as diagrams rather than screen simulations. Appearance and Navigation now share an
isolated 1280 × 800 copy of the real Home DOM and compiled launcher stylesheet, including the current wallpaper, live tiles/panes, labels,
search/header/panel/Home controls and taskbar. Draft navigation/material state is applied only inside that frame; no substitute SVG diagram
is used. One larger simulation stays visible above every Settings
section and updates immediately while the real launcher remains unchanged until Done. Settings navigation was separated into Appearance,
Home layout, Navigation and Taskbar so presentation, ordering, Opaline destinations and the Windows app mirror have distinct homes.

The partial feature migration was completed for TypeScript: `src` now contains only its architecture README, and runtime modules live in
`app`, `core`, `activity`, `appearance`, `focus`, `grid`, `navigation`, `settings` or `taskbar`. Activity and Taskbar CSS also moved out of
the shell. Each area now documents functionality, public exports, state/data flow, dependencies, invariants and extension points with
Mermaid diagrams; contributor and testing paths were updated to the real module locations.

Navigation now also has a staged Default opening page choice between Home and All apps. A normal native open respects it and focuses
Search when All apps is the chosen default, while explicit
page requests and Alt shortcuts keep their existing destinations. The full-width Settings commit footer and status copy were removed;
only compact material-aware Cancel and Done actions remain at the lower-right, with Done disabled when nothing has changed.

The production frontend is 162.0 KiB raw / 46.3 KiB gzip after these slices, below the new 180 KiB / 60 KiB budgets. The existing 0.2.2
release host built the final local slice to a 4.91 MiB executable, 1.61 MiB NSIS installer and 2.38 MiB MSI. These are size evidence,
not published 0.3 release candidates; manifests intentionally remain at 0.2.2 until full update acceptance.

## 2026-11-02 · 0.3.0 experience bootstrap decision

After accepting the 0.2.2 reordering work, the owner decided to bootstrap a full update rather than treat the next changes as another
small patch. The planned target is 0.3.0, led by a complete Focus-page UX pass, followed by a movable Opaline taskbar, a dedicated live
layout customiser for resizing the main panel, and measured full-restart/startup improvements. The 0.2.2 manifests remain unchanged
while this is planning work; 0.3.0 will supersede the unpublished candidate only after implementation and acceptance.

The performance plan builds on, rather than ignores, the current caches. Warm opens already reuse the live DOM and an in-memory
backdrop, and a bounded frontend cache retains some icons. The 0.3.0 plan adds a versioned native last-known manifest and disk icon
cache so an unchanged Desktop can render recognisable content immediately after a full process restart, then validate in the
background. Backdrops, live window icons and thumbnails remain memory-only. Performance will be judged by repeatable median and p95
measurements, not a best run.

The full scope, sequence, budgets, privacy boundaries and acceptance matrix are in `docs/V0_3_WORKORDER.md`. No feature code was
changed for this decision.

The owner then expanded the plan with a reviewable notification inbox and possible Google Calendar inputs. These are grouped into an
optional Activity Center rather than another permanent main page. Opaline's own Focus alerts can always appear there. Mirroring other
apps' Windows notifications is a separate, off-by-default capability because it exposes sensitive message content and requires a
Windows permission plus package identity; installed and portable feasibility must be proven before it is promised. Retention is
bounded, per-app exclusions are planned, and stored notification history must use Windows user-bound protection.

Calendar support is staged without an Opaline backend: local events and `.ics` import first, then an optional direct read-only Google
Calendar connection using desktop OAuth with PKCE. That connector would make explicit network requests and requires secure refresh
token storage, a Google Cloud OAuth client and consent/verification work. If those operational gates are not ready, the offline agenda
can ship in 0.3.0 while Google sync remains experimental or moves to 0.3.x.

The owner added a backendless news feed and clarified that the Activity Center must feel spatially obvious rather than become another
page. The planned center is now a pane-like edge drawer with Notifications, Agenda and News modules. Settings has a master switch plus
per-module switches, and both the drawer and Opaline taskbar use four miniature monitor previews for Bottom, Top, Left and Right,
inspired by the supplied Windows taskbar-behaviour reference but rendered with Opaline's material. Alignment and size controls follow
the previews. RSS/Atom and OPML provide news without an Opaline service or API key; disabled News performs no network work, remote
feed markup is sanitised, and article images remain off by default.

## 2026-11-01 · 0.2.2 distinct insertion, grouping and pane ordering

The owner reported that pane members could not be reordered and that Home dragging exposed only the grouping highlight, with no clear way to insert between entries. The drag controller now treats the centre of an eligible item or pane as the grouping target and its edges/gaps as insertion targets. An initial preview moved cells during drag, but the owner found the feedback jittery. The revised preview leaves the grid stable under the pointer and uses a restrained acrylic line; order changes once on drop.

Pane member order reuses the existing ordered `Group.items` array, so no store migration or Desktop-file operation is needed. At the owner's direction, pane contents remain manually ordered and have no automatic sorting. Settings exposes one-shot A–Z, Z–A and most-used actions only for Home. Unit coverage increased to 21 tests; release-artifact and installer checks remain separate.

The owner tested the revised native preview, confirmed that reordering and the themed stable marker work, and selected version 0.2.2. The manifest versions now identify the candidate as 0.2.2; tagging, CI artifacts and installer publication remain separate release steps.

## 2026-10-29 · 0.2.1 release decision and remaining gesture bug

After testing the latest local preview, the owner still experienced gesture lag and intermittent missed swipes. The owner chose to ship 0.2.1 with this recorded as a persistent known bug for later work, and authorized a pull request, merge and updated release tag. W-51 tracks physical-device profiling and acceptance; browser routing and timing checks alone do not close it. The 0.2.1 documentation distinguishes the corrected swipe/pinch destinations from the unresolved interaction feel.

PR #4 passed Windows CI and merged. The merged `main` CI and `v0.2.1` release workflow passed. The release published NSIS, MSI and portable downloads with `SHA256SUMS.txt`; each downloaded binary matched its listed hash. The release notes link to the synthetic screenshot gallery and name W-51. Installer installation and the remaining owner-device checks were not exercised.

## 2026-10-29 · Native pinch input, gesture routing and intentional search focus

The owner confirmed that physical two-finger swipe worked while pinch initially did not. The earlier browser tests only dispatched synthetic Ctrl+wheel events; they could not prove WebView2 delivered a physical pinch. Inspection of the installed Wry source showed its default `zoom_hotkeys_enabled: false` also calls `SetIsPinchZoomEnabled(false)` on WebView2. The preview enables pinch input for the window and cancels Ctrl+wheel page zoom in the launcher gesture handler. The owner then confirmed pinch reaches Opaline. Home page arithmetic already wrapped both directions; the isolated UI check now covers both end transitions explicitly.

The owner clarified the gesture destinations: pinching cycles the same five main pages as Alt+1–5, even while Home is open. Horizontal swipes cycle Home screens while on Home. Returning to Home through top-level navigation selects the Desktop screen. Browser routing checks cover both directions and the two wrap points; owner direction and smoothness acceptance remains open.

The owner then reported that gestures still felt laggy next to the group popup. The preview had been transforming the large backdrop-blurred Home glass surface on every input frame. Home now keeps that surface stationary during both swipe and pinch previews and moves only a content wrapper. A later owner check found that shorter swipes sometimes failed to register, so the swipe threshold is now 42 px for trackpad wheel input and 55 px for touch. Live motion responds within a short animation frame, and the content transition finishes in 220 ms. Re-entering All apps reuses its rendered list until the apps or query change. Browser checks assert that Home glass does not transform during a partial gesture and short swipes navigate; real touchpad smoothness remains for the owner to judge.

Opening Opaline and changing pages previously forced focus onto search. The neutral launcher shell now takes focus, and S focuses search without entering a query character. Arrow navigation no longer unexpectedly jumps from the first tile back into search.

## 2026-10-28 · 0.2.1 gesture correction preview

The owner reported that the touch/trackpad pinch path in 0.2.0 did not navigate on a real device. The old recognizer capped each trackpad event at 60 px and required 110 px of accumulation. The 0.2.1 controller accepts larger Ctrl+wheel deltas, navigates after 56 px of accumulated pinch movement or 90 px of horizontal swipe, and previews the page movement before the threshold. Two-finger touch requires a 25% distance change for pinch or 90 px of horizontal travel for swipe. Opposing finger motion selects pinch, shared horizontal motion selects swipe. The first preview routed both gestures through Home screens; the owner later clarified that pinch belongs to the five main pages. Releasing early returns the visible page to rest; a completed gesture slides in the destination.

Zen and the saver now sit over the same saved backdrop and tint as the launcher and reuse its large acrylic card. The saver adds a slow highlight and rotating short break prompts, while animation and reduced-motion settings disable the highlight. The public demo images for these modes were regenerated with synthetic data.

The first 0.2.1 preview still felt choppy on the owner's device for both swipes and pinches. It wrote transforms directly for every input event, then cleared the outgoing page before animating the incoming one. The revision renders the live offset on animation frames with a short response time, captures both pages in a single View Transition, and uses directional easing through the handoff. It also stops the second touch release from clearing a transition that already committed. A separate 550 ms cooldown swallowed quick intentional follow-up swipes, so only the per-burst lock remains. Browser checks now exercise an active transition, rapid follow-up swipe and partial touch cancellation; device smoothness still needs the owner's retest.

## 2026-10-28 · 0.2.0 Borosilicate Home navigation preview

The owner simplified the hierarchy after reviewing the six-icon candidate. Home moved to the left of the bottom taskbar. Existing named collections, including Dev tools, are now Home screens reached with Tab and Shift+Tab; their saved `workspaces.json` data is retained. Four header destinations remain around search: All apps and Screen time on the left, Focus and Settings on the right. Alt+1–5 follows Home, All apps, Screen time, Focus, Settings. Ctrl+Tab switches those top-level pages.

The owner clarified that Home itself must be the Windows Desktop, read-only. Its item count, text pager and Add control were removed; the pager shows dots only. New installations begin with empty Screen 2 and Screen 3. App, folder and file additions belong to custom screens, through a stateful `ItemPicker` with Windows app search, native browsing, duplicate checks and save feedback. The obsolete direct-Home metadata path was deleted. Side arrows now cycle the Home screens, including custom screens, and disappear on other main pages. The keyboard path was split into popup focus, dismissal, page shortcuts and type-to-search handlers, following the standards in `AGENTS.md`.

Settings uses the main page surface and applies existing controls immediately, without a modal Done step. The fabric wave and its obsolete setting were removed. Only the already prepared app grid makes a roughly 200 ms upward pop, and reduced motion disables it. The demo gallery covers the main pages, custom screens and picker, all Settings sections, Focus modes, pane, compact taskbar and preview. An original synthetic blank-desktop illustration shows hidden icons without exposing the owner's wallpaper or notifications. Native Windows key routing, picker, login startup, virtual desktops, icon parity, timing and owner visual acceptance remain open.

The final isolated UI pass rendered 24 screenshots at 1280 × 800 and checked layouts down to 600 × 600. It exercised Home arrow and dot navigation, custom-screen persistence, app search, picker focus, Focus, screen time, Settings and cached preview presentation. The desktop preview process is running for owner testing; its real Windows interactions are still acceptance checks.

## 2026-10-28 · Workspaces, local screen time and retained taskbar

The owner requested named Alt+number spaces, maximised-app time, keyboard page switching, a compact bottom taskbar, faster cached previews, a Windows-key opt-in, smooth pane-origin motion, current appearance in realistic GitHub artwork, and a test-first draft PR. The complete intake is `docs/SESSION_WORKORDER.md`.

Reused the retained rail and Windows enumeration, moved it horizontally, added a 32-entry decoded preview cache with shared requests/background refresh, and moved thumbnail scaling into GDI before CPU readback. Native cold checks measured 66.5–131.6 ms; cached demo presentation measured 13–17 ms. No cold 50 ms claim is made.

Native usage sampling persists local executable/current-day totals while hidden, excluding idle and sleep gaps. Spaces live in their own metadata file. Windows virtual-desktop APIs move only Opaline and invalidate cross-desktop backdrop reuse. Windows-key routing is off by default and preserves shell recovery paths; real key/desktop acceptance remains open.

The owner's latest saved Appearance values were read without modification (10 px blur, 16% tint, small icons). Numbered corner controls replace the wide bottom page strip after a clipping report. Tile labels no longer shrink vertically or disappear beneath an unconditional fade mask. App icons in the demo artwork are recognisable public app identities; personal folder names and real screen captures are excluded.

Process inspection confirmed WebView2 already has Opaline as its parent; Task Manager's grouping is a separate presentation. The supported Tauri process model is retained. The branch and local commit were prepared for owner testing; the owner subsequently authorized the PR, merge and v0.2.0 release.

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
