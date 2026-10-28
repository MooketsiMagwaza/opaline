# Platform roadmap

These are planned work packages, not claims about the current `0.2.1` release. Each package must receive detailed acceptance criteria in
the main work order before implementation.

## P1 — App Library

Current implementation: the page switcher loads a true Windows catalogue from AppsFolder after presentation, covering classic Start-menu
entries and packaged apps. Remaining work hardens that catalogue.

- Arrow navigation and prefix-ranked search are implemented; finish native keyboard acceptance and usage ordering.
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

## Active — Opt-in Windows-key app list

- The owner explicitly requested Windows-key routing on 28 October 2026. Behaviour now offers an opt-in key-tap override opening All apps, off by default. It supplements Windows rather than replacing Explorer.
- Do not patch Explorer, replace `StartMenuExperienceHost` or change system policy. Preserve Win chords, native Start-button clicks and Ctrl+Esc; verify both Windows keys and elevated-window fallback with the owner.
- Match Start essentials before calling it a replacement: all-apps enumeration, pinning, recent items, power/session shortcuts,
  keyboard-only use, narrator labels and a reliable escape route.
- Keep the feature reversible: disabling it returns Opaline to the Desktop launcher without changing Windows Start.

The guiding rule is that Opaline may supplement Windows, but it must never make the shell difficult to recover.

## Active — Taskbar rail and named spaces

- The owner requested reactivation of the retained `rail.ts` and Taskband implementation as a bottom taskbar mirror. It is configurable in Settings and refreshes after presentation, stopping when hidden.
- Decoded thumbnail cache hits target presentation within 50 ms; cold PrintWindow captures have a separate measured budget. Validate pin completeness, packaged-app launch, focus/restore, magnification and clipping on the owner's desktop.
- Alt+1 selects the read-only Desktop Home; Alt+2–5 select All apps, Screen time, Focus and Settings. Tab and centered side arrows change Home screens. The arrows disappear on other main pages. Ctrl+B leaves the taskbar view and a small expand control.
- Native Windows virtual-desktop support is implemented; PowerToys Workspaces and multi-monitor restore acceptance remain open. Full scope and owner test: [session work order](SESSION_WORKORDER.md).

## Active — Login startup and taskbar icon parity

- Hidden startup makes the global hotkey available before Desktop/icon/rail warming completes. The installer or portable executable must remain at its registered path after enabling Launch at login; the owner sign-in test is still required.
- A running app's window icon takes priority over its shortcut/executable icon in the mirror. ChatGPT and other taskbar identities need a side-by-side check on the owner's Windows session. The bottom Home button uses an outline house, not a Windows logo.
