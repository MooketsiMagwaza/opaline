# Platform roadmap

These are planned work packages, not claims about the current `0.1.0` build. Each package must receive detailed acceptance criteria in
the main work order before implementation.

## P1 — App Library

Current implementation: the page switcher loads a true Windows catalogue from AppsFolder after presentation, covering classic Start-menu
entries and packaged apps. Remaining work hardens that catalogue.

- Add usage ordering and complete arrow-key navigation to the searchable **All apps** surface.
- Keep the Desktop canvas and All apps as separate modes so a large app catalogue does not slow opening.
- Cache metadata locally and refresh off the visible-frame path.

## P1 — Widgets

No widget UI ships in the current launcher. Earlier clock/calendar mockups were removed to keep Home focused and visually consistent.
Any future widget system must remain optional and off the opening path.

- Add opt-in, reorderable cards using the centred grid-order system.
- Begin with offline system widgets: clock, CPU/memory, storage and a quick note.
- Each widget owns a strict refresh budget and pauses while the overlay is hidden.
- Network-backed widgets require a separate privacy review, explicit consent and per-provider configuration; the default build remains
  network-free and telemetry-free.

## P2 — Calendar

- Start with read-only local `.ics` calendars and a month/agenda widget.
- A future Outlook/Google connector must be optional, least-privilege and isolated from the core launcher.
- Event creation, reminders and account authentication are separate work packages with accessibility and privacy acceptance tests.

## P2 — Start surface

- Offer Opaline as an **opt-in Start-style app list**, opened by its own rebindable shortcut or tray command.
- Do not patch Explorer, replace `StartMenuExperienceHost`, intercept the Windows key or change system policy.
- Match Start essentials before calling it a replacement: all-apps enumeration, pinning, recent items, power/session shortcuts,
  keyboard-only use, narrator labels and a reliable escape route.
- Keep the feature reversible: disabling it returns Opaline to the Desktop launcher without changing Windows Start.

The guiding rule is that Opaline may supplement Windows, but it must never make the shell difficult to recover.

## P2 — Taskbar rail (deprecated from 0.1)

- Revisit the retained `rail.ts` and Taskband implementation only after the core overlay meets its frame-time and interaction budgets.
- Keep it opt-in and off by default; do not restart enumeration or thumbnail work on the opening path.
- Re-run pin completeness, packaged-app launch, focus/restore, preview latency, magnification and clipping acceptance before exposing its
  settings again.
