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
The bottom taskbar mirror shows pinned and running apps, with cached window previews. Numbered buttons in the corner switch between Desktop and named workspaces.

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
| **Workspaces** | Alt+1 opens Desktop; Alt+2–9 open named spaces for apps, files and folders. Add items by searching installed Windows apps or using the native folder/file picker, without moving your files. |
| **Taskbar mirror** | The retained rail now sits at the bottom, with running indicators, focus/restore/launch and cached previews. Ctrl+B collapses page navigation. |
| **Screen time** | Local Today / 7 days / 30 days / All time for foreground maximised apps, with charts, per-app detail and pause/clear controls. |
| **Focus** | Configurable Pomodoro timer, daily progression, quiet screen saver and slowly changing Zen reminders. Automatic saver is opt-in. |
| **Windows key** | Opt-in Windows-key tap opens All apps while Opaline runs. Windows chords and the native Start-button click remain available. |
| **Settings** | Acrylic blur/tint, fabric opening motion, icon size, behaviour, hotkey and opt-in launch at login. All live. |
| **Easy to leave** | <kbd>Esc</kbd>, click empty space, click away, or press the hotkey again. A tray icon is always there. |

Feature status lives in the [work order](WORKORDER.md#4-work-packages).

## Preview

Rendered examples use familiar app names and icons with synthetic folders, window contents and screen-time totals. They use the owner's current appearance values; no personal Desktop names or real captures are published.

![Desktop with side arrows and the bottom taskbar mirror](docs/images/desktop.png)

| Dev tools workspace | Local screen time |
|---|---|
| ![Apps and folders in a workspace](docs/images/workspaces.png) | ![Example screen-time totals](docs/images/screen-time.png) |

![Search Windows apps to add them to a workspace](docs/images/workspace-picker.png)

| Screen-time progression | Focus timer |
|---|---|
| ![Thirty-day screen-time graph with example app usage](docs/images/screen-time-chart.png) | ![Focus timer with Zen and screen saver options](docs/images/focus.png) |

![A pane peek showing its member names after a short hover](docs/images/folder-peek.png)

![Compact navigation leaving the bottom taskbar with an expand control](docs/images/compact-taskbar.png)

![How workspace navigation fits together](docs/images/workspace-flow.svg)

The [session work order](docs/SESSION_WORKORDER.md) lists every requested change, verification evidence and the owner test before a draft PR. [Design references and image policy](docs/UI_GUIDANCE.md).

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
| <kbd>Alt</kbd>+<kbd>1</kbd> / <kbd>2</kbd>–<kbd>9</kbd> | Desktop / named workspaces, while Opaline is open |
| <kbd>Shift</kbd>+<kbd>Tab</kbd> | Cycle pages; choose Ctrl+Tab in Behaviour to keep standard reverse focus |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd> / <kbd>T</kbd> / <kbd>F</kbd> | All apps / Screen time / Focus |
| <kbd>Ctrl</kbd>+<kbd>B</kbd> | Collapse / expand navigation |

Use the side arrows, Shift+Tab or trackpad/touch gestures to cycle between **Desktop**, named spaces and other pages. Six header icons put **All apps**, **Dev tools** and **Focus** left of search, with **Screen time**, **Home** and **Settings** on the right. The bottom taskbar shows only pinned and running apps. Hover a pane or folder for half a second to peek at its icon grid. All Apps is loaded after the first visible frame from
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
| Named spaces and pinned items | `workspaces.json`, same app data folder |
| Local screen time / Windows-key preference | `screen-time.json` / `shell.json`, same app data folder |

Delete `groups.json` to start over; Opaline will organise your desktop again on the next open.

Screen time starts while Opaline runs. Only the foreground maximised app counts; background/minimised windows, idle periods after 60 seconds and sleep gaps do not. Apps sharing a legacy Windows host can be combined under that executable. Screen time stores app identity and totals, not window titles or browsing history.

WebView2 is the Windows UI engine used by Tauri. Its processes are children of Opaline even when Task Manager groups them separately under Microsoft Edge WebView2. See [architecture](docs/ARCHITECTURE.md#processes-on-windows).

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
