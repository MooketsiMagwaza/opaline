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

Search is an independent floating surface. The retained taskbar rail in `rail.ts` is active at the bottom; refreshes and thumbnail warming run only while the overlay and taskbar option are active. No rail lens runs. One rounded apps surface contains the centred grid. Loose apps and folders are
plain icon + name with no per-item bubble. A pane uses one rounded mini-icon bubble and places its name below. The pane popup, preview,
item picker and context menu are transient surfaces; Settings is a full page. This keeps hierarchy legible and bounds compositing work.

The side arrows and Tab cycle the read-only Desktop Home and custom screens. Ctrl+Tab and Alt+1–5 select Home, All apps, Screen time, Focus and Settings. Screen-time history keeps local per-app daily totals for 90 days; `usage.ts` renders 7/30-day graphs without fetching data from a service. `timer.ts` stores a wall-clock deadline so hiding the overlay does not pause a session. `focus.ts` owns the Zen and screen-saver surfaces, while `idle.rs` may open the saver after the selected idle interval. The saver never changes Windows lock or system screen-saver policy. `apps.rs` enumerates Windows AppsFolder on a worker after
the overlay is visible, covering classic Start-menu entries and packaged apps without adding work to the opening path. `pages.ts` owns
top-level page state and the Home-screen pager. `item-picker.ts` owns the shared searchable app/folder add flow for Home and named screens; `picker.rs` opens an owned Windows folder/file dialog on a worker and returns only the chosen path for metadata storage. Widgets were removed from the current UI and remain a roadmap item.

The active material engine is deliberately narrow: one dark acrylic surface vocabulary with user-controlled backdrop blur, tint strength
and tint colour. This keeps search, Home, All Apps and transient panels visually consistent. Older theme fields remain readable for settings
migration but are normalized to acrylic at load time. See [THEME_WORKORDER.md](THEME_WORKORDER.md) for acceptance criteria.

Backdrop filtering is limited to the large floating/transient surfaces. App and pane cards use ordinary fills and borders—never a
backdrop filter per card—so adding Desktop items does not add one expensive compositor pass each.

## Data

- `groups.json`: virtual panes, normalized grid-order ranks and launch counts.
- `config.json`: the hotkey needed before the UI exists.
- `opaline.settings`: webview local storage for visual and behavioural settings.
- `workspaces.json`: up to eight named app/file/folder collections shown as Home screens after the Desktop-based first screen.
- `screen-time.json`: foreground/maximised executable totals, current local-day totals and the pause preference. No window titles are saved.
- `shell.json`: the opt-in Windows-key preference.

Changing a pane or grid order only changes metadata. Desktop files are never moved, renamed or deleted. The public identifier migration
reads legacy `dev.opaline.launcher` JSON once and copies valid data into `io.github.mooketsimagwaza.opaline` without deleting the old copy.

## Performance rules

- Nothing except fit/capture/present belongs on the visible-frame path.
- Shell icon extraction remains serialized on one STA worker.
- Glass is applied to large floating surfaces, never as one backdrop filter per tile.
- Desktop and AppsFolder refreshes happen after presentation. Taskbar enumeration and bounded thumbnail warming run after presentation and stop when hidden.
- The UI keeps up to 32 decoded thumbnails in memory, shares concurrent requests per window and shows stale pixels while refreshing. A cached hover avoids capture entirely; cold PrintWindow can take longer than 50 ms.
- Native usage sampling runs once a second while the app is alive, excluding idle periods and sleep gaps. It saves every 30 seconds and on normal exit; an abrupt process kill can lose the most recent interval.

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
