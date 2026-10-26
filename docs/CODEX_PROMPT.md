# Prompt for continuing in Codex

## How to use

1. Put the project in a normal folder with a short path (not a deeply nested one) and run `git init` there. Commit the current state
   as the baseline so every change Codex makes shows up as a diff.
2. Open that folder in Codex (CLI or IDE). Codex reads [AGENTS.md](../AGENTS.md) on its own; the prompt below points it at the rest.
3. Paste the prompt. Review each change, and run the app yourself for the things an agent can't check (hotkey, focus, tray, a
   second monitor): the list is in [TESTING.md](TESTING.md) §3.

## The prompt

```text
You are continuing work on Opaline, a Windows-first desktop launcher built with Tauri v2 (Rust backend, plain TypeScript + CSS UI).
Pressing Ctrl+Alt+Space opens a full-screen "liquid glass" overlay: a blurred snapshot of the screen as the backdrop, the user's
Desktop items as glass tiles, auto-organised into named panes (like Start-menu / iPad folders), a search bar, a rail on the edge that
mirrors the taskbar with hover window previews, and a settings pane. Opaline only READS the Desktop folder; it never moves or deletes
the user's files and makes no network requests.

READ FIRST, in this order:
1. AGENTS.md          - commands, environment gotchas, rules. Follow it exactly.
2. WORKORDER.md       - section 0 (what is verified), section 2 (requirements R-01..R-19), section 12 (NEXT ACTIONS), section 13 (known issues).
3. DEVLOG.md          - why decisions were made; the failed WinUI 3 beta (archive/winui3-beta/ is reference only - do not build or extend it).
4. docs/TESTING.md    - how to run the app and drive its page with scripts/cdp.mjs without touching the mouse.

CURRENT STATE: the app builds and runs. Verified on the target laptop (Windows 11, Intel Iris Xe, 1920x1200 at 150% scaling): the overlay
opens over a screen snapshot; all 45 Desktop items show real icons; first-run auto-organise makes 12 panes; the pane popup opens and
Esc closes it; the settings pane, context menu, rail and hover preview card render with the lens (SVG displacement) glass. NOT yet
verified: the hotkey toggle itself, closing the overlay (Esc / click empty space / focus loss), drag and drop, rename and persistence,
settings persistence, hotkey rebinding, tray, single-instance, launch at login, rail click/magnify/thumbnail speed, cargo fmt/clippy, CI.

DO THIS, IN ORDER (full detail in WORKORDER section 12):
1. Make the baseline clean: npm install; npm run build; cargo fmt; cargo clippy --all-targets (fix findings); cargo check --locked.
2. Verify everything in WORKORDER section 0 "Not yet verified". Use scripts/cdp.mjs for page behaviour; for the hotkey, focus-on-open,
   focus-loss hiding, tray and single-instance, write down exact manual steps for the owner to run instead of guessing. Fix bugs you find.
3. Rail completeness: newer Windows 11 taskbar pins live in the registry (HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Taskband),
   not only as .lnk files; read both so the rail matches the real taskbar.
4. Tune the glass for legibility on a bright wallpaper and with a live wallpaper running; keep it cheap on an integrated GPU.
5. Add unit tests (organize.ts and groups.ts first), then Rust tests for desktop::display_name and the BGRA->RGBA conversion.
6. Prepare for publishing: list every placeholder from WORKORDER section 15 and ask the owner for the values; do not guess them.

RULES (the important ones - the rest are in AGENTS.md):
- Never modify, move or delete files on a real Desktop. Tests that change panes edit the owner's real groups.json: undo what you did.
- No network access, no telemetry, no remote code. Do not enable launch-at-login or change system settings while testing.
- Shell icon extraction must keep going through the single worker thread in src-tauri/src/icons.rs.
- Keep Windows-specific code behind cfg(windows) with a non-Windows fallback. Do not break the Linux port path.
- backdrop-filter panes must not live inside an element that has filter, mask, opacity<1, clip-path or its own backdrop-filter.
- New visual parameters become settings (default in src/settings.ts, control in src/panel.ts).
- Mark a WORKORDER item [x] only after you have SEEN it work, and say how in its Notes column. Update CHANGELOG.md (Unreleased) in the same change.
- Do not commit screenshots of the real app (they show the owner's folder names). Do not push or publish anything unless asked.
- On Windows, build from a short path or set CARGO_TARGET_DIR to a short folder (LNK1104 otherwise). Use OPALINE_PIN=1 for visual work.
  The overlay is full-screen and always on top: Ctrl+Q, the tray icon's Quit, or killing the opaline process gets you out.

WORK STYLE: small, reviewable commits using Conventional Commits (feat(panes): ..., fix(rail): ...). One work package at a time. Before
you start a step, say which requirement IDs it covers. When you finish a step, report: what changed, exactly how you verified it, what you
could NOT verify, and what you recommend next. If something in the work order is wrong or ambiguous, say so instead of working around it.
```
