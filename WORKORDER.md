# Opaline — Work Order

The single source of truth for what Opaline must do, how it is built, what has actually been checked, and what comes next.
Everything in the original brief is traceable to a requirement ID (`R-xx`). Pull requests and commits should reference the IDs
they touch.

**Latest release:** [`v0.3.0`](https://github.com/MooketsiMagwaza/opaline/releases/tag/v0.3.0) · codename **Crown** (see [docs/NAMING.md](docs/NAMING.md)), published 5 November 2026 at the owner's instruction. It was released with the owner's native checks still open, above all the trackpad lag and missed swipes tracked as W-51; the previous release was [`v0.2.1`](https://github.com/MooketsiMagwaza/opaline/releases/tag/v0.2.1) Borosilicate.
**Current candidate:** none. `v0.3.0` shipped everything in `[0.3.0]` of the changelog. (`v0.2.2`, a candidate it superseded, was never published.)
**Next development target:** `v0.4.0` — live wallpapers (GIF, video and sandboxed HTML/JavaScript backgrounds that read Lively packages), scoped in [V0_4_WORKORDER.md](docs/V0_4_WORKORDER.md). `v0.3.0`'s remaining acceptance steps are still the owner's native checks (trackpad, WebView2, the native checklist). The live layout customiser and restart caching follow in 0.5.0, the Activity Center in 0.6.0, completion feedback in 0.3.x; see §0 of [V0_3_WORKORDER.md](docs/V0_3_WORKORDER.md).
**Platforms:** Windows 11 first. Linux is a planned port (R-17); platform-specific code stays behind `cfg(windows)`.
**Last updated:** 2026-11-05 — v0.3.0 "Crown" released; its native acceptance checks remain open.

**Current request intake:** [SESSION_WORKORDER.md](docs/SESSION_WORKORDER.md) lists every owner request from this chat, including named spaces, taskbar/icon parity, screen time and charts, Focus/Zen/saver, startup, screenshots, coding rules and remaining Windows acceptance checks.
The superseding 0.3.0 experience scope and new requirements R-52–R-85 are tracked in [V0_3_WORKORDER.md](docs/V0_3_WORKORDER.md).

**Repository note:** the GitHub repository was re-created on 5 November 2026 with its full history and tags; pull request numbers in these records (#3–#7) refer to the previous repository.

**Status legend** — `[x]` verified working on a real machine (how is noted) · `[~]` implemented, not yet verified or only partly
verified · `[ ]` not started. **Priority:** P0 targets the current preview · P1 next · P2 later. Mark `[x]` only for things you have seen work.

---

## 0. Current status

**0.3.0 "Crown" (released 5 November):** the experience release; its installers were built and installed on the owner's machine. It adds light-bending glass and material presets (R-75), staged Settings as a panel with an expand button and six sections (R-84), taskbar placement on any edge (R-56), Taskbar ends and Sidebar arrangements (R-74), gesture motion and hover intent (R-68, R-69), real app names and icons (R-70), Android-style Home screens (R-71), a help page (R-72), chart axes (R-73) and page fades (R-85). It has been verified in headless Chrome against demo fixtures with mocked IPC: 64 unit tests, the Rust tests (18 at the release), the UI suite and the size budget (220 KiB raw / 62 KiB gzip) pass. It shipped before the owner's native pass, so the physical trackpad (W-51), WebView2 light bending on the target GPU, the taskbar at each edge and the native checklist are still the owner's to confirm. The two sections below record the 28 October candidate and the first real-app pass; they are kept as evidence, not as a description of 0.3.0.

**28 October candidate (historical):** named workspaces, local screen time with daily graphs, centered side-arrow navigation, compact mode, the reactivated taskbar mirror, cached previews, Windows-key opt-in, settings validation, group-origin popup motion, Focus timer, Zen and an opt-in screen saver are implemented. Browser checks cover keyboard/navigation/persistence/layout with demo fixtures. Native checks enumerated 197 apps, read eight rail entries, captured a preview, round-tripped workspace storage/pause state, and confirmed the Windows-key hook is available but off. Cached demo preview presentation measured 9–33 ms; native cold captures measured 66.5–131.6 ms. The current Windows login preference is off. Real key/chord, window-icon parity, login start, virtual-desktop/PowerToys, pointer, installer and CI acceptance remain open. The earlier observations below are historical evidence, not verification of every new path.

**28 October navigation revision (0.3.0 changed the screens and Settings described here):** Home is a read-only view of the Windows Desktop. Tab/Shift+Tab and the side arrows move through Home and its custom screens, shown as small dots (0.3.0 starts with Desktop and a plus page instead of seeding two empty screens). Alt+1–5 selects Home, All apps, Screen time, Focus and Settings (a panel with an expand button since 0.3.0). A shared picker adds apps, folders or files only to custom screens. Side arrows appear on Home screens and move through those screens, while Ctrl+Tab changes the main page. The fabric entrance was removed for a short grid pop. Isolated browser screenshots cover each main screen and each Settings section. The owner authorized the PR, merge and v0.2.0 release on 28 October 2026; unverified real Windows interactions remain recorded below.

The app **builds and runs**. It was started with `npm run tauri dev`, and its page was driven and screenshotted through
WebView2's local debugging port (`scripts/cdp.mjs`, see [docs/TESTING.md](docs/TESTING.md)) on the target laptop
(Windows 11, Intel Iris Xe, 1920×1200 at 150 % scaling).

**Seen working** (first real-app pass, v0.1–0.2; kept as evidence. Later work is covered by the browser suite and still needs the native pass)

- Full-screen overlay opens both through the snapshot path and through the transparent, capture-free clear-canvas path; no flash of an empty window.
- All 45 Desktop items (user + shared Desktop) listed with their **real icons**, including `.lnk` shortcuts, folders and an `.exe`.
- First-run **auto-organise** produced 12 panes (IDEs, AI & code agents, Dev tools, Browsers, Chat, Creative, Notes & planning,
  Games & music, Utilities, University, Code projects, Archive) and left 8 items loose, exactly as the rules in §6 intend.
- **Pane popup** opens from its tile with the pane's name and members; **Esc** closes it.
- The current **acrylic styling** gives search, Home, All Apps, settings, popup and menus one consistent fill, rim and shadow; the earlier
  lens treatment was removed from the active path.
- **Settings pane** opened with five sections at the time (Appearance, Layout, Behaviour, Panes, About; 0.3.0 has six, see §5); Appearance exposes blur and tint, launch at login was observed off, and rail settings are feature-flagged out.
- **Context menu** renders with Open / Open file location / Copy path / Add to pane ▸.
- **Search** filters the grid ("dis" → Discord).
- **Rail** lists the pinned File Explorer entry and the running Claude window with a running dot; hovering opens the preview card.
- The global **Ctrl+Alt+Space** hotkey opens and closes the overlay from another foreground app; **Esc** closes the full overlay.
- Transparent request-to-visible measurements on the target laptop were 9.2–49.2 ms across stable warm opens; one 57.1 ms open and 72–84 ms rebuild/jitter outliers were also recorded.
- UI type-checks (`tsc --noEmit` clean); Rust compiles with no errors.
- The logo rasterises and the full icon set is generated from it (`npm run icons`).
- Frontend/store/theme tests (10) and Rust unit tests (9) passed locally then (the 0.3.0 candidate runs 64 and 18); production UI bundle and NSIS release installer are clean.

**Not yet verified** (do these first — §12 step 2)

- Closing the whole overlay with **click on empty space** and **focus loss**; Esc and the hotkey were exercised successfully.
- **Drag and drop**, **rename persistence**, **ungroup**, **remove from pane**, and that `groups.json` is written and survives a restart.
- **Settings persistence** and the live effect of each control; **Frost** and **Clear** styles; behaviour on a bright wallpaper.
- Hotkey **rebinding**, **launch at login**, **tray icon**, **single-instance** wake-up.
- **Rail**: click to focus/launch, magnification, thumbnails after the optimisation below, and whether the list matches the real taskbar
  (only two entries appeared; Windows 11 stores some pins in the registry rather than as shortcuts — see §13).
- **Performance**: snapshot-path latency, idle memory and scrolling smoothness. The transparent warm path is approximately at its 50 ms target, with the outliers noted above.
- The 0.2.0 NSIS installer built locally; its install/uninstall pass and the remaining real interaction matrix have not yet completed. The 0.2.1 local and GitHub CI checks passed. PR #4 merged; the v0.2.1 release workflow published NSIS, MSI, portable ZIP and checksums, and downloaded assets matched those checksums. Installer installation and real-device gesture acceptance remain open.

**Changed after the last visual check (unverified):** clear canvas is now a transparent, capture-free fast path; backdrop capture
downsamples in GDI; warm opens defer Desktop/rail refreshes; lenses are bounded/cached; centred grid ordering, Taskband registry pins,
collision-aware dock motion and the earlier fabric opening sequence were added. The fabric sequence was replaced in the latest navigation revision. Remaining paths need the real-app pass before their statuses become `[x]`.

## 1. Objective

A frosted, liquid-glass desktop launcher. Press **Ctrl+Alt+Space** and a full-screen overlay appears over a blurred, tinted
snapshot of whatever is on screen. On it:

- every item from your Desktop folders, as glass tiles with their real icons;
- named **panes** (groups) like Start-menu or iPad folders, organised automatically and editable by hand;
- a search bar that finds anything instantly;
- a compact **taskbar mirror** (pinned and running apps) that docks to any screen edge, with cached window previews on hover;
- a Settings panel, expandable to the whole window, controlling the glass and launcher behaviour with Done and Cancel.

Desktop icons stay hidden in Explorer. The files stay in the Desktop folder. **Opaline only reads them.**

## 2. Brief → requirements

| ID | Requirement | Pri | Status | Notes |
|----|-------------|-----|--------|-------|
| R-01 | **Ctrl+Alt+Space** toggles the launcher; the combo is rebindable in settings | P0 | `[~]` | Global open/close toggling observed; rebinding not exercised |
| R-02 | Items come straight from the Desktop folders (user + shared, OneDrive-aware); files are never moved, renamed or deleted | P0 | `[x]` | 45 items incl. shared desktop; read-only by construction. OneDrive-redirected desktop untested |
| R-03 | Real icons for `.lnk`, `.exe`, folders, documents | P0 | `[x]` | All 45 shown on one cold start. Ten-cycle repeatability not yet checked |
| R-04 | Search: S focuses it, instant ranked results, Enter launches the top hit and arrows navigate | P0 | `[~]` | Browser checks cover S focus and no automatic focus; native keyboard and result launch still need owner confirmation; W-49 |
| R-05 | Panes: drag a tile onto another to make one, onto a pane to add, click to open the popup grid | P0 | `[~]` | Panes + popup seen; drag and drop not exercised |
| R-06 | Pane naming: rename in place; names persist; new panes open into rename | P0 | `[~]` | Name field renders; rename + persistence not exercised |
| R-07 | Auto-organise (IDEs, AI & code agents, dev tools, …), done for the user on first run, re-runnable | P0 | `[x]` | First run verified (12 panes). "Organise now" button not exercised |
| R-08 | Consistent acrylic look: softened backdrop remains recognisable, with clear borders and restrained highlights | P0 | `[~]` | Looks right on a dark backdrop; bright-wallpaper and GPU passes remain |
| R-09 | Works over a transparent desktop / live wallpaper (snapshot of what is on screen) | P0 | `[~]` | Snapshot path works; not tried with a live wallpaper running |
| R-10 | Closes on **Esc**, empty-space click, focus loss, and the hotkey | P0 | `[~]` | Whole-overlay Esc and hotkey close observed; empty-space click and focus loss not exercised |
| R-11 | Settings pane: acrylic blur/tint, layout, behaviour, hotkey, launch at login, about | P0 | `[~]` | Focused Appearance controls render; per-control persistence pass remains |
| R-12 | Rename / ungroup / remove / add to pane via right-click as well as dragging | P0 | `[~]` | Menu renders; actions not exercised |
| R-13 | **Rail**: taskbar mirror (pinned + running) docked to the bottom, top, left or right edge; click focuses or launches | P0 | `[~]` | Retained implementation reactivated; native enumeration checked; 0.3.0 adds edge and alignment placement (R-56), covered by the browser suite; full parity/focus/launch pass pending |
| R-14 | Cached rail hover previews, click to focus, optional magnification | P0 | `[~]` | Decoded bounded cache, shared requests, background refresh and GDI downsampling; owner hover/focus pass pending |
| R-15 | Identity & repo: logo, naming, README, contributing, license, changelog, CI, templates | P0 | `[~]` | v0.2.1 CI/tag release and synthetic screenshots published; downloads match checksums. Installer smoke testing and unsigned-artifact hardening remain |
| R-16 | Convenience: usage ordering, open file location, copy path, tray, launch at login | P0 | `[~]` | Implemented; none exercised |
| R-17 | Linux port later | P2 | `[ ]` | Non-Windows stubs compile in principle; never built |
| R-18 | WinUI 3 attempt logged as a failed beta, source archived | P0 | `[x]` | `DEVLOG.md`, `archive/winui3-beta/` |
| R-19 | Live wallpaper and taskbar transparency are external tools; document compatibility | P0 | `[~]` | Documented in README; not tested with either tool |
| R-20 | Loose items, folders and panes can be reordered only in a centred, snapped grid and persist across display sizes | P0 | `[~]` | Implemented with ordered metadata; real pointer/restart pass pending ([grid work order](docs/SPATIAL_WORKORDER.md)) |
| R-21 | Acrylic canvas uses a downsampled snapshot and a hidden-window warm cache; retained clear mode provides a capture-free experimental path | P0 | `[~]` | Uncached debug open measured at 252.5 ms; cached warm open at 25.7 ms. Release measurements remain |
| R-22 | Short app-grid opening motion and collision-aware dock motion respect reduced motion | P0 | `[~]` | 200 ms app pop replaces fabric; live visual/GPU pass pending |
| R-23 | One rounded surface holds the app grid; loose apps use icon + name without a bubble; panes use one rounded mini-icon bubble with the name below | P0 | `[~]` | Hierarchy observed in the real app; long-label/clipping/theme matrix pending ([theme work order](docs/THEME_WORKORDER.md)) |
| R-24 | Search floats independently from the canvas and item cards | P0 | `[~]` | Search active; deprecated rail is feature-flagged off |
| R-25 | One persistent acrylic engine exposes blur intensity, tint strength and tint colour | P0 | `[~]` | Implemented; migration/persistence/contrast/GPU matrix pending |
| R-26 | Floating page navigation exposes Home and the installed-app catalogue without slowing the first frame | P1 | `[~]` | Windows AppsFolder enumeration runs after presentation; complete keyboard pass remains |
| R-27 | Named Home screens for apps/files/folders; Tab moves between them | P0 | `[~]` | Serialized metadata, rename/remove/pin, direct folder paths; W-03/W-42 |
| R-28 | Local maximised foreground-app time, Today / All time, pause and clear | P0 | `[~]` | Native sampler, date/sleep tests; owner usage/idle/restart pass remains; W-01 |
| R-29 | Side-arrow pages, Alt+1–5 routing, Tab Home screens and compact taskbar view | P0 | `[~]` | Browser keyboard/persistence/layout checks; W-02/W-05/W-42 |
| R-30 | Opt-in Windows-key tap opens All apps; Windows chords retained | P0 | `[~]` | Hook available, off by default; real key/chord acceptance required; W-08 |
| R-31 | Current Windows desktop receives Opaline; desktop-aware backdrop cache | P0 | `[~]` | Documented COM interface; real desktop/PowerToys pass remains; W-04 |
| R-32 | Group-origin popup motion and readable two-line labels | P0 | `[~]` | Browser origin/reduced-motion checks; native pointer pass remains; W-15/W-18 |
| R-33 | Custom scrollbar and a larger centre surface with a compact taskbar | P0 | `[~]` | Browser layout screenshots and narrow bounds; W-19/W-21 |
| R-34 | Running app icons match their Windows taskbar identity | P0 | `[~]` | Window-icon path precedes shortcut fallback; real ChatGPT comparison remains; W-20 |
| R-35 | Period menu, 7/30-day usage graphs, per-app progression | P0 | `[~]` | Browser chart/menu checks; daily native history tests; W-23/W-24 |
| R-36 | Pomodoro timer with configurable breaks, progress and persistence | P0 | `[~]` | Deadline/transition unit tests and browser UI check; native/restart pass remains; W-25 |
| R-37 | Zen reminders and optional in-app idle screen saver | P1 | `[~]` | Browser mode checks; real idle and wake pass remains; W-26 |
| R-38 | Faster hidden startup and clear launch-at-login state | P0 | `[~]` | Concurrent boot, deferred UI work, bounded icon cache; next-sign-in test remains; W-27 |
| R-39 | Use Opaline navigation glyphs rather than a Windows logo | P0 | `[~]` | Header app-grid glyph and bottom Home outline in demo screenshot; native pass remains; W-22 |
| R-40 | Keep Home identical to the Windows Desktop | P0 | `[~]` | Desktop remains read-only; custom screens own added apps/folders/files; browser and native owner checks remain; W-43 |
| R-41 | Settings with live previews; changes stage and apply on Done | P0 | `[~]` | A full page in 0.2; since 0.3.0 a panel with an expand button, six sections and Cancel/Done that grey out when nothing is staged (R-84). The browser suite covers it; native persistence pass remains; W-44 |
| R-42 | Complete public demo gallery, including blank desktop illustration | P0 | `[~]` | Isolated screenshots and original vector/PNG; owner review remains; W-46 |
| R-40 | Adopt owner coding rules from the supplied screenshot | P0 | `[~]` | Added to AGENTS.md and applied to touched code; W-28 |
| R-41 | Demo groups reflect realistic app/folder relationships | P0 | `[~]` | Browser screenshot and fixture assertions; W-29 |
| R-42 | Taskbar icons remain sharp; Opaline does not add its own dock button | P0 | `[~]` | Larger window icon and lower hover scale; real taskbar comparison pending; W-30/W-31 |
| R-43 | Four header icons, Home-only side arrows and icon-grid hover peeks | P0 | `[~]` | Browser interaction/layout checks; Windows pointer pass pending; W-32/W-33/W-37 |
| R-44 | Taskbar scrollbar hidden and taskbar/search heights match | P0 | `[~]` | Computed-style and rendered viewport check; native scaling pass pending; W-34/W-35 |
| R-45 | Swipe/pinch page navigation for trackpads and touch | P1 | `[~]` | Owner confirmed physical pinch works after WebView2 input was enabled. Pinch selects Alt+1–5 pages; swipe selects Home screens only. Browser routing/wraparound checks pass. Owner reports remaining lag and occasional missed swipes; W-36/W-50/W-51 |
| R-49 | Shared ambient material and more active saver | P1 | `[~]` | Demo Zen/saver screenshots show the shared backdrop and acrylic; rotating prompt and motion code checked in browser. Real idle/wake and owner visual pass pending; W-48 |
| R-46 | Brighter theme-matched header capsules | P0 | `[~]` | Browser visual pass; owner theme/scaling pass pending; W-38 |
| R-47 | Add workspace items through Windows app search and native pickers | P0 | `[~]` | Browser app search/save check and native compile; owner picker pass pending; W-39 |
| R-48 | Compact grouped charts and Focus/Zen visual pass | P1 | `[~]` | Browser chart geometry and screenshots; owner visual pass pending; W-40/W-41 |
| R-50 | Make trackpad gestures consistently responsive and smooth | P1 | `[~]` | 2026-11-04: swipe and pinch motion reworked (R-68 in the 0.3 work order); headless Chrome still sometimes ignores a pinch for about a second after a committed one, which may be the W-51 symptom. Owner isolated consecutive-swipe failure: the 350 ms wheel-burst lock was extended by inertial events, while pinch reset its separate mode. Candidate rearms after 120 ms silence/160 ms burst gap; browser test performs consecutive same-direction swipes without mouse movement. Physical owner retest required; W-51. |
| R-51 | Distinguish between-item insertion from grouping, manually reorder pane contents and provide one-shot Home sorting | P0 | `[x]` | Owner accepted the native v0.2.2 pointer preview on 1 November; stable marker, persistence tests, the unit suite of that day, production build and isolated UI suite pass ([grid work order](docs/SPATIAL_WORKORDER.md)) |

R-52 onward belong to the 0.3.0 and later plans: R-52–R-75 and R-84–R-85 are in [docs/V0_3_WORKORDER.md](docs/V0_3_WORKORDER.md), R-76–R-83 (live wallpapers) in [docs/V0_4_WORKORDER.md](docs/V0_4_WORKORDER.md). R-40, R-41 and R-42 each appear twice above because two intake rounds reused the numbers; the W-numbers in the notes tell them apart.

## 3. Architecture

```
┌─ Rust (src-tauri/src) ───────────────────────────┐   ┌─ UI (src/, TypeScript + CSS) ─────────────────┐
│ lib.rs        hotkey · tray · window lifecycle ·  │   │ app/        launcher.ts shell, keys, wiring   │
│               commands                            │   │ grid/       tiles, panes, popup, drag, screens│
│ capture.rs    screen snapshot, window thumbnails  │◄─►│ navigation/ pages, tray, gestures, motion     │
│ desktop.rs    scan Desktop folders                │   │ taskbar/    mirror on any edge + previews     │
│ icons.rs      one STA worker, shell icons → PNG   │   │ settings/   staged panel, store, previews,    │
│ identity.rs   app names and icons (package family,│   │             help                              │
│               Start menu, file details)           │   │ appearance/ presets, backgrounds              │
│ taskbar.rs    running windows + pinned items      │   │ activity/ focus/  screen time, charts, Focus  │
│ apps.rs · usage.rs · idle.rs · workspace.rs ·     │   │ core/       api, dom, icons, menu, glass lens,│
│ picker.rs · start_menu.rs · startup_log.rs        │   │             refraction, motion, hover intent  │
│               apps, usage, idle, screens, login   │   │ data/       shortcut and help data            │
│ store.rs      groups.json / config.json / …       │   └───────────────────────────────────────────────┘
└───────────────────────────────────────────────────┘
```

**Show sequence** (why there is no OS blur material any more):

1. Hotkey → Rust captures the monitor under the cursor *before* the window is on screen and downsamples it to a JPEG.
2. Rust fits the hidden window to that monitor (borderless full-screen) and emits `launcher-prepare { snapshot }`.
3. The UI sets the backdrop, waits for it to decode, loads Desktop items if needed, then calls `present`. Apps, icons and taskbar refresh after the first frame.
4. Rust shows and focuses the window; the UI transitions the stage in.

If the UI never answers, Rust presents anyway after 900 ms. On first launch the overlay opens when the UI calls `ready`.
The snapshot is a still image, so a live wallpaper is frozen while the overlay is open — a deliberate trade for full control of
blur, tint and lensing.

**Rules:** no network access · Desktop files are read-only to Opaline (panes are metadata) · anything platform-specific is behind
`cfg(windows)` with a harmless non-Windows branch · shell icon calls only ever go through the single icon worker.

**CSS fact that cost time:** `backdrop-filter` only sees content inside the nearest "backdrop root" ancestor — any ancestor with
`filter`, `mask`, `opacity < 1`, `clip-path` or its own `backdrop-filter`. Glass panes must therefore be children of `#shell` /
`.stage` and never inside the masked `#grid-layer` or a blurred layer.

## 4. Work packages

### WP1 — Overlay & capture (R-01, R-08, R-09, R-10)
- [x] Borderless full-screen window fitted to the cursor's monitor, always on top, no taskbar entry (seen: 1920×1200, foreground)
- [x] `capture`: GDI `BitBlt` of the monitor → downscale → JPEG data URL (backdrop matched the screen)
- [x] `launcher-prepare` → `present` handshake
- [~] 900 ms safety net · hide on empty-space click / focus loss (ignored 500 ms after presenting) / hotkey
- [~] `--pin` / `OPALINE_PIN`: used throughout development; works
- **Accept:** hotkey shows the overlay in under ~300 ms on the target laptop; no flash; Esc and click-off both close it.

### WP2 — Desktop items & icons (R-02, R-03)
- [x] Scan user + shared desktop; skip hidden/system/`desktop.ini`; strip `.lnk`/`.url`; de-duplicate by name
- [x] Icons via `IShellItemImageFactory` on one STA thread, serial, retry once; premultiplied BGRA → RGBA PNG
- **Accept:** all items show their real icon, repeatably (ten open/close cycles); missing icons fall back to a letter tile.

### WP3 — Panes (R-05, R-06, R-07, R-12)
- [x] `groups.json` load/save code, pruning of vanished items (write/restart persistence **not yet verified**)
- [x] Auto-organise rules; first-run run seen
- [x] Pane tile with mini icon grid; popup that grows from the tile; `Esc` closes it
- [~] Drag & drop (tile→tile creates a pane, tile→pane adds, popup member→outside removes)
- [~] Context menu actions · rename · ungroup
- **Accept:** panes survive restart; rename persists; deleting a Desktop file removes it from its pane; ungrouping returns members to the grid.

### WP4 — Search & keyboard (R-04, R-16)
- [~] Contains-match with prefix first; panes match by name; Enter launches/opens the top hit; ↓ into the grid; arrows by tile and row; typing anywhere focuses search
- [~] Optional "most used" ordering
- **Accept:** every action reachable without the mouse.

### WP5 — Acrylic surfaces (R-08, R-09, R-23, R-24, R-25)
- [x] Backdrop: snapshot with CSS blur/saturation/brightness + tint, oversized to hide blur edges
- [x] Large floating/transient surfaces: flat translucent fill (no white-to-colour sheen since 0.3.0), `backdrop-filter`, hairline border, lit rim and shadow
- [x] One acrylic token set with direct blur, tint-strength and tint-colour controls, plus named material presets (Opaline Original, Windows Mica, One UI Glass, Frutiger Aero, Deep Night) and your own saved ones
- [~] Light bending (R-75): `core/refraction.ts` computes a convex-squircle displacement map with Snell's law and `core/glass.ts` applies it per element as an SVG filter inside `backdrop-filter`. Chromium/WebView2 only, absent at 0%, GPU-heavy. A pixel-diff test proves it displaces; the cost on the target Intel GPU is unmeasured
- [~] One rounded apps surface · centred grid with left-aligned sparse rows · plain app/folder icon + label · pane mini-icon bubble + label below · independently floating search
- **Accept:** complete the bright/dark, card-clipping, persistence, migration, reduced-motion and integrated-GPU matrix in
  `docs/THEME_WORKORDER.md`; no per-card backdrop filters.

### WP6 — Taskbar mirror (R-13, R-14, R-56) · reactivated
- [x] `taskbar`: enumerate windows with Alt-Tab rules; group by executable; read the pinned-taskbar folder; resolve link targets
- [x] Rail UI renders (pinned + running, running dot, window-count badge)
- [~] Placement (0.3.0): bottom, top, left or right edge with start, centre or end alignment; previews, magnification, scrolling and the page's clearance follow the edge. Browser suite verified; the native look is pending
- [~] Hover preview card opens; thumbnails (`PrintWindow`, `PW_RENDERFULLCONTENT`) — re-test speed; click to focus; magnification; click to launch
- [~] Decoded cache hits render immediately; stale images refresh in background; requests deduplicate; closed handles are evicted and cache is bounded to 32. Cached target ≤50 ms; cold captures measured separately.
- **Accept:** rail matches the real taskbar apart from the system tray and documented Store-app edge cases; previews within ~300 ms.

### WP7 — Settings panel (R-11, R-84)
- [x] Six sections with headings render from a schema (`settings/panel.ts`). Changes stage in a draft and apply on Done; Cancel restores; both grey out while nothing is staged; a corner button expands the panel to the whole window
- [~] Every control applies live and persists · hotkey recorder · launch-at-login switch · reset
- **Accept:** each setting in §5 reachable, persists across restarts, does what its label says.

### WP8 — Lifecycle & behaviour (R-01, R-10, R-16)
- [~] Tray icon (toggle on click, Show/Quit) · single instance (second launch opens the overlay) · `--hidden` for login start
- [ ] Multi-monitor: open on the cursor's monitor and re-fit when it changes (code present, untested)
- **Accept:** quitting leaves no process behind; a second launch doesn't fight over the hotkey.

### WP9 — Identity & repo (R-15, R-18)
- [x] README, WORKORDER, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, LICENSE, CHANGELOG, templates, CI file, AGENTS.md, docs/
- [x] Logo (`assets/logo.svg`) and generated icon set (`npm run icons`)
- [x] DEVLOG with the failed WinUI 3 beta; source in `archive/winui3-beta/`
- [~] Publishing metadata, tag workflow and synthetic screenshots are present; v0.2.1 PR/main CI and release workflow passed. Installer smoke testing and unsigned-artifact hardening remain
- **Accept:** a stranger can clone, build, run and contribute using only the repo.

### WP10 — Linux port (R-17) · P2
- [ ] Capture via PipeWire/portal (Wayland) and X11 fallback
- [ ] Icons from the icon theme / `.desktop` files; items from `~/Desktop` and `.desktop` entries
- [ ] Window list/previews per compositor (best effort) or hide the rail
- [ ] CI job on `ubuntu-latest`

### WP11 — Quality
- [x] Frontend unit tests (64 Vitest tests on 5 November): organisation, groups, drag ordering, settings validation and drafts, workspace writes, focus deadline/phase transitions, chart axes, hover intent, refraction and user presets
- [x] Rust unit tests (22 Rust tests on 8 November): display names, pixels, Taskband matching, app identity, usage/date/sleep attribution and the startup-log timestamps
- [x] Browser UI suite (`scripts/verify-ui.mjs`, Playwright, demo fixtures, mocked IPC) covers navigation, Settings, the taskbar at every edge, gestures, fades and Home screens; `npm run size` enforces 220 KiB raw / 62 KiB gzip
- [ ] Manual pass of §9 before each release
- [~] Performance budget: transparent stable warm opens 9.2–49.2 ms on the target laptop, with one 57.1 ms open and 72–84 ms rebuild/jitter outliers; snapshot show ≤ 300 ms, idle ≤ 120 MB and scrolling still need measurement

### WP12 — Focus, progression and startup (R-33–R-40)
- [~] Custom scrollbar, larger app surface and compact taskbar; verify at 100/150/200% Windows scaling.
- [~] Running-window icons precede shortcut icons; compare ChatGPT and other apps to the Windows taskbar.
- [~] Screen-time period menu, daily graphs, per-app detail and local 90-day retention; verify rollover and idle behaviour.
- [~] Pomodoro deadline and fourth-session long break; verify hide/reopen and OS restart. Zen and the optional saver need real pointer/keyboard/idle wake checks.
- [~] Hidden startup registers the hotkey before Desktop, icon or rail warming finishes. Login toggle clearly reports off/on; verify a stable binary path after Windows sign-in.
- [~] Rendered demo screenshots and owner coding rules; owner authorized PR, merge and v0.2.0 release after the local preview.

### WP13 — Demo and navigation consistency (R-41–R-44)
- [~] Logical demo fixture: IDEs include Android Studio; project folders live in Code projects; only sample loose folders remain.
- [~] Running-window icons prefer the larger asset; optional dock hover scale is limited. Owner icon comparison remains.
- [~] Header has four matching icon buttons and Home-only side arrows; dock has a Home button beside the taskbar.
- [~] 500 ms pane/folder icon-grid peek and keyboard access; native folder read is bounded. Browser timing and content checked.
- [~] Taskbar scrollbar hidden, horizontal scrolling retained and taskbar/search heights both 52 px. Native scaling check remains.

## 5. Settings inventory

Six sections in the panel, with headings inside them. Settings are staged: Done applies them, Cancel restores the saved values, Reset stages the defaults, and
Cancel and Done are both disabled while nothing is staged. The corner expand button (`settingsExpanded`) is the one setting that applies at once.

| Section | Setting | Default |
|---|---|---|
| Appearance | Material preset (five named presets and your own) · background (Current screen, Opaline Aero, a custom image) | Opaline Original · Current screen |
| | Acrylic blur · panel opacity · light bending · corner radius · panel colour | 22 px · 72% (custom materials) · 0% · 24 px · `#496f9d` |
| | Backdrop colour · brightness · acrylic tint strength · tint colour | 135% · 96% · 20% · `#0b1226` |
| | Home icon size · show names · scrollbar width | Medium · on · 8 px |
| Home | App area width · panes first · automatic loose-item order | 960 px · on · name |
| | Quick sort Home (A–Z, Z–A, Most used) · Reset grid order (keeps panes) | actions |
| | Pane opening duration (with a looping demo) · Organise for me · Ungroup everything | 320 ms · actions |
| | Home screens: add, rename or remove up to eight custom screens | none at first (Desktop and the plus page); Home is always Alt+1 |
| Navigation & taskbar | Destination arrangement (Split, Taskbar, Tray, Taskbar ends, Sidebar) · sidebar edge | Split · Left (shown only for Sidebar) |
| | Default opening page · compact navigation (Ctrl+B, needs the taskbar) · show All apps / Screen time / Focus / Settings | Home · off · on |
| | Show taskbar · edge · alignment · icon size · magnify on hover · window previews | on · Bottom · Centre · 30 px · off · on |
| Behaviour | Hotkey · launch at login · use Opaline for the Windows key | Ctrl+Alt+Space · off · off; native Start-button click and Ctrl+Esc retained |
| | Close on empty-space click · close on focus loss · animations · fade between pages (needs animations) | on · on · on · on |
| | Screen time: pause/resume · clear history | tracking on while Opaline runs; local only |
| Shortcuts & help | Every keyboard shortcut and gesture (F1 or ?) | read-only |
| About | Version, codename, links, quit · reset all settings | |

Focus timings (session, short and long break, quote interval) and the optional screen saver (off, 5 min idle) are set on the Focus page itself: 25 min · 5 min · 15 min · 25 sec.

## 6. Auto-organise rules (first match wins; a new pane needs ≥ 2 members)

| Pane | Matches |
|---|---|
| IDEs | Android Studio, Visual Studio / VS Code, IntelliJ family, Kate, Sublime, Notepad++, Cursor, Zed, Eclipse, Xcode |
| AI & code agents | ChatGPT, Claude, Gemini, Copilot, Codex, Perplexity, Ollama, LM Studio, Wispr |
| Dev tools | Docker, DBeaver, Postman, Git clients, Warp / terminals, WSL, virtual machines |
| Notes & planning | Notion, Notion Calendar, Obsidian, OneNote, Todoist, Trello |
| Browsers | Firefox, Edge, Chrome, Brave, Opera, Vivaldi |
| Chat | Discord, WhatsApp, Telegram, Slack, Teams, Zoom |
| Creative | Krita, Blender, GIMP, Inkscape, OBS, Huion/Wacom drivers, DaVinci, Figma |
| Games & music | Steam, Epic, Spotify, VLC |
| Utilities | Download managers, WizTree, 7-Zip, PowerToys, ShareX |
| University *(folders)* | `Semester_*`, `UniStuff`, lecture/course/module/vault names |
| Code projects *(folders)* | `*-source`, `Projects`, `*Tinker*`, repo/workspace names |
| Archive *(folders)* | `BACKUPS`, `Legacy*`, archive/old names |

Rules live in `src/grid/organize-rules.ts` as plain data. Anything that matches nothing stays loose.

## 7. Data formats

`groups.json` (app data directory, `%APPDATA%\io.github.mooketsimagwaza.opaline`; legacy pre-release data is copied forward once):

```json
{
  "version": 1,
  "organized": true,
  "groups": [{ "id": "ides", "name": "IDEs", "items": ["C:\\Users\\you\\Desktop\\Visual Studio Code.lnk"] }],
  "launches": { "C:\\Users\\you\\Desktop\\Claude.lnk": 12 }
}
```

`config.json`: `{ "hotkey": "ctrl+alt+space" }`. `workspaces.json` stores custom screens and their items (none until you add one); the first Home screen reads the Windows Desktop. `screen-time.json` stores daily totals per app and pause state, keyed by app identity (the package family for Store apps, the executable otherwise; older history is migrated on first run); `shell.json` stores Windows-key routing. Visual/layout settings live in webview local storage under `opaline.settings`.

## 8. Rust ↔ UI contract

Commands: `ready` · `present` · `list_items` · `launch(path)` · `reveal(path)` · `rail_items` ·
`focus_window(hwnd)` · `hide_launcher` · `quit` · `status` · `set_hotkey(combo)` · `set_behavior(closeOnBlur)` · `set_backdrop_capture(enabled)` · `load_store(name)` ·
`save_store(name, json)` · `list_apps` · `workspace_item(path)` · `pick_workspace_item` · `folder_preview` · `screen_time` · `set_screen_time(enabled)` · `clear_screen_time` · `set_screen_saver` · `start_menu_status` · `set_start_menu(enabled)`. Icons, window icons and window previews are not commands: they are images from the `opaline` URI scheme (`icon:<path>`, `winicon:<hwnd>`, `thumb:<hwnd>:<n>`, see `src-tauri/src/media.rs`). Events: `launcher-prepare { snapshot, reuseSnapshot, page }`, `launcher-hidden`, `launcher-page`, `launcher-backdrop-cache`. Stores accept only `groups.json`, `config.json`, `workspaces.json`, `screen-time.json` and `shell.json`.

## 9. Acceptance checklist (run before every release)

1. Hotkey opens and closes the overlay; rebinding works; a taken combo shows an error and keeps the old one.
2. Backdrop matches the screen, including over a live wallpaper; no stale frame from the previous open.
3. Every Desktop item has its icon on a cold start and after ten open/close cycles.
4. Create a pane by dragging, rename it, add and remove items, restart — all still there.
5. Auto-organise on a fresh profile produces the panes in §6 and leaves unmatched items loose.
6. Search finds items inside panes; Enter launches; Esc clears, then closes.
7. Empty-space click, Esc, focus loss and the hotkey all close it; clicking a tile or the rail does not.
8. Rail lists the real taskbar apps; hover shows previews; click focuses; minimised windows restore.
9. Visual and layout settings stage in Settings and apply on Done (Cancel restores the saved values); every applied setting survives a restart; Reset stages the defaults until Done.
10. Second monitor: opens on the cursor's monitor.
11. Tray icon: toggle and quit work; no process left after quitting.
12. `npm test`, `npm run build`, `cargo fmt --check`, `cargo clippy`, `cargo test` and `cargo check` are clean; CI is green.
13. Acrylic snapshot mode stays under its warm-open budget, and the short app-grid opening motion can be disabled.
14. Move a loose item, folder and pane; restart and confirm their positions persist (full pass in `docs/SPATIAL_WORKORDER.md`).
15. Complete `docs/THEME_WORKORDER.md`: consistent acrylic, centred app surface, pane bubbles, left-aligned sparse rows, persistence, contrast and no clipping.
16. Complete `docs/SESSION_WORKORDER.md`: workspace shortcuts/persistence, compact mode, cached previews, Win-key opt-in/chords, real usage/idle/sleep, virtual-desktop/PowerToys compatibility. The owner authorized v0.2.1 while those checks and W-51 remain open.
17. Walk the "0.3.0 native acceptance" list in §11 of `docs/V0_3_WORKORDER.md` on the native build: physical trackpad swipe and pinch (W-51), the taskbar at each edge, the Settings panel, light bending on the target GPU, Home screens, and real app names and icons in Screen time.

## 10. Risks & decisions

| Risk / decision | Notes |
|---|---|
| OS blur materials (acrylic, blur) looked and behaved poorly | **Decided:** don't use them. Clear mode is a transparent WebView; frosted modes render their own snapshot. |
| SVG filters inside `backdrop-filter` are Chromium-only | Fine for WebView2; Linux WebKitGTK falls back to Frost. Feature-detect and degrade. |
| Snapshot freezes a live wallpaper while open | Accepted; the entrance transition hides the freeze. |
| `PrintWindow` can't capture some protected or minimised windows | Show a placeholder; never block the rail on a failed thumbnail. |
| Foreground lock may stop the overlay taking focus when the hotkey is pressed from another app | **Untested.** Fallback: `SetForegroundWindow`/`AttachThreadInput`. Without focus, Esc won't reach the page. |
| Windows 260-character path limit | Build from a short folder, or set `CARGO_TARGET_DIR` to a short path (hit twice during development). |
| Pinned taskbar apps live in two places | Classic `.lnk` pins and self-describing Taskband registry entries are merged; unfamiliar future blob formats fall back to the shortcut folder. |
| Store/UWP apps share `ApplicationFrameHost.exe` | Each window gets its own rail entry named by its title. |
| Dev builds are slow for image work | Dependencies optimised in the dev profile. |
| A remote debugging port is used for testing | Local, development-only, never in a release build. Documented in docs/TESTING.md. |

## 11. Convenience ideas (beyond 0.1)

**P1** — finish App Library usage ordering and design opt-in widgets · hide items · pane colours and emoji · recent-items strip ·
close-window button in rail previews · run as administrator · layout/theme export-import · additional named palettes · clock/date widget ·
Quick Look preview on Space.

**P2** — command palette (calculator, unit conversion, web search, run command) · per-pane hotkeys · drop files from other apps onto a
pane · Linux and macOS ports · settings sync via a plain file · scripting/plugin hooks.

App Library, calendar, widgets and the reversible Start-style surface are specified separately in
[docs/PLATFORM_ROADMAP.md](docs/PLATFORM_ROADMAP.md).

## 12. Next actions (ordered — start at the top)

0. **Release record — complete.** PR #4 passed Windows CI and merged into `main`; main CI passed. Tag `v0.2.1` points to that merge commit. The release workflow published NSIS, MSI, portable ZIP and checksums, and the downloaded assets matched the checksums. W-51 is named in the release notes.

1. **Keep the clean gate.** The local `npm test`, `npm run build`, `cargo fmt --check`, Clippy with warnings denied,
   `cargo test --locked` and `cargo check --locked` gates are clean, as are the v0.2.1 PR and main Windows CI runs. Repeat them for later changes.
2. **Verify the "not yet verified" list in §0**, using `scripts/cdp.mjs` for page behaviour and the real keyboard for the hotkey, focus
   and tray paths. Fix what breaks. Flip statuses to `[x]` only for things you saw work; note how in the Notes column.
   Priorities: hotkey toggle and focus (R-01, R-10) → drag/drop/rename/persistence (R-05, R-06) → settings persistence (R-11) →
   rail click/preview/magnify (R-13, R-14) → single instance, tray, autostart (R-16).
3. **Rail completeness.** Compare the merged folder/Taskband rail with the real taskbar and exercise a packaged app. *Done when:* all pins appear and launch.
4. **Tune motion and glass.** Test the active acrylic controls on bright and live wallpapers; measure integrated-GPU cost. Target about
   50 ms for the transparent warm-open path and ≤ 300 ms for snapshot mode; report measured values rather than guessing.
5. **Spatial pass.** Complete every acceptance step in `docs/SPATIAL_WORKORDER.md` without moving a real Desktop file.
6. **Theme pass.** Complete `docs/THEME_WORKORDER.md` on bright/dark imagery and the target Intel GPU; fix clipping before screenshots.
7. **Release follow-up.** The v0.2.1 NSIS, MSI, portable ZIP and checksums are published and hash-verified. Record installer smoke-test evidence separately; profile the gesture bug in W-51 on the owner's trackpad when that work resumes.
8. **Finish accepting 0.3.0 "Crown".** It is released (tag `v0.3.0`; NSIS, MSI, portable ZIP and checksums). §0 of `docs/V0_3_WORKORDER.md` lists what shipped and what moved to 0.3.x, 0.4.0 and 0.5.0.
   Remaining: the owner's native pass (physical trackpad W-51, the taskbar at each edge, the Settings panel, light bending on the target GPU, and §9). Fixes found there ship
   as 0.3.x. Existing native acceptance gaps remain regression gates; the narrower scope does not silently mark them complete.
9. **Then 0.4.0 live wallpapers** ([docs/V0_4_WORKORDER.md](docs/V0_4_WORKORDER.md)); 0.3.x completion feedback (R-55) can interleave. 0.5.0 (live layout customiser, restart cache) and 0.6.0 (Activity Center) follow.

## 13. Known issues

- **Start at login did not work (found 8 November, fix in the unreleased 0.3.1 work):** the entry was correct, but Opaline's setup treated a tray icon that could not be added as fatal, and a login start can run before Explorer's taskbar exists, so the app quit silently. The tray is now retried for about two minutes, and a startup log (`startup.log` in the app data folder, with a panic hook) records every start and failure. Not yet confirmed at a real sign-in.
- **Idle memory is still above budget (measured 8 November):** hidden for 90 s, Opaline's host plus six WebView2 processes hold about 200 MB private memory against a 120 MB budget. In 0.3.0 their working set was about 452 MB. The 0.3.1 work asks WebView2 for a low memory target after 20 s hidden and lifts it when an open begins, which takes the working set to about 132–146 MB and private memory to about 196–200 MB (0.3.0: 208 MB). Trimming straight after every hide had made each open about 90 ms slower, which is why it waits. Measured back to back from the same kind of folder, opens were the same within noise: warm 18–30 ms against 18–20 ms, and the first open after idle 30–63 ms against 27–68 ms (second-launch method, remote debugging on; the absolute numbers vary by a few ms between runs). The private-memory budget is a Chromium floor that only a different UI engine would change.
- **Open in 0.3.0 (W-51):** the owner saw consecutive horizontal swipes fail until a mouse move, and lag, while pinch works. 0.3.0 reworks gesture motion, rearms the swipe lock after 120 ms of silence and the browser suite swipes repeatedly without pointer movement, but headless Chrome is not a physical trackpad. It is not accepted until the owner retests on the device; use Tab/Home dots or Alt+1–5 meanwhile.
- Real pointer grid reordering has not had its full real-app pass yet (the fabric opening was replaced by a short pop in 0.2.0).
- Light bending (R-75) is an SVG displacement filter inside `backdrop-filter`: Chromium/WebView2 only, GPU-heavy and unmeasured on the target Intel GPU. It is off by default and falls back to plain frost where unsupported.
- Everything new in 0.3.0 was verified in headless Chrome with demo fixtures and mocked IPC, plus a release build that launches and reports 0.3.0. The physical trackpad, WebView2 rendering and the native checklist are the owner's to confirm.
- The Focus page follows the chosen material less closely than the rest of the UI; the owner accepted that for now.
- Taskband parsing deliberately consumes only self-describing link names/AppUserModelIDs from the undocumented blob and falls back safely.
- Native cold thumbnails measured 66.5–131.6 ms after GDI downsampling. Cached demo presentation measured 13–17 ms; owner cached-hover parity remains open.
- `Esc` in the pane-name field both closes the popup and bubbles to the global handler; confirm the intended order.
- The v0.2.1 PR/main CI and tag workflows passed on the public remote. On 5 November the locally built 0.3.0 MSI upgraded the owner's installed 0.2.1 (Program Files) and start-at-login was pointed at it; the installer smoke test on a clean machine remains open.
- The MSI installs an all-users Desktop shortcut (found while upgrading on 5 November; it dates from 0.2.1 as well), although the release checklist says the installers create none. The NSIS installer removes its own through `windows/nsis-hooks.nsh`; the MSI has no equivalent yet.
- Enabling Launch at login from a debug build leaves a Run entry pointing at that build's path; it should be re-enabled from the installed app (done by hand on 5 November).
- Windows-key routing and virtual-desktop/PowerToys compatibility need real key/workflow testing; the Windows-key option remains off by default.

## 14. Out of scope (external tools)

- **Live wallpaper (today):** Wallpaper Engine (paid, largest library) or Lively Wallpaper (free, open source). Opaline snapshots whatever is on screen, so a live wallpaper is frozen while the overlay is open. Opaline's own live backgrounds (GIF, video, sandboxed HTML/JavaScript, Lively packages) are planned for 0.4.0 in [docs/V0_4_WORKORDER.md](docs/V0_4_WORKORDER.md).
- **Taskbar background:** a tool such as TranslucentTB. Opaline does not modify the taskbar.
- Hiding Explorer's desktop icons: the Windows setting *View → Show desktop icons* (Opaline never changes it).

## 15. Publishing metadata

| Where | Placeholder |
|---|---|
| `src-tauri/tauri.conf.json`, `docs/NAMING.md` | `io.github.mooketsimagwaza.opaline` |
| Security/conduct contact | GitHub private contact for `@MooketsiMagwaza` |
| License | `MooketsiMagwaza and Opaline contributors` |
| Repository / author | `https://github.com/MooketsiMagwaza/opaline` · `MooketsiMagwaza` |
| Name | Trademark, domain and package-registry availability of "Opaline" still requires an external legal/availability check |
