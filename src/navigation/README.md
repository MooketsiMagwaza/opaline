# Navigation feature

Owns page routing, Home-screen routing, keyboard recovery paths, visual destination arrangements and physical swipe/pinch recognition.

## Modules

- `pages.ts` is the page controller. It renders All apps and named Home screens, synchronises search, and exposes `show`, `cycle`,
  `cycleHome`, `selectPage`, `previewGesture` and `completeGesture`.
- `gestures.ts` contains `PageGestureController`, a single recogniser for precision-touchpad wheel input and two-touch pointer input.
- `gesture-motion.ts` owns what a gesture looks like: the live preview while it is held, and the commit animation when it lands.
- `tray.ts` makes the Dropdown Tray behave as a dropdown (hover to open, path-aware close, click to pin, outside press or Escape to dismiss).
- `navigation.css` owns the five arrangements (Split header, Navigation taskbar, Dropdown tray, Taskbar ends and Sidebar), overflow, applied
  visibility rules, the gesture cue and the keyboard hints.

## Gesture state machine

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Collecting: horizontal wheel or pinch delta
  Collecting --> Previewing: below threshold
  Previewing --> Committed: threshold reached
  Committed --> ConsumingTail: navigate exactly once
  ConsumingTail --> ConsumingTail: decaying inertia
  ConsumingTail --> Idle: 240 ms quiet
  Previewing --> Idle: 120 ms quiet / cancel
```

The committed-tail branch runs before page availability checks. This is intentional: the incoming inertial wheel events of a swipe that
already navigated still belong to it and must be consumed rather than start a second page change. Motion in flight never blocks the next
gesture: a new preview or navigation ends the running transition first (`endTransition()`), and a 1.5 s safety timer clears a stalled one.

## Gesture motion

The preview is driven only by three custom properties on the element being moved — `--gesture-dir` (±1), `--gesture-p` (eased 0..1) and
`--gesture-fade` — and the CSS in `navigation.css` maps them to `transform` and `opacity`. Nothing else animates while a gesture is held, so
it stays on the compositor and cannot clip or relayout.

- **Swipe** slides only the Home content (`.home-motion`) over stationary glass, 56 px at full progress. There is always a page to go to:
  Home ends with an empty new-screen page (below), so a swipe never has to refuse.
- **Pinch** zooms the whole page surface (±7.5 %) with a fade, then cross-zooms into the destination: the outgoing page scales away while
  the incoming one scales up from slightly small.
- A floating cue (`#gesture-cue`) names the destination while the gesture is held. It is made of the panel glass tokens, so it follows the
  theme, with a direction arrow and a kicker ("Next page", "Previous screen") drawn from `data-kicker`. Only the two constant arrow paths
  are written as markup; the destination name is always set as text.
- On commit the app navigates **immediately** and `playCommit` cross-animates a ghost clone of the outgoing page with the Web Animations
  API (named `gesture-out`/`gesture-in`), so the real page is always the live, interactive one. The clone keeps its ids because the
  stylesheet is id-keyed, is appended last in `#shell` so `getElementById` still finds the real page, and a swipe ghost hides its glass so
  only the content moves.
- View Transitions are deliberately not used: they morph geometry, clip differently and can stall in WebView2 until the pointer moves.
- Reduced motion and `data-anim="false"` remove the movement but keep the destination cue.

## Routing rules

- Horizontal swipes route only between Home screens and wrap at both ends. Home screens are Desktop, the custom screens and, while fewer
  than eight exist, one trailing new-screen page (as on Android): a large plus there, or Enter, creates the next screen, and the pager's
  last dot is a plus that goes to it. A custom screen has a Remove screen button that asks first when it holds items.
- Pinch routes through the five top-level destinations.
- Alt+1–5 is always available regardless of visual arrangement or pin state.
- Split Header places destinations around search; Navigation Taskbar moves them beside Home; Dropdown Tray keeps them behind one trigger;
  Taskbar Ends puts the two destination groups in the taskbar's own bar, one beside Home and one after the app mirror; Sidebar is the taskbar turned on its side: one
  compact glass pill of every destination, centred on the left or right edge (`navigationSide`), with the page panel kept clear of it.
- Compact navigation (Ctrl+B) minimises the controls only while the taskbar mirror is on, because its expand button is what brings them
  back; without the mirror the setting is disabled and Ctrl+B says why.
- Pages steered with the keyboard show small key hints (arrows, Enter, Tab) in the panel's bottom corner; compact mode hides them.
- F1, or ? when nothing is being typed, opens Settings on Shortcuts & help.
- Every page change eases the incoming page in (`core/motion.ts` `fadeIn`) unless a gesture commit is already animating it, the overlay is opening, or
  the Fade between pages setting, Animations or the system's reduced-motion preference turns it off. The animation paints only its starting frame, so
  it never leaves a transform behind for the gesture preview to fight.
- Unpinned destinations remain in overflow, and Settings always has a keyboard recovery path.

`pages.ts` depends on feature public APIs because it coordinates their top-level surfaces. No feature may import the application launcher.
