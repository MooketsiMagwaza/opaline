# Naming scheme

Short, consistent names so code, docs, releases and the GitHub repo all read the same way.

## Product

| | |
|---|---|
| **Name** | Opaline |
| **Tagline** | An acrylic launcher for your desktop and installed apps. |
| **Why** | Opaline glass is the milky, translucent kind — you can see the light through it, not the detail. That is the look. |

> Availability of the name (trademark, domain, package registries, GitHub handle) has **not** been checked. Do that before the first public release.

## Identifiers

| Where | Value |
|---|---|
| GitHub repository | `opaline` |
| Rust package / npm package | `opaline` (library crate `opaline_lib`) |
| Binary | `opaline` / `opaline.exe` |
| Bundle identifier | `io.github.mooketsimagwaza.opaline` |
| App data files | `groups.json`, `config.json` |
| Local storage key | `opaline.settings` |
| Environment variable | `OPALINE_PIN=1` keeps the window open on focus loss |
| Launch flags | `--hidden` (start in the tray), `--pin` (same as `OPALINE_PIN`) |

## Vocabulary

Use these words in the UI, code and docs, and nothing else for the same thing.

| Term | Meaning | Code |
|---|---|---|
| **Overlay** | The full-screen launcher window | `main` window |
| **Pane** | A named group of items (Start-menu / iPad folder) | `Group` in `groups.ts` |
| **Rail** | The vertical taskbar mirror on the edge | `rail.ts`, `taskbar.rs` |
| **Lens** | The refraction applied to a glass pane's backdrop | `glass.ts` |
| **Glass** | The material settings: style, blur, tint, saturation | `Settings` |
| **Backdrop** | The blurred snapshot behind everything | `#backdrop` |

## Versions and codenames

[Semantic Versioning](https://semver.org). Each **minor** release gets a codename from a glass type, in alphabetical order:

| Version | Codename |
|---|---|
| 0.1 | Annealed |
| 0.2 | Borosilicate |
| 0.3 | Crown |
| 0.4 | Dichroic |
| 0.5 | Etched |
| 0.6 | Flint |
| 0.7 | Gorilla |
| 0.8 | Hammered |
| 0.9 | Iridescent |
| 1.0 | Jewel |

Git tags: `v0.1.0`. Release titles: `Opaline 0.1 "Annealed"`.

## Commits and branches

[Conventional Commits](https://www.conventionalcommits.org): `type(scope): summary`.

- **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
- **Scopes:** `overlay`, `capture`, `icons`, `panes`, `rail`, `glass`, `settings`, `search`, `tray`, `platform-win`, `platform-linux`, `repo`.
- **Branches:** `main` is always releasable. Work happens on `feat/<topic>`, `fix/<topic>`, `docs/<topic>`.
- Reference work-order IDs in the body, e.g. `Refs: R-05, WP3`.

## Alternatives considered

Frostpane · Pane · Glasshouse · Haze · Lumen · Dewdrop — Opaline won on being a real word with the right meaning that is still short and searchable.
