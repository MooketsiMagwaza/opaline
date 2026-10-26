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
monitor can therefore reuse an already-decoded frame on the next open. A first/uncached open still captures before showing so the overlay
never photographs itself.

## Surfaces and themes

Search is an independent floating surface. The taskbar rail code remains isolated in `rail.ts` but is disabled by
`RAIL_AVAILABLE`, so enumeration, previews and its lens do not run. One rounded apps surface contains the centred grid. Loose apps and folders are
plain icon + name with no per-item bubble. A pane uses one rounded mini-icon bubble and places its name below. Popup, preview, settings
and context menu are transient surfaces above them. This keeps hierarchy legible and bounds compositing work.

The floating page switcher swaps Home with an alphabetical All Apps catalogue. `apps.rs` enumerates Windows AppsFolder on a worker after
the overlay is visible, covering classic Start-menu entries and packaged apps without adding work to the opening path. `pages.ts` owns
page state, filtering and list rendering. Widgets were removed from the current UI and remain a roadmap item.

The active material engine is deliberately narrow: one dark acrylic surface vocabulary with user-controlled backdrop blur, tint strength
and tint colour. This keeps search, Home, All Apps and transient panels visually consistent. Older theme fields remain readable for settings
migration but are normalized to acrylic at load time. See [THEME_WORKORDER.md](THEME_WORKORDER.md) for acceptance criteria.

Backdrop filtering is limited to the large floating/transient surfaces. App and pane cards use ordinary fills and borders—never a
backdrop filter per card—so adding Desktop items does not add one expensive compositor pass each.

## Data

- `groups.json`: virtual panes, normalized grid-order ranks and launch counts.
- `config.json`: the hotkey needed before the UI exists.
- `opaline.settings`: webview local storage for visual and behavioural settings.

Changing a pane or grid order only changes metadata. Desktop files are never moved, renamed or deleted. The public identifier migration
reads legacy `dev.opaline.launcher` JSON once and copies valid data into `io.github.mooketsimagwaza.opaline` without deleting the old copy.

## Performance rules

- Nothing except fit/capture/present belongs on the visible-frame path.
- Shell icon extraction remains serialized on one STA worker.
- Glass is applied to large floating surfaces, never as one backdrop filter per tile.
- Desktop and AppsFolder refreshes happen after presentation; rail/window refreshes are disabled.

## Platform boundary

Windows implementations live behind `cfg(windows)` with harmless non-Windows fallbacks. A Linux port can replace capture, shell icons,
window enumeration and packaged-app discovery without rewriting the UI or pane store.
