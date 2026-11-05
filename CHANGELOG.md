# Changelog

All notable changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com),
and the project uses [Semantic Versioning](https://semver.org). Each minor release has a glass-type codename
(see [docs/NAMING.md](docs/NAMING.md)).

## [Unreleased]

## [0.3.0] — 2026-11-05 "Crown"

### Added
- Added taskbar placement: the taskbar (Home, the app mirror and the navigation group) docks to the bottom, top, left or right edge and sits at the start, centre or end of it. Window previews, magnification, scrolling, the Taskbar ends and Sidebar arrangements and the page layout follow the edge.
- Added a Fade between pages setting: pages, Home screens and Settings sections ease in instead of appearing at once. It follows Animations and the system's reduced-motion preference.
- Rebuilt the Focus workflow around a clear intention, explicit ready/running/paused states, 25/50/custom durations, finish-versus-skip semantics, keyboard control, session summaries and a compact running-timer capsule.
- Added five Opaline-native visual starting points—Opaline Original, Windows Mica, One UI Glass, Frutiger Aero and Deep Night—plus named user visual/layout presets. User presets capture appearance, panel and icon sizing, rail/bar choices and motion settings, and support validated local JSON import/export.
- Added Split Header, Navigation Taskbar and Dropdown Tray arrangements with live previews. Individual destinations can stay pinned or move into the overflow tray.
- Added staged Settings editing with a persistent bottom Done/Cancel bar. Navigation and appearance previews reuse the current in-memory backdrop and actual panel proportions without persisting the image.
- Added task-specific Settings previews: Home simulations only where Home is being changed, plus a looping pane-origin motion preview for Panes.
- Added a dependency-free build-size report and frontend size budget.
- Added a Navigation setting that lets a normal Opaline open start on Home or All apps; choosing All apps focuses Search on open.
- Added Current screen (a capture of what is on screen), Opaline Aero and locally optimised custom Opaline backgrounds. Frutiger Aero includes its own original landscape.
- Added hover-intent behaviour shared by submenus, the taskbar preview, the pane peek and the navigation tray: popups stay open while the pointer travels toward them along a diagonal path (a safe-triangle and distance test), and once one popup is open its neighbours open immediately instead of each waiting out the hover delay.
- Added a Light bending setting (Appearance, off by default) that makes panels and controls refract the desktop at their edges, instead of only frosting it, with a physically-based model (a convex glass edge and Snell's law) that disperses the colours slightly like real glass. It applies to any material; 0% removes the effect. An Apple Glass preset built on it was tried and removed before release; a saved Apple Glass choice becomes a custom material with the same colours and bending. It needs the Chromium-based WebView2 and costs GPU time. The previously unused in-repo lens was rebuilt rather than adding a third-party package: the npm "liquid glass" packages wrap this same SVG technique and are new and unvetted, and Opaline keeps its runtime dependencies minimal.
- Added Android-style Home screens: Home ends with an empty page showing a large plus that creates the next screen (Enter works too), the pager's last dot is a plus, an empty screen has a plus that opens the app picker, and every custom screen has a Remove screen button that asks first when it holds items.
- Added a Shortcuts & help section to Settings listing every keyboard shortcut and gesture; F1, or ? when nothing is being typed, opens it. Pages steered with the keyboard also show small arrow, Enter and Tab hints in the panel corner.
- Added value axes, faint rules and dated, weekday-labelled days to the Screen time and Focus charts, and marked today.
- Added two navigation arrangements: Taskbar ends (the destination groups either side of Home and the app mirror) and Sidebar (the taskbar turned on its side: every destination in one compact pill on the left or right edge, chosen in Settings).
- Made the Dropdown Tray behave as a dropdown: it opens when the pointer rests on it, closes when the pointer leaves for elsewhere, stays open after a click until dismissed, and closes on an outside press or Escape (the first Escape no longer also closes the launcher).

### Changed
- Settings is a panel like every other page, with a corner button that expands it to fill the window and back. Cancel and Done grey out when nothing is staged. Its ten sections are folded into six (Appearance, Home, Navigation & taskbar, Behaviour, Shortcuts & help, About), grouped by headings; Home screens and Panes moved into Home and Screen time into Behaviour. The navigation sits a 15 px gutter from the panel's edge.
- The background that captures the screen was called Desktop, which read like the wallpaper. It is now Current screen, with a description of what it is.
- A fresh profile starts with Desktop alone and the plus page that adds the next screen, instead of two empty extra screens. The two empty placeholder screens older versions created are dropped on load; a screen with a name of your own or anything in it is kept.
- Taskbar ends now puts the destination groups either side of Home and the app mirror, in the taskbar's own bar, instead of in the screen corners.
- The destination icons and groups now match the taskbar: the same glyph size and stroke as Home, and plain glass without a lighter overlay.
- Removed the white-to-colour sheen gradients from glass panels, pane plates and the Focus cards: surfaces are a flat fill with a hairline border and a lit rim.
- Restyled the swipe and pinch cue in the panel glass so it follows the theme, with a direction arrow and a "Next page" or "Previous screen" label, and removed the single-screen rubber band: Home always has a trailing new-screen page to swipe to.
- Drew the destination icons slightly thinner in every navigation arrangement.
- Compact navigation now minimises the controls only while the taskbar mirror is on (its expand button brings them back); otherwise the setting is disabled and Ctrl+B explains why.
- The Settings previews now show the staged default opening page (All apps lists the installed apps) and each navigation card reflects the other staged settings. The default-page choice no longer wraps or towers over the other controls.
- Reworked swipe and pinch motion. A swipe now slides only the Home content over stationary glass, with nothing clipping at the edges; a pinch zooms the page and cross-zooms into the destination. Both show the destination while held, commit with an overlapped out/in animation, no longer block the next gesture while they play, and honour reduced motion. Single-screen swipes rubber-band back instead of previewing a page that does not exist.
- Raised the frontend code budget from 180 to 220 KiB raw and from 60 to 62 KiB gzip for the gesture, hover, help, Home-screen, chart, navigation, refraction, taskbar-placement and Settings work (currently about 214 KiB raw and 60 KiB gzip).
- Completed the TypeScript feature-folder migration: the source root now contains documentation only, while app composition, shared core, Activity, Appearance, Focus, Grid/Home, Navigation, Settings and Taskbar own their runtime modules. Activity and Taskbar styling moved out of the shell stylesheet.
- Expanded feature documentation with public functions, state ownership, dependencies, invariants, extension points and Mermaid UML/flow/state/sequence diagrams.
- Reorganised Settings into Appearance, Home layout, Navigation and Taskbar sections so visual presentation, Home ordering, Opaline destinations and the Windows app mirror no longer overlap.
- Replaced the fixed dark Settings commit slab and status copy with compact material-aware Cancel/Done actions at the lower-right.
- Expanded Settings into a near-full-window workspace, removed unrelated Home previews from Screen time and Home screens, and moved Focus preferences onto the Focus page.
- Changed launcher search to accept type-to-search from Home and All apps instead of requiring a dedicated S shortcut.
- Removed per-card backdrop filtering from appearance previews so preset count does not multiply compositor work.
- Changed Settings from automatic application to an explicit validated commit; operating-system actions remain intentionally immediate.

### Fixed
- Replaced ghosted generic preset thumbnails and dot-box diagrams with a shared miniature of the actual launcher layout using current memory-only backdrop, app names, loaded app/taskbar icons and real configuration state.
- Expanded the built-in presets into distinct complete material profiles. Windows Mica now uses a flatter, mostly opaque WinUI 3-inspired treatment instead of sharing Opaline Frost's material.
- Changed precision-touchpad recognition to commit once, consume the complete inertial tail and re-arm after a bounded quiet period. Page changes no longer use View Transitions (which could stall in WebView2 until the pointer moved); physical owner-device acceptance remains open.
- Screen time now shows apps by the name people know instead of the file name, and no longer lists Store apps as "WhatsApp.Root" or "ApplicationFrameHost". Packaged apps use their Start-menu name and icon, one entry survives package updates, other programs use the name in their file details, and Store apps shown through ApplicationFrameHost are charged to the app inside the frame. Existing history is merged and renamed when Opaline starts; time that was charged to ApplicationFrameHost belongs to no nameable app and is dropped. The taskbar uses the same names.
- Removing a Home screen in Settings no longer switches the launcher to Desktop behind the Settings page.
- Made the pager dots, key hints, chart rules and bars, usage meter, help keys and the swipe and pinch cue follow the theme, so they stay readable on light materials; the cue is now a real glass panel and takes every preset’s material.
- Fixed the launcher stage being scrollable: its oversize blurred backdrop let a focus or scroll-into-view slide the whole UI sideways by a few pixels. The stage now clips instead.
- Inlined the already-loaded stylesheet into isolated Settings simulations, eliminating repeated preview stylesheet requests and transient black frames.
- Fixed Space on a focused Focus button (Reset, Finish, duration presets, phase tabs) toggling the timer instead of activating that button.
- Fixed Settings Done reverting a change made while Settings was open, such as Ctrl+B; Done now applies only the edits staged in Settings.
- Settings previews now update in place instead of reloading on every slider tick, share one backdrop image rather than embedding a copy each, and are no longer rebuilt while Settings is hidden.
- A Focus session that was never started can no longer be finished and recorded as completed; Finish is disabled until it begins, and breaks can still be skipped.
- Fixed the custom duration field showing no keyboard focus ring, and gave the Focus progress ring a valid accessible role.
- Presets in an imported file that reuse an id now get their own, so removing one no longer removes the others.
- A failed save (full or blocked browser storage) is now reported: Settings show that changes will be lost on restart and preset actions show the error, instead of appearing to succeed.
- Removed the empty glass capsule left in the header when every destination in a split-navigation group is hidden.

### Known issues
- Swipe and pinch navigation can still feel laggy or miss a short gesture on the owner's trackpad (W-51); the gesture motion was reworked in this release, but a physical trackpad has not confirmed the fix.
- The MSI installer creates an all-users Desktop shortcut (the NSIS installer removes its own). Light bending is untested on the target GPU and is off by default.

## [0.2.2] — 2026-11-01 "Borosilicate"

_Never tagged or published: these changes ship in 0.3.0._

### Added
- Pane members can be reordered in place and keep their order after the pane closes or Opaline restarts.
- One-shot Home sorting actions for A–Z, Z–A and most-used order.

### Changed
- Dragging at a tile edge now previews a between-items insertion with a stable acrylic line; the tile centre retains the existing create/add-to-pane action.

## [0.2.1] — 2026-10-29 "Borosilicate"

### Fixed
- Enabled WebView2 pinch input; the owner confirmed physical pinch reaches Opaline in the preview. Pinch-in/out moves backward/forward through the Alt+1–5 pages.
- Two-finger horizontal swipes follow Home screens and wrap in both directions. Outside Home, swipes leave the current main page unchanged.
- Swipe and pinch now move the visible page during the gesture and slide the destination into place at the threshold; a short gesture eases back.
- Smoothed gesture input frames and replaced the abrupt page handoff with one eased transition between the outgoing and incoming pages.
- Home gestures now move page content over stationary acrylic; shorter swipes register and complete more quickly.
- Search no longer takes focus when Opaline opens or changes pages. Press S to focus it; Home swipes wrap in both directions.
- Zen and screen saver reuse the saved launcher backdrop and acrylic material. The saver rotates gentle break prompts.

### Known issue
- Swipe and pinch navigation can still feel laggy or miss a short gesture on the owner's trackpad. Further input tuning and real-device profiling are tracked in W-51; keyboard, arrows and Home dots remain available.

## [0.2.0] — 2026-10-28 "Borosilicate"

### Added
- Four-icon header with All apps and Screen time left of search, Focus and Settings right; Home moved beside the bottom taskbar.
- Home sub-screens for saved collections, with Tab/Shift+Tab cycling and Alt+1–5 shortcuts for the five main pages.
- Read-only Desktop Home with dot-only navigation and two empty custom screens on a fresh profile.
- Full-page Settings with controls that apply as they change, plus screenshots of every section.
- Original illustrative blank-desktop screenshot showing hidden icons without personal desktop data.
- Workspace item picker with Windows app search, native folder/file selection and advanced path entry.
- Grouped daily charts with tighter bar spacing and a more compact Focus/Pomodoro layout and Zen presentation.
- 500 ms group/folder hover peeks with icon grids, bounded read-only folder listing and keyboard-focus access.
- Focus page with a configurable Pomodoro timer, completion graph, Zen reminders and an optional in-app idle screen saver.
- Seven- and thirty-day screen-time charts, per-app drill-down and a styled period menu backed by local daily history.
- Acrylic custom scrollbars with a width setting, plus a smaller bottom taskbar and larger app surface.
- Owner coding rules from the supplied screenshot in `AGENTS.md`.
- Named app/folder/file collections inside custom screens; Home-only side arrows, Ctrl+Tab page cycling and Ctrl+B compact mode.
- Touch and trackpad swipe/pinch page navigation on the launcher canvas.
- Local foreground maximised-app screen time: Today / All time, pause/resume and clear; idle and sleep gaps excluded.
- Reactivated the retained taskbar mirror at the bottom with a bounded decoded thumbnail cache, shared requests, background refresh and GDI downsampling before readback.
- Opt-in Windows-key tap opens All apps; off by default, preserving Windows chords, native Start-button click and Ctrl+Esc.
- Windows desktop handling for Opaline and its backdrop cache; real workspace/multi-monitor acceptance remains open.
- Group-origin popup motion, full two-line tile labels, scrollable grid edges, keyboard submenus/modal focus and stricter settings validation.
- Message-by-message work orders, Apple/Figma guidance notes, isolated checks and GitHub artwork using current appearance, familiar apps and synthetic folders.
- Full-screen overlay opened with Ctrl+Alt+Space, drawn over a blurred snapshot of the screen.
- Desktop items from the user and shared Desktop folders, with real shell icons.
- Search, keyboard navigation, tray icon, `--hidden` and `--pin` launch flags.
- Panes (groups) with automatic organisation, renaming, drag and drop and a context menu.
- Spatial canvas positioning for loose files, folders and panes, persisted across display sizes.
- Acrylic styling over the captured backdrop (superseding the earlier liquid-lens experiment).
- Transparent clear-canvas fast path and a short app-grid opening motion.
- One rounded apps surface with a centred, reorderable grid; loose apps are plain icon + name, while pane mini-icons sit inside one rounded bubble with the name below.
- A bottom Home button and a functional alphabetical Windows AppsFolder catalogue.
- A Reset grid order action that preserves pane membership and Desktop files.
- The previously disabled taskbar rail is reactivated at the owner's request; its lens remains dormant.
- Narrowed and centred the app surfaces; sparse grid rows stay aligned to the leftmost grid columns.
- A unified acrylic surface system with direct backdrop-blur, tint-strength and tint-colour controls.
- Rail: taskbar mirror with hover window previews.
- Windows 11 Taskband registry pins and packaged-app launch paths in the rail.
- Settings page covering the glass, layout, rail, behaviour, hotkey and launch at login.
- Unit tests for pane organization/storage, display names, icon pixel conversion and Taskband parsing.
- Tag-driven Windows release workflow for NSIS, MSI and portable ZIP artifacts with SHA-256 checksums.
- Project documentation: README, work orders, architecture/testing/releasing guidance, contribution and security policies, naming and CI.

### Changed
- Replaced the fabric-wave entrance with a small 200 ms grid pop; removed the obsolete entrance and page-shortcut settings.
- Extracted a stateful item picker and smaller keyboard handlers in line with the owner's coding standards.
- Reworked the demo into coherent IDE, dev tools, project, notes and reference groups; Android Studio now appears with VS Code.
- Removed the top-left page switcher and shutdown orb; centered plain arrows outside the app surface and placed matching All apps/Focus icons left of search and Screen time/Settings icons right of it.
- Removed the Opaline icon from the taskbar mirror, matched its height to search and hid its overflow scrollbar while keeping horizontal scroll available.
- Prefer larger window icons and limit optional hover magnification to reduce blur.
- Running taskbar apps prefer their window icon, with shortcut icons as fallback; the All apps dock button uses the Opaline mark.
- Startup registers readiness before Desktop/icon warming finishes and loads independent stores concurrently. Launch-at-login now shows its current state explicitly.
- Replaced the OS acrylic/blur window material with a self-rendered backdrop, so blur, tint and refraction are fully controllable.
- Clear mode now skips capture and opens as a transparent full-screen surface; frosted modes retain the snapshot fallback.
- Backdrop capture downsamples in GDI, lens maps are bounded and cached, and non-critical refreshes occur after first paint.
- Dock magnification pushes neighbouring icons apart to avoid clipping.
- Search and rail now read as independent floating surfaces; theme changes reuse the same hierarchy across popup, settings, previews and menus.
- Removed widget mockups; the taskbar mirror sits beside Home navigation.

### Notes
- Pre-release. Local TypeScript, frontend and Rust unit tests pass. Hotkey/focus, drag persistence, tray, installer and CI still need the
  real release acceptance pass —
  see [WORKORDER.md](WORKORDER.md#0-current-status) for the per-requirement status and the ordered next actions.
- Added for contributors: `AGENTS.md`, `docs/TESTING.md`, `docs/CODEX_PROMPT.md`, and `scripts/cdp.mjs` to drive the running app.

## History before 0.1.0

- **Beta 0 — WinUI 3 (failed, superseded).** First attempt with WinUI 3 / C#. Kept in `archive/winui3-beta/`; the story is in [DEVLOG.md](DEVLOG.md).
