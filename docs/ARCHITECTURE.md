# Architecture

Opaline is one hidden Tauri v2 window with a Rust lifecycle/backend and a framework-free TypeScript UI. The boundary is intentionally
small: Rust owns Windows APIs and durable files; the webview owns layout, settings and interaction.

## Open paths

```text
hotkey / tray / second launch
            |
       fit hidden window
            |
   +--------+---------+
   | optional clear   | acrylic canvas (default)
   | no capture       | GDI capture -> 960 px JPEG
   +--------+---------+
            |
  launcher-prepare(snapshot?)
            |
 UI presents first frame; refreshes Desktop and AppsFolder after paint
```

The acrylic canvas is the default. It uses an in-memory still because WebView2 cannot reliably blur content outside its own compositor;
the screenshot is never written to disk. Capture is downsampled before transfer. A retained clear-canvas path can skip capture during
future performance experiments, but it is not exposed by the current Appearance panel.

After the overlay hides, Rust captures the now-visible desktop on a worker and sends it to the hidden webview for decoding. A matching
monitor and Windows virtual desktop can therefore reuse an already-decoded frame on the next open. A first/uncached open still captures before showing so the overlay
never photographs itself.

## Surfaces and themes

Search is an independent floating surface. The taskbar mirror (the rail, `src/taskbar/`) docks to the bottom, top, left or right edge at the start, centre or end of it (`railEdge`, `railAlign`, applied as `data-rail-edge` and `data-rail-align` on `body` and handled in `taskbar.css`); refreshes and thumbnail warming run only while the overlay and taskbar option are active, and no lens runs on the rail. One rounded apps surface contains the centred grid. Loose apps and folders are
plain icon + name with no per-item bubble. A pane uses one rounded mini-icon bubble and places its name below. The pane popup, preview,
item picker and context menu are transient surfaces; Settings is a panel like any other page, with a corner button that expands it to the whole window (`settingsExpanded`). This keeps hierarchy legible and bounds compositing work.

The side arrows and Tab cycle the read-only Desktop Home and custom screens. Ctrl+Tab and Alt+1–5 select Home, All apps, Screen time, Focus and Settings. Screen-time history keeps local per-app daily totals for 90 days; `activity/index.ts` and `activity/charts.ts` render 7/30-day graphs with labelled axes without fetching data from a service. `focus/timer.ts` stores a wall-clock deadline so hiding the overlay does not pause a session; `focus/index.ts` owns the Focus page and `focus/ambient.ts` owns immersive and quiet-clock presentation. `idle.rs` may open the saver after the selected idle interval. The saver never changes Windows lock or system screen-saver policy. `apps.rs` enumerates Windows AppsFolder on a worker after
the overlay is visible, covering classic Start-menu entries and packaged apps without adding work to the opening path. `navigation/pages.ts` owns
top-level page state and the Home-screen pager (a fresh profile has Desktop and a plus page that adds a screen), and `navigation/tray.ts` and `gesture-motion.ts` own the dropdown tray and the swipe and pinch motion. The destinations can sit in a split header, a navigation taskbar, a tray, either side of Home in the taskbar, or a sidebar. Page changes ease in through `core/motion.ts`, which respects the Animations setting, the Fade between pages toggle and the system's reduced-motion preference. `item-picker.ts` owns the shared searchable app/folder add flow for Home and named screens; `picker.rs` opens an owned Windows folder/file dialog on a worker and returns only the chosen path for metadata storage. Widgets were removed from the current UI and remain a roadmap item.

The material engine is one surface vocabulary driven by CSS variables: backdrop blur, saturation and brightness, tint strength and colour, panel colour and opacity, and corner
radius. Five named presets (Opaline Original, Windows Mica, One UI Glass, Frutiger Aero, Deep Night) and the user's own set them together. Surfaces are flat translucent
fills with a hairline border and a lit rim; there are no sheen gradients. This keeps search, Home, All Apps and transient panels visually consistent. Older theme fields remain
readable for settings migration but are normalized at load time. See [THEME_WORKORDER.md](THEME_WORKORDER.md) for acceptance criteria.

**Light bending** is the opt-in exception that goes beyond frosting. `core/refraction.ts` is pure physics: a convex-squircle bezel, Snell's law at an index of 1.5 and a slightly different
bend per colour channel produce a displacement map. `core/glass.ts` renders that map per large surface as an SVG filter (an `feImage` map and three `feDisplacementMap` passes, scaled by twice the
maximum shift because the primitive moves pixels by scale × (value − 0.5)) and applies it through `backdrop-filter: url(#…)`. It works only in Chromium/WebView2, is GPU-heavy, and is absent
when Light bending is 0%, which is the default and the value of every built-in preset.

Backdrop filtering is limited to the large floating/transient surfaces. App and pane cards use ordinary fills and borders—never a
backdrop filter per card—so adding Desktop items does not add one expensive compositor pass each.

## Data

- `groups.json`: virtual panes, normalized grid-order ranks and launch counts.
- `config.json`: the hotkey needed before the UI exists.
- `opaline.settings`: webview local storage for visual and behavioural settings.
- `opaline.appearance.profiles`: up to 24 named local visual/layout profiles; export files use the versioned `opaline-visual-presets` JSON schema.
- `workspaces.json`: up to eight named app/file/folder collections shown as Home screens after the Desktop-based first screen (none by default; empty placeholder screens saved by older versions are dropped on load).
- `screen-time.json`: foreground/maximised per-app totals keyed by app identity (see below), current local-day totals and the pause preference. No window titles are saved.
- `shell.json`: the opt-in Windows-key preference.

`identity.rs` gives every executable one key, one human name and one icon source, shared by screen time and the taskbar. A packaged app (a
folder under `WindowsApps`) is keyed by its package family, so it stays one entry across updates, and takes the name and icon of its
Start-menu entry (its own executable is unreadable); other programs use the name in their file details, then the file name. A Store app
shown through `ApplicationFrameHost.exe` is resolved through the `Windows.UI.Core.CoreWindow` inside the frame, and time that cannot be
attributed is not charged. Lookups are cached; a guess made while the Start-menu catalogue lacked an app is retried after ten minutes.
History recorded before this existed is merged and renamed on the sampler thread when Opaline starts, never on the path to the first frame.

Changing a pane or grid order only changes metadata. Desktop files are never moved, renamed or deleted. The public identifier migration
reads legacy `dev.opaline.launcher` JSON once and copies valid data into `io.github.mooketsimagwaza.opaline` without deleting the old copy.

## Performance rules

- A login start can run before Explorer's taskbar exists, so the tray icon is retried instead of being fatal, and `startup_log.rs` records every start, tray retry and panic in `startup.log` beside the data files.
- After the overlay has stayed hidden for 20 seconds, WebView2 is asked for a low memory target (about 430 MB to about 145 MB of working set across Opaline's processes); the request is lifted at the start of the next open so it never sits on the visible-frame path. Trimming immediately after every hide cost about 90 ms per open and was dropped.
- Nothing except fit/capture/present belongs on the visible-frame path.
- Shell icon extraction remains serialized on one STA worker.
- Icons and window previews reach the UI as image responses from the `opaline` URI scheme (`media.rs`), not as base64 text in command results, so nothing icon-sized is parsed, held as a string or written to local storage.
- Glass is applied to large floating surfaces, never as one backdrop filter per tile.
- Desktop and AppsFolder refreshes happen after presentation. Taskbar enumeration and bounded thumbnail warming run after presentation and stop when hidden.
- The UI keeps up to 32 decoded thumbnails in memory, shares concurrent requests per window and shows stale pixels while refreshing. A cached hover avoids capture entirely; cold PrintWindow can take longer than 50 ms.
- Native usage sampling runs once a second while the app is alive, excluding idle periods and sleep gaps. It saves every 30 seconds and on normal exit; an abrupt process kill can lose the most recent interval.
- `npm run size` fails when the production frontend exceeds 220 KiB raw or 62 KiB gzip (raw was 180 KiB until the gesture motion and hover-intent systems, 190 KiB until the help, Home-screen, chart and navigation work, 200 KiB until the refraction lens and 210 KiB until taskbar placement, panel-sized Settings and page fades; gzip was 60 KiB; see `scripts/measure-build.mjs`). New UI data remains static TypeScript unless runtime editing actually requires a file or service.

## Frontend module boundaries

- `src/app/`: the shell (`launcher.ts`: open/close lifecycle, keyboard wiring) and the shared surfaces and tokens in `launcher.css`.
- `src/core/`: Rust command wrappers and image URLs, DOM helpers, icons, the context menu, hover intent, motion, and the refraction and glass lens.
- `src/focus/`: timer state transitions, ambient presentation and the Focus page controller.
- `src/grid/`: Home rendering, pane/group state, workspaces, drag/drop ordering and delayed folder/pane peeks; `index.ts` is the feature coordinator.
- `src/navigation/`: pages and the pager, navigation arrangements, the tray, and swipe and pinch gestures with their motion.
- `src/taskbar/`: the Windows app mirror, its previews and its placement on any edge.
- `src/settings/`: persisted settings, the staged draft, the panel and its live preview, and the Shortcuts & help page.
- `src/activity/`: the screen-time page and its charts.
- `src/appearance/`: material presets, backgrounds, local user-preset persistence, and versioned import/export and validation.
- `src/data/`: typed product data shared across features (the shortcut and help list). Feature-specific data lives with its feature, such as organise rules in `grid/` and Focus copy in `focus/`. Keeping it static makes lists editable without runtime fetches.
- Feature-owned CSS lives beside its feature (`focus/focus.css`, `grid/grid.css`, `appearance/appearance.css`, `navigation/navigation.css`, `settings/settings.css`, `taskbar/taskbar.css`, `activity/activity.css`) and is imported by `launcher.css`. Shared surfaces and tokens remain in the root stylesheet.
- Settings edits are staged in memory. Done validates and writes the complete draft; Cancel restores persisted settings. Preview thumbnails may reuse the current in-memory backdrop but never persist it in a preset or export.

## Processes on Windows

The Rust executable owns the window, tray, global hotkey, files and Windows integration. WebView2 draws HTML/CSS and runs the TypeScript UI in Microsoft's runtime processes. This is Tauri's supported multi-process model, not an extra copy of the launcher.

On 28 October 2026 the running process tree was inspected: `msedgewebview2.exe` had `opaline.exe` as its parent. Task Manager can group the runtime under **Microsoft Edge WebView2** while showing **Opaline** separately. The visual group is not the operating-system parent/child relationship. The app's title and product identity remain Opaline; renaming or merging Microsoft's runtime processes is not a supported branding change.

Isolation keeps renderer failures separate from the native host. Memory should be measured across the host, browser, renderer and GPU children, rather than quoting only the small Rust process. The hidden overlay stops taskbar refresh, preview warming and screen-time page polling; native usage sampling continues intentionally. Full idle-memory profiling remains a release gate.

Sources: [Tauri process model](https://v2.tauri.app/concept/process-model/), [Microsoft WebView2 process model](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model).

## Windows desktop and Start integration

`workspace.rs` uses the documented virtual-desktop COM interface to move only Opaline's own window to the foreground desktop. Backdrop reuse also requires a matching virtual-desktop ID; cloaked windows are excluded from the taskbar mirror and usage attribution.

`start_menu.rs` tracks a Windows-key tap only when enabled. Windows-key chords pass through; a modifier-mask release prevents the native Start menu on a solo tap and dispatches All apps outside the hook callback. Input-injection failure passes the original release back to Windows. Native Start-button clicks and Ctrl+Esc are preserved. No registry, Explorer patch, service or administrator permission is required; the hook disappears when Opaline exits. Real key/chord acceptance is still required before treating this experimental integration as verified.

## Platform boundary

Windows implementations live behind `cfg(windows)` with harmless non-Windows fallbacks. A Linux port can replace capture, shell icons,
window enumeration and packaged-app discovery without rewriting the UI or pane store.
