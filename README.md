<p align="center">
  <img src="assets/logo.svg" alt="Opaline" width="128" height="128" />
</p>

<h1 align="center">Opaline</h1>

<p align="center">
  An acrylic launcher for your desktop and installed apps.<br />
  Press <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Space</kbd> and your organised Desktop opens over a softened snapshot.
</p>

<p align="center">
  <a href="WORKORDER.md">Work order</a> ·
  <a href="CONTRIBUTING.md">Contributing</a> ·
  <a href="CHANGELOG.md">Changelog</a> ·
  <a href="DEVLOG.md">Dev log</a> ·
  <a href="docs/NAMING.md">Naming</a>
</p>

> **Status: `0.1.0` "Annealed" release candidate.** Windows 11 first; Linux is planned.
>
> The TypeScript build, frontend tests and Rust unit tests are clean locally. The remaining release gate is the real Windows interaction
> pass: grid reordering and persistence, tray/single-instance, installer and multi-monitor behaviour. The
> [work order](WORKORDER.md#0-current-status) lists every requirement with its real status and only marks something done
> once it has been seen working.

## What it is

You hide the icons on your Windows desktop and keep the files where they are. Opaline reads your Desktop folders and, on
a hotkey, lays them out over a blurred snapshot — your wallpaper, your live wallpaper, your
windows — like a centred home screen. Items are grouped into named **panes**, and a focused Appearance panel controls the acrylic blur and tint.
The experimental taskbar rail is temporarily disabled while the core overlay is tuned.

Opaline only **reads** your Desktop. It never moves, renames or deletes your files, and it makes no network requests.

## Features

| | |
|---|---|
| **Consistent acrylic** | One material system covers the launcher, search and transient panels; Appearance exposes direct blur, tint-strength and tint-colour controls. |
| **Centred app grid** | One rounded surface holds the app grid. Drag apps, folders and panes to reorder snapped grid cells; sparse final rows remain left-aligned to the same columns. Loose apps remain plain icon + name, while panes use one rounded mini-icon bubble with the name below. |
| **Paged launcher** | Previous/next controls switch between Home and a searchable alphabetical catalogue sourced from Windows AppsFolder, including classic Start-menu and packaged apps. |
| **Your Desktop, organised** | Items come straight from the Desktop folders with their real icons. Panes are virtual — drag a tile onto another to make one, rename it, ungroup it. |
| **Organised for you** | First run sorts IDEs, AI and code agents, dev tools, notes, browsers, chat, creative apps, games, utilities, university folders and code projects into panes. |
| **Search** | Type anywhere. Prefix matches first, <kbd>Enter</kbd> launches, arrow keys move around. |
| **Rail (later)** | The taskbar mirror implementation is retained but deprecated from the current release into a later roadmap phase. |
| **Settings** | Acrylic blur/tint, fabric opening motion, icon size, behaviour, hotkey and opt-in launch at login. All live. |
| **Easy to leave** | <kbd>Esc</kbd>, click empty space, click away, or press the hotkey again. A tray icon is always there. |

Feature status lives in the [work order](WORKORDER.md#4-work-packages).

## Download

Download the NSIS installer, MSI installer or portable Windows ZIP from the
[latest GitHub release](https://github.com/MooketsiMagwaza/opaline/releases/latest). Installers add **Opaline** to the Start Menu. Release downloads include SHA-256 checksums.

The first public Windows builds are unsigned, so Microsoft Defender SmartScreen may ask for confirmation. Verify the published
`SHA256SUMS.txt` before running a download. Code signing is a release-hardening follow-up, not something the installer bypasses.

Until the first tagged release is published, build locally with the development steps below.

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

The release process and artifact list are documented in [docs/RELEASING.md](docs/RELEASING.md).

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

Use the floating arrows at the bottom to switch between **Home** and **All apps**. All Apps is loaded after the first visible frame from
Windows AppsFolder, so classic Start-menu shortcuts and packaged apps do not slow the opening animation.

## Works well with

- **Live wallpapers** — [Wallpaper Engine](https://www.wallpaperengine.io) (paid, biggest library) or
  [Lively Wallpaper](https://github.com/rocksdanister/lively) (free, open source). Opaline snapshots what is on
  screen, so both just work. The wallpaper is frozen in the snapshot while the overlay is open.
- **A transparent taskbar** — a tool such as TranslucentTB. Opaline does not modify the taskbar.
- **Hidden desktop icons** — Windows: right-click the desktop → *View* → untick *Show desktop icons*.

## Where things live

| | |
|---|---|
| Panes, grid order and launch counts | `groups.json` in the app data folder (`%APPDATA%\io.github.mooketsimagwaza.opaline`) |
| Hotkey | `config.json`, same folder |
| Look & behaviour settings | the webview's local storage (`opaline.settings`) |

Delete `groups.json` to start over; Opaline will organise your desktop again on the next open.

## Project layout

```
src/                 TypeScript + CSS UI (overlay, panes, All Apps, settings, acrylic)
src-tauri/src/       Rust: hotkey, window lifecycle, capture, AppsFolder, icons, taskbar, store
scripts/             make-icons.mjs (logo → app icons) · cdp.mjs (drive the running app for testing)
archive/winui3-beta  The failed first attempt, kept for reference (see DEVLOG.md)
assets/              Logo
docs/                Architecture, testing, releasing, roadmaps and agent handoff
AGENTS.md            Guide for coding agents (also a good orientation for people)
```

## Roadmap

See [WORKORDER.md](WORKORDER.md) §4 and §11. Widgets, calendar and an opt-in Start-style surface remain future work in
[docs/PLATFORM_ROADMAP.md](docs/PLATFORM_ROADMAP.md). The current visual target is the single acrylic system described in
[docs/THEME_WORKORDER.md](docs/THEME_WORKORDER.md).

## Contributing

Contributions are welcome — read [CONTRIBUTING.md](CONTRIBUTING.md) first. Please follow the
[code of conduct](CODE_OF_CONDUCT.md); report security issues as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE).
