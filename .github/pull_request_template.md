## What and why

<!-- One logical change. Link the issue and work-order IDs, e.g. "Refs: R-06, WP3". -->

## How I tested it

<!-- Windows build, GPU, display scaling, what you clicked. Say what you did NOT test. -->

## Screenshots / recording

<!-- Required for visual changes. -->

## Checklist

- [ ] `npm test`, `npm run build` and `npm run size` pass, and the browser UI suite (`scripts/verify-ui.mjs`, demo data only) for UI changes
- [ ] `cargo fmt`, `cargo clippy` and `cargo check` are clean
- [ ] Relevant lines of the acceptance checklist (WORKORDER §9) checked by hand
- [ ] `WORKORDER.md` statuses and `CHANGELOG.md` (Unreleased) updated — `[x]` only for things I verified
- [ ] Windows-specific code is behind `cfg(windows)` with a non-Windows fallback
- [ ] No network access, telemetry, or changes to the user's Desktop files
- [ ] New visual parameters are settings with defaults, and Frost / Clear styles still look right
