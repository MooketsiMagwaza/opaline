<p align="center">
  <img src="assets/logo.svg" alt="Opaline" width="128" height="128" />
</p>

<h1 align="center">Opaline</h1>

<p align="center">
  A frosted-glass launcher for your desktop.<br />
  Press <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Space</kbd> and everything on your Desktop floats up on liquid glass.
</p>

<p align="center">
  <a href="WORKORDER.md">Work order</a> ·
  <a href="CONTRIBUTING.md">Contributing</a> ·
  <a href="CHANGELOG.md">Changelog</a> ·
  <a href="DEVLOG.md">Dev log</a> ·
  <a href="docs/NAMING.md">Naming</a>
</p>

> **Status: early development — `0.1.0` "Annealed".** Windows 11 first; Linux is planned.
>
> It **builds and runs**: the overlay opens over a blurred screen snapshot, your Desktop items show their real icons, first run sorts
> them into panes, and the pane popup, settings pane, context menu and rail render with the liquid-glass styling. Still to be
> verified: the hotkey toggle and the close paths, drag and drop, persistence, rail interactions and CI. The
> [work order](WORKORDER.md#0-status-at-pause) lists every requirement with its real status and only marks something done
> once it has been seen working.

## What it is

You hide the icons on your Windows desktop and keep the files where they are. Opaline reads your Desktop folders and, on
a hotkey, lays them out over a blurred snapshot of whatever is on screen — your wallpaper, your live wallpaper, your
windows — like the iPad home screen. Items are grouped into named **panes**, a **rail** on the edge mirrors your
taskbar with hover previews, and a settings pane controls every part of the glass.

Opaline only **reads** your Desktop. It never moves, renames or deletes your files, and it makes no network requests.

## Features

| | |
|---|---|
| **Liquid glass** | Blurred, frosted backdrop you can still make out, lens refraction and specular rims on panes. Three styles: Liquid, Frost, Clear. |
| **Your Desktop, organised** | Items come straight from the Desktop folders with their real icons. Panes are virtual — drag a tile onto another to make one, rename it, ungroup it. |
| **Organised for you** | First run sorts IDEs, AI and code agents, dev tools, notes, browsers, chat, creative apps, games, utilities, university folders and code projects into panes. |
| **Search** | Type anywhere. Prefix matches first, <kbd>Enter</kbd> launches, arrow keys move around. |
| **Rail** | A vertical strip of your pinned and running apps; hover for window previews, click to jump. |
| **Settings** | Blur, saturation, tint, lens strength, corner radius, icon size, rail side, behaviour, hotkey, launch at login. All live. |
| **Easy to leave** | <kbd>Esc</kbd>, click empty space, click away, or press the hotkey again. A tray icon is always there. |

Feature status lives in the [work order](WORKORDER.md#4-work-packages).

## Quick start (development)

You need Windows 11, [Node.js](https://nodejs.org) 20+, [Rust](https://rustup.rs) (stable) with the MSVC toolchain
(Visual Studio Build Tools, "Desktop development with C++"), and the WebView2 runtime (included in Windows 11).

```bash
npm install
npm run tauri dev
```

Keep the overlay open while you tweak the look (it normally hides when it loses focus):

```bash
# PowerShell
$env:OPALINE_PIN = "1"; npm run tauri dev
```

Build an installer:

```bash
npm run tauri build
```

> **Windows path-length gotcha.** If the repo lives in a deeply nested folder, Cargo's build scripts can fail to link
> (`LNK1104`) because paths pass 260 characters. Point the build output somewhere short:
> `$env:CARGO_TARGET_DIR = "$env:LOCALAPPDATA\opaline-target"`.

## Using it

| Key | Does |
|---|---|
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Space</kbd> | Open / close (rebindable in Settings) |
| Type | Search anywhere |
| <kbd>Enter</kbd> | Launch the top result |
| <kbd>↓</kbd> then arrows | Move through tiles |
| <kbd>Esc</kbd> | Clear search → close pane/menu/settings → close Opaline |
| Click empty space | Close |
| Right-click a tile | Open · file location · copy path · add to / remove from pane · rename · ungroup |
| <kbd>Ctrl</kbd>+<kbd>Q</kbd> | Quit |

## Works well with

- **Live wallpapers** — [Wallpaper Engine](https://www.wallpaperengine.io) (paid, biggest library) or
  [Lively Wallpaper](https://github.com/rocksdanister/lively) (free, open source). Opaline snapshots what is on
  screen, so both just work. The wallpaper is frozen in the snapshot while the overlay is open.
- **A transparent taskbar** — a tool such as TranslucentTB. Opaline does not modify the taskbar.
- **Hidden desktop icons** — Windows: right-click the desktop → *View* → untick *Show desktop icons*.

## Where things live

| | |
|---|---|
| Panes and launch counts | `groups.json` in the app data folder (`%APPDATA%\dev.opaline.launcher`) |
| Hotkey | `config.json`, same folder |
| Look & behaviour settings | the webview's local storage (`opaline.settings`) |

Delete `groups.json` to start over; Opaline will organise your desktop again on the next open.

## Project layout

```
src/                 TypeScript + CSS UI (overlay, panes, rail, settings, glass/lens)
src-tauri/src/       Rust: hotkey, window lifecycle, capture, icons, taskbar, store
scripts/             make-icons.mjs (logo → app icons) · cdp.mjs (drive the running app for testing)
archive/winui3-beta  The failed first attempt, kept for reference (see DEVLOG.md)
assets/              Logo
docs/                Naming scheme, testing guide, agent handoff prompt
AGENTS.md            Guide for coding agents (also a good orientation for people)
```

## Roadmap

See [WORKORDER.md](WORKORDER.md) §4 and §11. Next up after 0.1: drag to reorder, pane colours and emoji, per-pane
hotkeys, run as administrator, theme presets, a command palette, and the Linux port.

## Contributing

Contributions are welcome — read [CONTRIBUTING.md](CONTRIBUTING.md) first. Please follow the
[code of conduct](CODE_OF_CONDUCT.md); report security issues as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE).
