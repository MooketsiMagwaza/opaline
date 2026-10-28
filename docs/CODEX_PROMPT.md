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
Pressing Ctrl+Alt+Space opens a full-screen acrylic overlay: a softened snapshot of the screen, the user's Desktop items arranged in a
snapped grid and auto-organised into named panes, a floating search bar, a Windows AppsFolder catalogue and a full Settings page. Loose items
are icon + name; panes use one mini-icon bubble. The retained taskbar mirror is now at the bottom; widgets remain deferred. Opaline only READS the Desktop folder; it
never moves or deletes the user's files and makes no network requests.

READ FIRST, in this order:
1. AGENTS.md          - commands, environment gotchas, rules. Follow it exactly.
2. WORKORDER.md       - section 0 (what is verified), section 2 (requirements R-01 onward), section 12 (NEXT ACTIONS), section 13 (known issues).
3. DEVLOG.md          - why decisions were made; the failed WinUI 3 beta (archive/winui3-beta/ is reference only - do not build or extend it).
4. docs/TESTING.md    - how to run the app and drive its page with scripts/cdp.mjs without touching the mouse.
5. docs/SESSION_WORKORDER.md - every 28 October request, current Home-screen arrows, owner release authorization and verification limits.

CURRENT STATE: the app builds and runs. On the target laptop (Windows 11, Intel Iris Xe, 1920x1200 at 150% scaling), all 45 Desktop items
show real icons, first-run auto-organise makes 12 panes, and Home uses a centred six-column grid whose sparse rows start at the first
column. All Apps enumerated 196 usable Windows AppsFolder entries after first paint. The active visual system is one acrylic vocabulary
with blur/tint controls; lens/refraction stays off the render path. Rail refresh and decoded-thumbnail warming run after presentation while visible. The earlier hidden-window backdrop cache measured 25.7 ms warm
request-to-visible; an uncached debug open measured 252.5 ms. Pointer/restart persistence, multi-monitor, installer installation and full
release acceptance still need owner passes.

LATEST RELEASE: v0.2.1 Borosilicate. Pinch navigates the Alt+1–5 pages; two-finger horizontal swipes navigate Home screens only.
The owner reports persistent lag and occasional missed gestures on the real trackpad. Keep W-51 open until measured and accepted on-device.

DO THIS, IN ORDER (full detail in WORKORDER section 12):
1. Make the baseline clean: npm install; npm run build; cargo fmt; cargo clippy --all-targets (fix findings); cargo check --locked.
2. Verify everything in WORKORDER section 0 "Not yet verified". Use scripts/cdp.mjs for page behaviour; for the hotkey, focus-on-open,
   focus-loss hiding, tray and single-instance, write down exact manual steps for the owner to run instead of guessing. Fix bugs you find.
3. Verify All Apps search, keyboard launch and a representative classic plus packaged app; keep enumeration after first paint.
4. Tune the acrylic controls and short app-grid motion on bright/live wallpapers; complete docs/THEME_WORKORDER.md and keep warm snapshot mode under 300 ms.
5. Complete docs/SPATIAL_WORKORDER.md's real pointer/restart pass.
6. Build and install the release artifacts, run CI, then follow docs/RELEASING.md. Do not push or tag unless the owner says to publish.

RULES (the important ones - the rest are in AGENTS.md):
- Never modify, move or delete files on a real Desktop. Tests that change panes edit the owner's real groups.json: undo what you did.
- No network access, no telemetry, no remote code. Do not enable launch-at-login or change system settings while testing.
- Shell icon extraction must keep going through the single worker thread in src-tauri/src/icons.rs.
- Keep Windows-specific code behind cfg(windows) with a non-Windows fallback. Do not break the Linux port path.
- backdrop-filter panes must not live inside an element that has filter, mask, opacity<1, clip-path or its own backdrop-filter.
- Keep Appearance focused: new user-facing material parameters need a clear use case, a default in src/settings.ts and a control in src/panel.ts.
- Mark a WORKORDER item [x] only after you have SEEN it work, and say how in its Notes column. Update CHANGELOG.md (Unreleased) in the same change.
- Do not commit screenshots of the real app (they show the owner's folder names). Do not push or publish anything unless asked.
- On Windows, build from a short path or set CARGO_TARGET_DIR to a short folder (LNK1104 otherwise). Use OPALINE_PIN=1 for visual work.
  The overlay is full-screen and always on top: Ctrl+Q, the tray icon's Quit, or killing the opaline process gets you out.

WORK STYLE: small, reviewable commits using Conventional Commits (feat(panes): ..., fix(rail): ...). One work package at a time. Before
you start a step, say which requirement IDs it covers. When you finish a step, report: what changed, exactly how you verified it, what you
could NOT verify, and what you recommend next. If something in the work order is wrong or ambiguous, say so instead of working around it.
```
