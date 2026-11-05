# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use this repository's
[private security advisory](https://github.com/MooketsiMagwaza/opaline/security/advisories/new) form and address it to
[@MooketsiMagwaza](https://github.com/MooketsiMagwaza). Include what you found, how to reproduce it and the version.

We aim to acknowledge reports within a few days and to fix confirmed issues before disclosing them.

## What Opaline touches

Knowing this helps you judge reports:

- **Reads** the user's Desktop folder and the shared Desktop folder (names, paths, icons). It never writes there.
- **Captures the screen** only when the frosted backdrop is enabled, plus **window thumbnails** for previews. Clear-canvas mode is transparent and skips the screen capture. Captures stay in memory and are never saved or sent anywhere.
- **Launches** files and shortcuts the user clicks, and can focus windows from the taskbar mirror.
- **Lists installed apps** (the Windows AppsFolder and Start menu, and the name in an executable's file details) to build All apps and to name apps in Screen time. Packaged apps are read by package, never modified.
- **Samples the foreground window** once a second while Opaline runs (which app, whether it is maximised, and how long the user has been idle) to build local Screen time. It stores per-app daily totals only, never window titles, and the user can pause or clear it.
- **Stores** five small files in its app data folder (`groups.json`, `config.json`, `workspaces.json`, `screen-time.json`, `shell.json`) and settings in the webview's local storage. A custom background image, if the user chooses one, is downsampled and kept in those settings.
- **Registers** one global hotkey, optionally a "launch at login" entry if the user turns it on, and, only if the user turns it on, a low-level keyboard hook that turns a lone Windows-key tap into Opaline's All apps (off by default; Windows chords and the native Start button are left alone).
- **Makes no network requests** and contains no telemetry.

The UI talks to Rust only through the commands listed in the [work order](WORKORDER.md#8-rust--ui-contract). `load_store`/`save_store` accept only the five file names above (`groups.json`, `config.json`, `workspaces.json`, `screen-time.json` and `shell.json`) and cap each at 1 MiB.

## Supported versions

Only the latest release receives fixes while the project is pre-1.0.
