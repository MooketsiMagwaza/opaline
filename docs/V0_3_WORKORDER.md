# Opaline 0.3.0 experience work order

**Status:** scope settled on 4 November 2026 (§0); released as 0.3.0 "Crown" on 5 November 2026, with the owner's native acceptance (§11) still open; partial slices are listed in §10.  
**Release intent:** supersede the unpublished 0.2.2 candidate with a 0.3.0 that ships the scope in §0 after every acceptance gate there passes. The manifests were bumped to 0.3.0 "Crown" on 4 November 2026, and the owner had it tagged and published on 5 November before finishing the native checks.  
**Priority order:** Focus experience → navigation, presets and interaction polish → taskbar placement (built in 0.3.0) → (later releases) layout customisation → restart/startup performance → optional Activity Center integrations.

## 0. Scope decision (settled 4 November 2026)

The original plan below is too large for one release, and its later milestones depend on native work (four-edge taskbar geometry, a
native icon cache, Windows notification access) that cannot be accepted from a browser. 0.3.0 therefore ships the part that is built,
tested and already coherent, and the rest moves to named later releases. The full requirement text stays in this document as the
specification for those releases; only the release each requirement targets changes.

| Requirement | Release | State on 4 Nov 2026 |
|---|---|---|
| R-52 Focus redesign, R-53 intention and session controls, R-54 running-timer capsule | **0.3.0** | `[~]` built and unit-tested; owner/native acceptance open |
| R-60 Settings/data migration, accessibility | **0.3.0** | `[~]` normalisation and tests in place; reduced-motion and keyboard paths covered by the UI suite |
| R-65 Rearrangeable navigation, R-66 feature-first frontend, R-67 staged Settings and representative previews | **0.3.0** | `[~]` built; UI suite green; owner visual acceptance open |
| R-68 Gesture motion: a swipe or pinch previews, commits and settles smoothly, without clipping | **0.3.0** | `[~]` built; the browser suite checks the preview, commit, themed cue and reduced-motion paths; needs the owner's physical trackpad (W-51) |
| R-69 Hover intent: popups follow the pointer's path, neighbours warm up together, the tray behaves as a dropdown | **0.3.0** | `[~]` built; real-mouse paths are in the UI suite; needs native WebView2 confirmation |
| R-70 Readable app names and real icons in Screen time and the taskbar | **0.3.0** | `[~]` built with Rust unit tests; needs a look at the owner's real apps in the native build |
| R-71 Android-style Home screens: a trailing plus page, plus on an empty screen, in-place remove | **0.3.0** | `[~]` built; covered by the UI suite |
| R-72 Shortcuts & help, with key hints on pages steered by keyboard | **0.3.0** | `[~]` built; covered by the UI suite |
| R-73 Chart axes on Screen time and Focus | **0.3.0** | `[~]` built; axis maths unit-tested, rendering covered by the UI suite |
| R-74 More navigation arrangements (Taskbar ends, Sidebar) and compact navigation only with the taskbar mirror | **0.3.0** | `[~]` built; covered by the UI suite |
| R-75 Light bending: physically-based refraction and dispersion behind panel edges, as a setting for any material (an Apple Glass preset was built on it and removed) | **0.3.0** | `[~]` built; physics unit-tested, and the UI suite proves the filter moves pixels at the panel edge and that other materials run none; needs the owner's eyes and GPU on the native build |
| R-55 Completion feedback and local session history | 0.3.x | `[ ]` not started; ships as a follow-up once 0.3.0 is accepted |
| R-76–R-83 Live wallpapers: GIF, video and sandboxed HTML/JS backgrounds, reading Lively packages | 0.4.0 | `[ ]` scoped in [V0_4_WORKORDER.md](V0_4_WORKORDER.md); decided 4 Nov 2026 |
| R-56 Four-edge taskbar placement with alignment | **0.3.0** | `[~]` built (bottom, top, left, right; start, centre, end); covered by the UI suite; needs the owner's look on the native build |
| R-84 Settings as a panel with an expand button, six sections and clear Cancel/Done states | **0.3.0** | `[~]` built; covered by the UI suite |
| R-85 Pages ease in, with a toggle | **0.3.0** | `[~]` built; covered by the UI suite |
| R-57 live layout customiser | 0.5.0 | `[ ]` not started; needs a physical-resize pass |
| R-58 Cached restart without icon churn, R-59 measured startup budgets | 0.5.0 | `[ ]` not started; needs the Rust cache and the on-device baseline in §8 |
| R-61 Activity Center, R-62 agenda and calendar, R-63 news feed, R-64 Activity Center layout | 0.6.0 | `[ ]` not started; the feasibility prototypes (§6, M5) come first |

**0.3.0 release gates:** `npm test`, `npm run build`, `npm run size`, `tsc --noEmit`, `cargo fmt --check`, Clippy with warnings denied,
`cargo test --locked`, a clean UI suite, then the owner's acceptance of Focus, the gestures (W-51), hover behaviour and the native
checklist. 0.3.0 "Crown" was tagged and published on 5 November 2026 at the owner's instruction, ahead of the native checks, which stay open.

**What changes for the plan below:** M0, M1 and the Settings/navigation parts of M3 are the 0.3.0 work. M2 splits (the capsule is in,
notifications and history are 0.3.x); 0.4.0 is live wallpapers (its own work order); taskbar placement (M3) is built in 0.3.0, while the customiser and all of M4
are 0.5.0; M5 is 0.6.0; M6 applies to each release. The exclusions in §12 are unchanged.

## 1. Outcome

0.3.0 should make Opaline feel like a considered daily environment rather than a collection of launcher features. The Focus page is
the centrepiece. The launcher should then get out of the user's way: it should reopen with recognisable content immediately, remember
its layout, avoid re-extracting unchanged icons, and let the user place and size the main surfaces for their display.

The update remains local-first. The core has no network dependency, telemetry or Opaline cloud account. An optional calendar connector
may make direct requests only after explicit user consent; the offline experience must remain complete when it is disabled. Opaline
continues to read Desktop files without moving them. Pane contents remain manually ordered and do not gain internal sorting.

## 2. Baseline (as 0.3.0 now stands)

- Focus now has intention, explicit timer states, finish/skip semantics, duration presets, summaries, a compact running capsule, Zen
  reminders and an optional idle screen saver. State survives hiding and process restarts through local storage.
- The Focus controller, pure timer transitions, ambient modes and CSS now live in a feature folder; completion notifications and
  bounded clearable history remain unimplemented.
- The taskbar mirror docks to the bottom, top, left or right edge at the start, centre or end of it (R-56); previews, magnification, scrolling and the
  page's clearance follow the edge.
- Main destination shortcuts can use Split Header, Navigation Taskbar, Dropdown Tray, Taskbar Ends or Sidebar arrangements, with per-destination pinning and
  live Settings previews.
- Layout settings expose app-area width, icon size, taskbar icon size, edge and alignment, but there is no visual customisation workspace, panel-height
  control or direct manipulation (0.5.0).
- Warm opens reuse the live DOM and an in-memory backdrop. A small seven-day frontend icon cache stores at most 96 data URLs under a
  two-megabyte limit. That helps some restarts, but unchanged items still require individual IPC/cache lookups, cache misses return to
  the serial Windows shell worker, and the Desktop/app manifests are rescanned.
- Backdrops and live window thumbnails are memory-only. That privacy boundary remains unchanged.
- Opaline currently has no inbox for reviewing its own alerts or Windows notifications after a toast disappears, and it has no agenda
  or calendar input path.

## 3. Requirements

| ID | Requirement | Priority | Acceptance summary |
|---|---|---:|---|
| R-52 | Redesign Focus as a calm, legible primary workflow | P0 | All timer states are visually deliberate and usable at 600 × 600 through 1920 × 1200 |
| R-53 | Add an optional focus intention and useful session controls | P0 | Intention, start/pause, reset and skip/finish behave predictably and restore after restart |
| R-54 | Keep a running Focus session visible without forcing the Focus page open | P0 | A compact timer capsule appears beside the Opaline taskbar and opens Focus when activated |
| R-55 | Provide opt-in completion feedback and local session history | P1 | Alert settings are explicit; history is local, bounded and clearable |
| R-56 | Place the Opaline taskbar on any screen edge | P0 | Bottom, top, left and right positions work with previews, scrolling, Home and compact navigation |
| R-57 | Add a dedicated live layout customiser | P0 | Main panel width/height and taskbar placement can be previewed, resized, reset and keyboard-adjusted |
| R-58 | Make a full process restart show unchanged content without icon reload churn | P0 | Cached manifests and unchanged icons render on the first useful frame, then refresh in the background |
| R-59 | Make login startup and repeated opens measurably faster | P0 | Benchmarks meet the budgets in §8 on the target laptop without hiding failures |
| R-60 | Preserve settings/data and accessibility through the 0.3 migration | P0 | Existing panes, screens, timer, theme and manual ordering survive; reduced motion and keyboard paths pass |
| R-61 | Add an opt-in Activity Center for reviewable notifications | P1 | Opaline alerts always work; Windows-wide capture is permissioned, locally retained and unavailable states are explained |
| R-62 | Add backendless agenda inputs with an optional Google Calendar path | P1 | Local events and `.ics` work offline; any Google connection is direct, read-only first and explicitly authorised |
| R-63 | Add an optional backendless news feed | P1 | User-selected RSS/Atom sources refresh directly, cache safely and never block launcher startup |
| R-64 | Make Activity Center modules, edge, alignment and size visually configurable | P0 | Master/per-module toggles and monitor previews make every orientation understandable before it is applied |
| R-65 | Make primary navigation rearrangeable and minimisable | P0 | Split, taskbar and tray previews apply live; destinations can be pinned or moved to overflow without losing keyboard recovery |
| R-66 | Complete a feature-first frontend migration | P1 | Feature logic, CSS, data and README ownership are clear; `launcher.css` retains only shared shell/material rules |
| R-67 | Make Settings changes explicit and previews representative | P0 | Visual/layout edits stage until Done, Cancel restores saved state, and previews simulate the current backdrop/layout without persisting imagery |
| R-68 | Make swipe and pinch feel smooth and legible | P0 | A held swipe slides only Home content with nothing clipping; a held pinch zooms and cross-zooms into the destination; the destination is named while held; commit never blocks the next gesture; reduced motion keeps the cue and drops the movement |
| R-70 | Name apps as people know them and show their real icons | P0 | Screen time and the taskbar show the Start-menu or publisher name, never `WhatsApp.Root` or `ApplicationFrameHost`; packaged apps show their real icon; one entry per app across updates; old history is merged |
| R-71 | Add and remove Home screens in place, as on Android | P0 | The last page is an empty new-screen page with a plus (Enter works); the pager ends with a plus dot; an empty screen has a plus that opens the picker; every custom screen can be removed, with confirmation when it holds items |
| R-72 | Make every shortcut and gesture discoverable | P0 | Settings has a Shortcuts & help section opened by F1 or ?; keyboard-steered pages show arrow, Enter and Tab hints |
| R-73 | Make the charts readable | P0 | A labelled value axis with round steps, faint rules, dated and weekday-labelled days, today marked |
| R-74 | Offer taskbar-like and sidebar navigation without stranding the controls | P0 | Taskbar ends and Sidebar (left or right) arrangements with live previews; compact navigation applies only while the taskbar mirror is on |
| R-75 | Let glass bend light | P0 | A Light bending setting makes panels refract the desktop at their edges (not only blur it); it applies to any material, 0% (the default) runs no filter, and unsupported engines fall back to frost. A saved Apple Glass preset migrates to a custom material |
| R-84 | Keep Settings small, organised and honest | P0 | Settings opens as a panel with a corner button that expands it; six sections grouped by headings; Cancel and Done grey out when nothing is staged |
| R-85 | Make page changes gentle | P0 | Pages, Home screens and Settings sections ease in; a Behaviour toggle turns it off; reduced motion and Animations off also disable it |
| R-69 | Follow standard hover-intent rules for popups | P0 | A popup stays open while the pointer travels toward it on a diagonal path; once one popup is open its neighbours open at once; the tray opens on rest, closes on leaving, pins on click and dismisses on an outside press or Escape |

## 4. Focus experience

### 4.1 Page structure

Replace the current flat composition with three clear levels:

1. **Session header.** Phase, today's completed sessions and an optional one-line intention such as “Finish the release notes”. The
   intention is optional, never used for telemetry and remains local.
2. **Timer hero.** A larger but lighter progress treatment, tabular clock, phase timeline and one unmistakable primary action. Reset
   and finish/skip are secondary actions and require confirmation when they would discard meaningful elapsed time.
3. **Supporting information.** A compact “Today” strip and seven-day activity view, followed by quieter cards for immersive Focus and
   the screen saver. Statistics should not compete with the timer.

The page must have explicit designs for fresh, running, paused, work-complete, break-ready and break-complete states. Text should explain
what happens next; the timer must not auto-start the next phase unless a later explicit setting enables it.

### 4.2 New Focus features

- Optional intention field with a clear button and sensible persistence for the active session.
- Quick duration presets (25, 50 and Custom) that update settings without hiding the existing precise duration controls.
- Finish/skip action with correct completion accounting: finishing a work session records it; skipping does not silently count it.
- Compact running timer capsule near the Opaline taskbar. It shows phase and remaining time, has an accessible label, and opens Focus.
- Optional native completion notification and optional subtle sound, both off until the user chooses them. Failure must produce an
  actionable settings message rather than silently doing nothing.
- A bounded local session log containing timestamp, duration and optional intention. Settings provides clear history. Aggregate charts
  continue to work when no intention is entered.
- Immersive mode replaces the disconnected “quotes first” feeling of Zen: the active intention and clock lead; reminders are secondary
  and can be paused. The existing screen saver stays a calm clock and does not become a Windows lock-screen replacement.

### 4.3 Focus interaction and visual rules

- Space starts or pauses only when a text field is not active. Escape exits immersive mode before it closes Opaline.
- Start/pause must remain in a stable position so the control does not move under the pointer.
- No one-second DOM rebuilds. Only the clock text, progress custom property and necessary status text update each tick.
- Progress and completion cannot rely on colour alone. All controls receive visible keyboard focus and useful accessible names.
- Reduced motion removes drifting, glow and progress interpolation while retaining clear state changes.
- Focus settings are grouped by Sessions, Feedback and Ambient modes instead of one undifferentiated list of sliders.

## 5. Layout customisation and taskbar placement

### 5.1 Customise screen

Add a dedicated **Customise layout** experience launched from Settings → Home. Settings edits remain staged; “Done”
ends the visual editing session rather than committing a separate draft.

The screen contains a safe synthetic preview, not a capture of personal Desktop contents. It provides:

- draggable width and height handles for the main panel;
- numeric/slider alternatives for keyboard and assistive-technology users;
- Compact, Balanced and Wide presets;
- main-panel width, maximum height and vertical placement controls with monitor-aware limits;
- icon-size and label previews using existing settings;
- taskbar edge and alignment controls with direct edge-drop preview;
- Activity Center edge, alignment, size and enabled-module preview;
- Reset panel, Reset taskbar and Reset all layout actions.

The first release keeps one global layout. Per-monitor profiles and arbitrary free-form panel coordinates are deferred until there is a
real need; responsive constraints are more predictable than saving coordinates that can become off-screen.

### 5.2 Taskbar geometry

**Built in 0.3.0 (R-56):** every point below except the miniature monitor previews. The settings are `railEdge` and `railAlign` (not `railAlignment`),
chosen with two segmented controls in Settings → Navigation & taskbar; `taskbar.css` handles the geometry through `data-rail-edge` and `data-rail-align`. The
miniature position previews stay in the 0.5.0 customiser.

Add `railEdge` (`bottom`, `top`, `left`, `right`) and `railAlignment` (`start`, `center`, `end`) to normalised settings. The taskbar and
Home button remain one unit. Changing edge must update:

- horizontal versus vertical icon flow and wheel/trackpad scrolling;
- the surface inset so the main panel never overlaps the taskbar;
- preview placement inward from the selected edge, clamped to the viewport;
- magnification along the correct axis;
- running indicators, window-count badges and compact-navigation affordances;
- screen-reader order and keyboard arrow direction.

This controls only Opaline's mirror. It does not move or modify the real Windows taskbar.

The Settings presentation follows the supplied Windows taskbar-position reference without copying Windows styling: one expandable
**Taskbar behaviour** section shows four miniature monitor previews labelled Bottom, Top, Left and Right. The selected preview receives
Opaline's normal focus/selection treatment. Alignment and size controls sit immediately below it. The preview uses a synthetic desktop,
the active Opaline tint and representative icons so the user can understand the result without exposing their real wallpaper or apps.

## 6. Activity Center, notification capture and calendar inputs

### 6.1 One review surface

Add an **Activity Center** as an edge drawer instead of adding another permanent top-level page to the five-page navigation. It
contains Notifications, Agenda and News views, unread/upcoming counts, search/filter controls and a clear privacy status. The entry point
should be tested beside the Opaline taskbar and in the header before its final position is chosen; keyboard access is required.

The drawer deliberately borrows the pane interaction language: it opens from its anchor, uses one acrylic surface, closes with Escape
or click-off, and returns focus to the trigger. It overlays rather than pushes the main panel so orientation changes do not cause the
launcher to reflow. Left and right use a vertical drawer; top and bottom use a horizontal shelf with responsive columns. A resize handle
is available on the inward edge, with an equivalent size slider for keyboard users. Reduced motion opens it without origin animation.

Settings → Activity Center uses the same visual position pattern as taskbar settings: four small monitor previews for Bottom, Top, Left
and Right, followed by Start/Centre/End alignment and Compact/Default/Large size. The preview shows the real combination of enabled
modules using synthetic notification, event and headline rows. It updates live but never fetches data merely because Settings is open.

Settings provides a master **Show Activity Center** switch and independent switches for **Opaline alerts**, **Windows notifications**,
**Agenda**, **Google Calendar sync** and **News**. Turning the master switch off hides its anchor and stops listener/feed/calendar work;
it does not delete retained data. Turning a module off stops its background work and removes its tab. Clear-data actions remain separate
and explicit. Connected modules make no network requests while disabled.

The center has two notification sources:

1. **Opaline activity.** Focus completions, cache/integration errors and other Opaline events can always be recorded locally and shown
   in the inbox, even when Windows-wide notification access is unavailable.
2. **Windows notification mirror.** With explicit permission, Opaline can read current app notifications through Windows'
   `UserNotificationListener`, calculate changes and retain a reviewable local history while its listener is active.

Windows-wide capture is off by default. The permission explainer must say that notification titles and bodies can contain private
messages, codes and account information. Controls include pause capture, per-app exclusions, retention (off, 24 hours, 7 days or 30
days), clear history and revoke/open-Windows-settings guidance. Captured content is not added to global search by default.

The first version is read/review oriented. It must not dismiss or clear Windows notifications as a side effect of clearing Opaline's
local history. Store only the minimum useful source, title, body, received time and active/dismissed state; exclude images, arbitrary
attachments and action tokens. Protect retained history with Windows user-bound encryption and never log notification contents.

The Windows listener needs the `userNotificationListener` manifest capability and a permission prompt. Because the current NSIS/MSI
and portable builds are normally unpackaged, M5 must prototype full MSIX or package-with-external-location identity before promising
system-wide capture. Unsupported portable builds still show Opaline's own activity and clearly explain why the Windows mirror is
unavailable. Capturing while Opaline is fully quit is not promised unless the chosen packaged background-task design proves reliable;
launch-at-login can keep the normal tray process listening.

### 6.2 Backendless agenda levels

Calendar support is progressive so a server is never required:

- **Offline core:** manually add a small local event/reminder and import a selected `.ics` file. Parsing, recurrence and timezone tests
  are required; imported data remains local and can be cleared independently.
- **Read-only subscription:** optionally refresh an explicitly supplied iCalendar URL directly from the desktop app. Treat private URLs
  as credentials, store them with Windows user-bound encryption and never include them in logs or diagnostics.
- **Google Calendar connector:** optional direct desktop OAuth using the system browser, loopback redirect and PKCE. Start with the
  narrow read-only Calendar scope, store refresh credentials in the Windows credential vault or equivalently user-bound secure store,
  and show last-sync/offline/error states. Opaline talks directly to Google's APIs; there is no Opaline backend or token relay.
- **Event output:** “Add to Google Calendar” may open a prefilled browser flow without granting Opaline read access. Direct write access
  is deferred until there is a specific workflow that justifies broader permissions.

Shipping the Google connector requires an Opaline Google Cloud desktop OAuth client, consent-screen configuration and any verification
Google requires for the requested scope. If that operational work is not ready, 0.3.0 can ship the offline agenda and mark Google sync
experimental or defer it to 0.3.x without weakening the Focus, customisation or performance release gates.

The Agenda view shows a restrained Today/Next section and may suggest a calendar event as the Focus intention, but it never starts a
timer or joins a meeting automatically. By default, its offline cache stores only event title, start/end, calendar name and optional
location; descriptions, attendees and meeting links require an explicit expanded-detail setting.

### 6.3 Backendless news feed

News is an optional third Activity Center module. It uses RSS or Atom fetched directly by the Rust side, so Opaline needs no news
backend, account or bundled API key. Users add individual feed URLs or import an OPML file; an optional starter-source catalogue lists
known feeds but fetches nothing until the user selects and enables a source.

The first version is intentionally a reader index, not a recommendation engine:

- chronological and per-source views, with unread and saved states;
- title, source, publication time and a short feed-provided summary;
- original stories open in the default browser;
- manual refresh by default, with optional 30-minute, hourly or four-hour refresh while Opaline is running;
- bounded offline cache by age and item count, plus Clear news cache and Remove source actions;
- per-source errors and last-updated status instead of silently showing stale content as current.

Feed HTML is sanitised before rendering. Scripts, embedded frames, action forms, tracking parameters and remote pixels are never
executed in the WebView. Remote article images are off by default; if later enabled, they are fetched through the native client with a
strict size/type limit and no cookies. Full-page scraping, paywall bypass, algorithmic profiling, ads and background refresh while News
is disabled are out of scope.

News refresh starts only after the first useful launcher frame or while Opaline is hidden. Network and parser failures cannot delay
Home, Focus or the Activity drawer opening with its last safe cache. Source URLs and saved/read state remain local and exportable.

## 7. Restart and cache architecture

### 7.1 Measure before changing

Add development timing marks for process start, native setup complete, WebView ready, prepare received, first recognisable content,
first interactive frame and icon completion. A repeatable script records at least 20 warm opens and 10 full process restarts. Results
report median and p95; a single best run is not evidence.

### 7.2 Stale-while-revalidate bootstrap

Introduce a versioned native bootstrap cache in Opaline's app cache directory:

- a small last-known Desktop/app manifest with display name, path, type and validation metadata;
- extracted icon PNG files keyed by canonical path, requested size and source modification signature;
- an atomic cache index with schema and app-version fields;
- a bounded size and least-recently-used eviction policy.

On a full restart, the frontend receives one cached bootstrap payload and can render recognisable content before fresh Windows scans
finish. The real Desktop and AppsFolder scans then validate in the background and patch only changes. Missing, moved or modified files
invalidate their own entry; a corrupt cache is discarded with a diagnostic and rebuilt.

The Windows shell icon worker stays single-threaded. The cache removes unnecessary extraction; it does not make unsafe parallel shell
calls. Runtime window icons, window thumbnails and backdrop snapshots are never persisted. A “Clear performance cache” action removes
only disposable cache data, not panes, screens, usage history or Focus history.

### 7.3 Startup sequencing

- Register the global hotkey and tray path before nonessential scans, usage presentation work or cache maintenance.
- When launched with `--hidden`, do not build expensive visible-page content until the cache has been read or the user asks to open.
- Prepare cached Home content and CSS variables without waiting for All apps, taskbar enumeration, previews or fresh icon extraction.
- Keep the current in-process warm DOM and memory backdrop paths; 0.3 improves full restart behaviour rather than regressing warm opens.
- Refresh caches after the window is hidden or during idle time, with cancellation when the user opens Opaline.

## 8. Performance budgets

Budgets are measured on the existing target Windows 11 laptop at its normal 150% scaling:

| Scenario | Target |
|---|---:|
| Resident-process warm open, request to visible | median ≤ 50 ms; p95 ≤ 100 ms |
| Full process restart, launch to interactive cached Home | median ≤ 900 ms; p95 ≤ 1.5 s |
| Login launch hidden, hotkey registered | ≤ 1 s |
| Unchanged Desktop on full restart | all cached icons present on the first useful Home frame |
| Background validation | never blocks input or causes a full-grid flash/rebuild |
| Idle memory after caches settle | ≤ 120 MB, measured rather than inferred |

If the full-restart target is impossible because of measured WebView2 startup cost, record the baseline and the platform floor, then
set the tightest honest budget. Do not delay the first frame to create a cosmetically better timing number.

## 9. Data and migration

- Keep existing local-storage keys readable for at least this release. Normalisation supplies defaults for new layout and Focus fields.
- Migrate the current `opaline.focus` timer without losing its deadline, phase or completion totals.
- Add a versioned `focus.json` only if the bounded session log needs the native store; update the store allow-list and corruption tests.
- Keep `activity.json` and agenda metadata separate from ordinary settings. Notification history, calendar subscription secrets and
  OAuth refresh credentials use Windows user-bound protection; clearing one source does not erase unrelated Opaline data.
- Keep feed subscriptions/read state separate from disposable article cache. OPML export restores the user's source list without
  exporting cached article bodies. Feed refresh metadata contains no browsing telemetry.
- Cache schemas are disposable and separate from user data schemas. A cache migration failure clears the cache, never user data.
- No pane, workspace, screen-time, hotkey or manual-order migration is required for taskbar positioning.
- 0.3.0 does migrate two things at start-up: screen-time history is re-keyed by app identity and renamed (so `WhatsApp.Root` and `ApplicationFrameHost` entries merge into the
  real apps), and the two empty placeholder screens older versions seeded ("Screen 2" and "Screen 3", nothing in them) are dropped when workspaces load. A screen with a name of
  your own or any content is kept.

## 10. Delivery sequence

### Current implementation evidence — 2026-11-04

- `[~]` R-68: `navigation/gesture-motion.ts` drives the preview through three custom properties (transform and opacity only) and commits by navigating at once while a ghost clone cross-animates with the Web Animations API; View Transitions are no longer used. Browser frame captures show no clipping leak and no blank frame. Physical-trackpad feel is still the owner's call.
- `[~]` R-69: `core/hover-intent.ts` (`PathGuard`, `Closer`, `HoverGroup`) is used by context-menu submenus, the taskbar preview, the pane peek and `navigation/tray.ts`. Unit tests cover the geometry; the UI suite drives real mouse paths, and the new checks fail on the preceding commit.
- `[~]` R-70: `identity.rs` resolves executables to a stable key, a Start-menu or file-details name and a readable icon source; screen-time history is merged and renamed at start-up. Verified in unit tests; the real apps are checked in the native build.
- `[~]` R-71, R-72, R-73, R-74: Android-style Home screens, the Shortcuts & help section and key hints, chart axes, and the Taskbar ends and Sidebar arrangements are built and covered by the UI suite and unit tests. The single-screen rubber band was removed because a swipe always has the new-screen page to go to.
- Fixed in passing: the launcher stage was scrollable because of its oversize blurred backdrop, so a focus could shift the whole UI by a few pixels; it now clips.
- `[~]` R-56, R-84, R-85 (later the same day): the taskbar docks to any edge with alignment; Settings is a panel with an expand button, six sections grouped by headings and Cancel/Done that grey out when nothing is staged; pages, Home screens and Settings sections ease in behind a Behaviour toggle; Taskbar ends moved into the taskbar's own bar; glass lost its white-to-colour sheen gradients; a fresh profile starts with Desktop and the plus page. The UI suite covers each, and each new check was shown to fail without its change.
- Budget: the raw code budget is now 220 KiB and gzip 62 KiB (raised from 190 / 60 as gestures, presets, light bending, taskbar placement and the Settings panel landed); the build measures about 213.9 KiB raw / 59.8 KiB gzip. Live wallpapers (0.4.0) will have to load lazily.

### Earlier implementation evidence — 2026-11-02

_A dated record; the 4 November entries above supersede it (four-edge placement has since been built, and the Apple Glass preset was removed on 5 November, leaving five)._

- `[~]` M0: added dependency-free `npm run size` budgets; measured 162.0 KiB raw / 46.3 KiB gzip frontend, a 4.91 MiB release executable, 1.61 MiB NSIS and 2.38 MiB MSI.
- `[~]` M1: redesigned Focus, corrected finish/skip accounting, added intention/durations/keyboard state and split timer/ambient/controller modules. Unit and production builds pass; final owner/native acceptance remains open.
- `[~]` M3: added six built-in visual starting points and named, removable, JSON-importable/exportable user profiles covering appearance, sizing, rail and bar choices. Four-edge placement and live resize are not implemented yet.
- `[~]` M3/R-65: added Split Header, Navigation Taskbar and Dropdown Tray arrangements with Opaline previews and per-destination pin/overflow settings. Four-edge placement and live resize are not implemented yet.
- `[~]` M3/R-67: Settings visual/layout edits now stage until Done, Cancel restores the saved draft, and one persistent live launcher simulation plus each choice card use the current memory-only backdrop, live app data and real layout state.
- `[~]` Appearance correction: previews now use one miniature launcher with loaded icon images and no outer ghost layer; all six built-ins have distinct full material recipes and applied surface behavior rather than tint-only aliases.
- `[~]` M3/R-66: all runtime TypeScript now lives under `app`, `core` or an owning feature; Activity and Taskbar CSS joined the existing feature styles. Feature READMEs now include APIs, dependencies, state flow, invariants and Mermaid diagrams. Further shared-shell CSS reduction remains incremental. No runtime dependency or network call was added.

### M0 — Baseline and contracts

- Add timing instrumentation and record the current restart/warm-open baseline.
- Add settings/data schemas and migration tests without changing the visible defaults.
- Extend synthetic fixtures for every Focus state and every taskbar edge.

### M1 — Focus core

- Rebuild the Focus page structure and state presentation.
- Add intention, presets, finish/skip semantics and keyboard behaviour.
- Add unit tests for completion accounting, restoration and settings changes.

### M2 — Focus companion experience

- Add the running timer capsule, immersive redesign and opt-in completion feedback.
- Add bounded local history, clear-history controls and updated charts.
- Complete native hide/reopen and process-restart checks before moving on.

### M3 — Customise and place

- Build the live customisation screen with panel width/height handles and presets.
- Implement all four taskbar edges and three alignments (built in 0.3.0).
- Add Windows-style miniature position previews for the taskbar and Activity Center, rendered in Opaline's own visual system.
- Verify preview cards, magnification, scrolling, Home and compact navigation at each edge.

### M4 — Fast restart

- Add the native manifest/icon cache and one-payload bootstrap path.
- Move validation and refresh outside the first visible frame.
- Add cache corruption, invalidation, eviction and clear-cache tests; rerun the performance suite.

### M5 — Activity Center feasibility and offline agenda

- Add the configurable edge drawer, master/per-module settings and Opaline's own activity history without requiring system notification permission.
- Prototype Windows notification permission and listener access in packaged, sparse-identity and portable builds; select a supported
  distribution design before storing any real notification content.
- Add the offline local/`.ics` agenda and encrypted retention controls.
- Add RSS/Atom and OPML handling, sanitised rendering, bounded cache and disabled-state network tests for News.
- Prototype direct read-only Google OAuth with development credentials. Ship it only after consent, token-storage, revocation and
  offline/error paths pass; otherwise keep Google sync out of the 0.3.0 release build and retain the offline agenda.

### M6 — Integrated polish and release

- Run visual, keyboard, reduced-motion, high-contrast, scaling and multi-monitor passes.
- Run ten full restart cycles and ten open/hide cycles with no missing unchanged icons.
- Update synthetic screenshots, public documentation, changelog and release notes.
- The synced manifests are already bumped to 0.3.0 "Crown" (4 November 2026); tag and publish only when explicitly authorised.

## 11. Verification matrix

### 0.3.0 native acceptance (the owner's pass)

The release build launches and reports 0.3.0, and the browser suite is green, but these need a real trackpad, WebView2 and the owner's apps:

1. **Gestures (W-51):** several two-finger swipes in a row in the same direction, then pinch in and out; the preview follows the fingers, nothing clips, and no gesture is ignored or laggy.
2. **Taskbar placement:** each edge (bottom, top, left, right) and alignment; previews open toward the screen, magnification and scrolling feel right, the page keeps clear, and a side taskbar is centred.
3. **Navigation arrangements:** Split, Taskbar, Tray, Taskbar ends and Sidebar (left and right), with compact mode where it applies.
4. **Settings panel:** opens at panel size, expands and collapses, six sections, staged Done and Cancel that grey out when clean, Reset, and a preview that matches the draft.
5. **Materials:** all five presets, and Light bending at 100% on the target Intel GPU (smoothness while scrolling and switching pages); Light bending at 0% for the cost comparison.
6. **Home screens:** a fresh profile shows Desktop and the plus page; add, rename and remove screens; an older profile loses only its empty placeholder screens.
7. **Screen time and the taskbar:** WhatsApp, Claude, ChatGPT, Gemini and Firefox are named and iconed as Windows shows them, with no `ApplicationFrameHost` or `WhatsApp.Root` entries, and old history merged once.
8. **Motion:** fade between pages and its toggle, and Animations off or reduced motion removing it.
9. **Help and hover:** F1 and ? open Shortcuts & help and the list matches behaviour; menus, the tray and taskbar previews stay open while the pointer travels diagonally toward them.
10. **Everything in WORKORDER §9** that 0.2.1 left open (installer, tray, single instance, multi-monitor, login start).

The matrix below covers the whole plan, including releases after 0.3.0.

- **Automated frontend:** timer transitions, finish/skip accounting, local history bounds, settings normalisation, rail-edge geometry,
  panel constraints, cached-bootstrap reconciliation and keyboard behaviour.
- **Automated Rust:** cache keys, file-signature invalidation, atomic index recovery, eviction, bootstrap payload and store allow-list.
- **Privacy/integration:** permission denial/revocation, unsupported portable build, per-app notification exclusion, retention expiry,
  encrypted-store recovery, `.ics` recurrence/timezones, OAuth cancellation/refresh/revocation, feed sanitisation, OPML import/export,
  disabled-state network silence and offline cached agenda/news.
- **Browser UI:** screenshots for all Focus states, immersive mode, customiser presets, four rail edges, four Activity drawer edges and
  their miniature previews at 1280 × 800, 1024 × 600, 800 × 600 and 600 × 600; no overflow or overlap.
- **Native Windows:** real notification opt-in, physical pointer resize, four-edge previews, taskbar icon parity, login startup, hotkey
  availability, cold restart timing, multi-monitor movement and 100/150/200% scaling.
- **Release gates:** `npm test`, `npm run build`, `cargo fmt --check`, Clippy with warnings denied, `cargo test --locked`,
  `cargo check --locked`, clean UI suite and owner visual acceptance of Focus.

## 12. Deliberate exclusions

- No pane-internal sorting; pane member order remains manual.
- No Opaline server, account, telemetry or downloaded quote service. Optional calendar networking is direct and off until authorised.
- No modification of Windows Focus Assist, lock screen or real taskbar position.
- No persisted window thumbnails, window handles or backdrop captures.
- No silent notification capture, indefinite notification retention or notification-content logging.
- No Google Calendar write scope in the first connector; no promise that system-wide capture works in the portable build.
- No proprietary news API, server-side feed proxy, recommendation profile, full-article scraping or remote content when News is off.
- No per-monitor layout profiles, plugin system or command palette in 0.3.0.

## 13. Feasibility references

- Microsoft documents the notification listener, its explicit access request and the `userNotificationListener` manifest capability:
  [Notification listener — Windows apps](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/app-notifications/notification-listener).
- Microsoft documents package identity and the external-location option for unlocking capability/consent-based Windows features while
  retaining an existing installer: [Grant package identity by packaging with external location](https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/grant-identity-to-nonpackaged-apps).
- Google documents desktop OAuth as a public-client flow and recommends PKCE; desktop loopback redirects remain supported:
  [OAuth 2.0 for Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app).
- Google documents Calendar scopes and the verification implications of accessing user calendar data:
  [Choose Google Calendar API scopes](https://developers.google.com/workspace/calendar/api/auth).

