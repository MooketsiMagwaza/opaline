# Opaline 0.4.0 live wallpapers work order

**Status:** scoped on 4 November 2026; nothing is built yet.
**Release intent:** 0.4.0 lets the launcher background be alive: a GIF, a video, or an HTML/JavaScript page that runs, instead of only a
still image. It reads Lively Wallpaper packages, so wallpapers people already have can be used. It follows the 0.3.0 release.

## 1. Outcome

Today the background is one still image (the captured Desktop, the bundled Opaline Aero landscape, or a custom image) drawn into
`#backdrop`. 0.4.0 makes the background a small **wallpaper engine**: a layer that can show

- a still image (what exists today),
- a GIF,
- a video (`mp4` / `webm`),
- an HTML page with JavaScript (canvas, WebGL, CSS animation, anything a web page can draw).

The panels, the glass materials and the refraction lens sit on top of it exactly as they do on a still image, so a live background is
bent and blurred by the glass (with Light bending on) like any other backdrop. Porting a GIF or video wallpaper then needs nothing more than dropping the file in.

## 2. What "use all the Lively wallpapers" can and cannot mean

[Lively Wallpaper](https://github.com/rocksdanister/lively) is a separate open-source app with its own wallpaper format and a library of
wallpapers made by many authors under many licences.

- Opaline **reads** the Lively package format, so wallpapers a person has in Lively (or downloaded as Lively packages) work in Opaline.
- Opaline **does not bundle, mirror or redistribute** third-party wallpapers, and does not copy Lively's code. Import is the user choosing,
  on their own machine, from their own library; "Import all" is one click for that, not a download.
- Each imported wallpaper keeps its author, licence and contact fields, and shows them in the gallery.
- Only the data-based types can work: GIF, video and web (HTML). Lively's application-type wallpapers (Unity, Godot, BizHawk and other
  executables) are programs, not pages, and are out of scope.
- Verify Lively's own licence and each format detail below against its documentation before implementing; nothing here is copied from it.

## 3. Requirements

| ID | Requirement | Priority | Acceptance summary |
|---|---|---:|---|
| R-76 | A background engine that shows an image, GIF, video or HTML page behind the launcher | P0 | Each type renders behind the panels; the lens and glass materials work over it; reduced motion shows a still frame |
| R-77 | HTML/JavaScript wallpapers run in a sandbox with no network and no access to Opaline | P0 | A wallpaper cannot reach the parent page, Tauri commands, local files outside its folder, or the network; a test wallpaper that tries each fails |
| R-78 | Read the Lively package format | P0 | A folder with `LivelyInfo.json` of a supported type loads: title, author, licence, thumbnail and entry file are read and shown |
| R-79 | Lively wallpaper properties work | P1 | `LivelyProperties.json` controls (slider, checkbox, dropdown, colour, textbox, folder dropdown, label, button) appear in Settings and reach the page through `livelyPropertyListener(name, value)`; values persist |
| R-80 | Import from a Lively library, including "Import all" | P1 | The user points at their Lively wallpapers folder, sees what is there, imports some or all; the originals are never modified; imported copies keep working if Lively is uninstalled |
| R-81 | A wallpaper gallery in Settings | P0 | Thumbnails, preview, choose, per-wallpaper properties, remove; the captured Desktop and the bundled landscape stay as choices |
| R-82 | Live wallpapers cost nothing when they cannot be seen | P0 | Playback, timers and animation frames stop while the overlay is hidden; opening never waits on a wallpaper; frame rate and memory are capped and measured |
| R-83 | Keep the privacy rules: no telemetry, no network by default | P0 | A wallpaper that needs the network is refused unless the owner decides otherwise (see §7); nothing about wallpaper use leaves the device |

## 4. Design

### 4.1 The layer

- `backgroundMode` gains `"live"`, with `liveWallpaper` naming the chosen package. `#backdrop` stays the still fallback and the first frame:
  the overlay opens on the still thumbnail or last frame at once, and the live layer fades in when it is ready.
- A new `src/wallpaper/` feature owns the engine: a registry of installed wallpapers, one renderer per type, and the sandbox host.
  It is loaded lazily the first time a live wallpaper is chosen, so people who never use one pay nothing at start-up.
- GIF uses an `<img>`; video uses a muted, looping `<video>` (WebView2 plays H.264 and VP9/AV1 where Windows has the codec; unsupported files
  are refused with a clear message at import, not at open).

### 4.2 The sandbox (R-77)

An HTML wallpaper is untrusted code. It runs in an `<iframe sandbox="allow-scripts">` (no `allow-same-origin`, so an opaque origin: no
access to the parent, storage or cookies; no navigation, popups, forms or downloads) loaded from a dedicated custom protocol that serves
only files under that wallpaper's folder (path traversal refused) with a strict Content-Security-Policy
(`default-src 'self' data: blob:; connect-src 'none'`). The Tauri IPC is never exposed to the frame. Keyboard and mouse forwarding are off
by default and enabled per wallpaper only when its manifest asks for it.

### 4.3 Lively compatibility (R-78, R-79)

- `LivelyInfo.json` supplies the type, entry file, title, description, author, licence and thumbnail. Parsing is strict and fail-fast: an
  unsupported or malformed package is reported at import with the reason, never half-loaded.
- `LivelyProperties.json` describes controls. Opaline renders each control type natively in Settings, stores the values in
  `wallpapers.json` (not in the wallpaper's own folder), and calls `livelyPropertyListener(name, value)` in the frame once on load and on
  every change, as Lively's documentation describes.
- Lively's audio and system-data APIs are not part of 0.4.0; wallpapers that need them load and run without them.

### 4.4 Import (R-80)

Settings offers "Import from Lively…". It opens a folder picker (the owned native dialog already used for the item picker), lists the
packages found, and copies the chosen ones into Opaline's data folder. The source folder is only ever read. Imported packages keep their
original files plus a record of where they came from.

### 4.5 Performance (R-82)

- Nothing live runs while the overlay is hidden: video is paused and released, the frame is removed, timers stop.
- The first useful frame is still the existing path; a wallpaper never delays an open.
- A frame-rate cap (default 30) and a pause on blur; a "calm" mode that shows the still thumbnail only.
- The refraction lens recomputes its backdrop every frame a live wallpaper changes; measure it, and offer to hold the lens off over a
  moving background if it costs too much.
- The frontend size budget (220 KiB raw, 62 KiB gzip; about 213.9 KiB raw and 59.8 KiB gzip used at 0.3.0) must be reconsidered: the engine ships as a separate lazy
  chunk, and `npm run size` needs to account for it.

## 5. Data and migration

- New `wallpapers.json`: installed packages (id, source, type, metadata, property values). Package files live under the app data folder.
- `opaline.settings` gains `backgroundMode: "live"` and `liveWallpaper`; existing settings keep working unchanged.
- Removing a wallpaper deletes only Opaline's copy.

## 6. Milestones

1. **Engine and sandbox.** Image/GIF/video/HTML layers, the custom protocol, the iframe host, pause-when-hidden, a fixture wallpaper and
   the failing-escape tests. Gallery with the built-in choices.
2. **Lively packages.** Manifest parser, thumbnails, the import flow including "Import all", the properties UI and the listener bridge.
3. **Performance and polish.** Frame cap, calm mode, memory and CPU measured hidden and visible, lens interaction, documentation.

## 7. Open decisions for the owner

- **Network.** Many Lively web wallpapers fetch weather, clocks or fonts. Opaline's rule is no network and no telemetry. The default stays
  off; whether to add an explicit, per-wallpaper, clearly-warned opt-in is a policy decision, not an engineering one.
- **Per virtual desktop or per monitor wallpapers** are left out of 0.4.0 unless wanted.
- **Audio-reactive wallpapers** (system audio data) need a native audio tap and are deferred.

## 8. Verification matrix

- **Unit:** manifest parsing (valid, malformed, unsupported type), property schema validation, path-safety of the protocol, settings
  normalisation.
- **Browser UI:** a fixture HTML wallpaper that draws a frame counter (proves it runs), tries to read the parent, fetch a URL and open a
  window (proves it cannot), is paused when the overlay is hidden, and is bent by the lens; GIF and video fixtures render.
- **Native Windows:** CPU, GPU and memory with a live wallpaper visible and hidden, open latency unchanged, video codecs, a real Lively
  library import, WebView2 sandbox behaviour.

## 9. Deliberate exclusions

- No bundled or downloaded third-party wallpapers, no wallpaper store, no account.
- No application-type wallpapers (executables), no remote URL wallpapers.
- No rendering behind the real desktop windows: the wallpaper is Opaline's background, visible in Opaline's overlay.
