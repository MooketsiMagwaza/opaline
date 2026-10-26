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
- **Launches** files and shortcuts the user clicks, and can focus windows from the rail.
- **Stores** two small files in its app data folder (`groups.json`, `config.json`) and settings in the webview's local storage.
- **Registers** one global hotkey, and optionally a "launch at login" entry if the user turns it on.
- **Makes no network requests** and contains no telemetry.

The UI talks to Rust only through the commands listed in the [work order](WORKORDER.md#8-rust--ui-contract). `load_store`/`save_store` accept only the file names `groups.json` and `config.json`.

## Supported versions

Only the latest release receives fixes while the project is pre-1.0.
