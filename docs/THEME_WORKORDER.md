# Opaline acrylic surfaces — work order

This package keeps the launcher visually consistent without returning to nested translucent boxes or expensive per-item effects. It
extends R-08 and R-11 in the main work order. Visual settings and layout metadata never move or rename a Desktop file.

## Objective

- One rounded acrylic surface contains the centred Home grid.
- Sparse final rows start at the same leftmost column as full rows.
- A loose app or folder is only its icon and name, with no individual bubble.
- A pane has one rounded mini-icon bubble and its name underneath.
- Search and page navigation float independently from the apps surface.
- One material vocabulary covers Home, All Apps, popup, settings and menus.
- Appearance exposes named material presets and the acrylic controls (blur, tint, panel opacity and colour, corner radius, Light bending); each applies live to the same surfaces.
- A compact pager identifies the current Home screen; the Home button sits beside the taskbar, which can dock to any edge. Two-line labels keep their full height, and overflowing grids scroll without a permanent fade mask hiding their final rows.

## Requirements

| ID | Requirement | Status | Notes |
|---|---|---|---|
| V-01 | Each pane uses one rounded mini-icon bubble with its label underneath; preview icons do not add nested plates | `[~]` | Hierarchy observed; bright/dark wallpaper pass pending |
| V-02 | Loose apps/folders use icon + label with no per-item bubble, inside one rounded apps surface | `[~]` | Pointer, keyboard-focus and long-label pass pending |
| V-03 | Sparse rows stay left-aligned to the established centred grid columns | `[~]` | Observed with a two-item final row at 1280×800 CSS pixels |
| V-04 | Search and page navigation are independent floating surfaces | `[~]` | Multi-monitor edge pass pending |
| V-05 | Blur intensity, tint strength and tint colour apply live without rebuilding the item model | `[~]` | Runtime and persistence pass pending |
| V-06 | Older theme settings migrate to the acrylic defaults without changing panes or grid order | `[~]` | Automated fallback covered; upgrade restart pass pending |
| V-07 | Home, All Apps, popup, settings and menus share the same fill, border, highlight, radius and shadow vocabulary | `[~]` | Full transient-surface inventory pending |
| V-08 | Material changes introduce no per-card backdrop filters | `[~]` | Integrated-GPU trace pending |
| V-09 | Bright and dark wallpapers preserve readable text and visible focus rings | `[~]` | Contrast and forced-colours inspection pending |
| V-10 | Reduced motion suppresses the short app-grid pop without changing layout | `[~]` | Browser check passed; real Windows reduced-motion pass pending |
| V-11 | Pane popups expand from their originating group tile and reverse smoothly on close | `[~]` | Browser origin geometry/reduced-motion checks pass; owner native edge/pointer pass pending |
| V-12 | Saved appearance is preserved; demo screenshots use current blur/tint/icon size and recognisable apps | `[~]` | W-18; 10 px / 16% / small; public app icons with synthetic folder names |
| V-13 | Scrollable surfaces share a custom acrylic thumb whose width is adjustable | `[~]` | Browser checked at four viewports; Windows scaling/pointer pass pending; W-19 |
| V-14 | Compact taskbar and wider content surface preserve room for apps | `[~]` | Bottom rail and 960 px surface rendered; Windows scaling pass pending; W-21 |
| V-15 | Screen-time menu, graphs and Focus share labelled controls and visible focus | `[~]` | Browser interaction/screenshots checked; native keyboard/contrast pass pending; W-23–W-26 |
| V-16 | Header sections use matching outline icons with hover/selected states; centered side arrows replace the top-left switcher | `[~]` | Browser visual/layout pass; real scaling pass pending; W-32 |
| V-17 | Taskbar and search share one height, with no visible scrollbar or launcher-brand dock button | `[~]` | Browser computed geometry/scrollbar check; real scaling pass pending; W-31/W-34/W-35 |
| V-18 | Group/folder peek uses the same acrylic material without obscuring labels permanently | `[~]` | Browser hover timing/card screenshot; Windows pointer pass pending; W-33 |
| V-19 | Surfaces are flat translucent fills with a hairline border and a lit rim; no white-to-colour sheen gradients on glass, pane plates or Focus cards | `[~]` | Removed in 0.3.0; browser visual pass; owner look on the native build |
| V-20 | Five named presets (and user presets) each set a complete material recipe; light materials, including a user's own, keep text, dots, key caps and rules readable | `[~]` | Each preset checked in the browser suite and by eye; bright-wallpaper pass on the native build pending |
| V-21 | Light bending refracts the desktop at large-surface edges only; 0% runs no filter; unsupported engines fall back to frost; filter count follows the number of large surfaces, never items | `[~]` | Physics unit-tested; a pixel-diff browser test proves the displacement; GPU cost on the target Intel GPU unmeasured (R-75) |

`[~]` means implemented or actively merged but not accepted until the real-app checks below have been observed.

## Surface architecture

```text
captured, blurred canvas
├─ floating search surface
├─ rounded Home / All Apps surface
│  ├─ app/folder: icon + label, no bubble
│  └─ pane: rounded mini-icon bubble + label below
├─ floating page navigation
├─ taskbar mirror (any screen edge)
├─ Settings panel (expands to the whole window)
└─ transient surfaces: pane popup, item picker, context menu
```

Only the large floating and transient surfaces may use `backdrop-filter`. Loose items add no card fill; pane bubbles use ordinary acrylic
fills, borders, highlights and shadows. Adding one backdrop filter per entry is prohibited because it scales GPU work with item count.
Light bending (`core/refraction.ts`, `core/glass.ts`) is the one sanctioned exception: an optional SVG displacement filter applied to each large surface, never to an item, and absent at 0%. It is a deliberate GPU cost to be measured (V-21), not a default.

## Controls and migration

The persisted material values are `materialProfile`, `backdropBlur`, `backdropSaturation`, `backdropBrightness`, `tintStrength`, `tintColor`, `paneBlur`, `refraction`,
`cornerRadius`, `tileGlass`, `customSurfaceColor` and `customSurfaceOpacity`. A preset sets them together; fine-tuning a value switches the material to custom. There are no per-card
glass settings. Older `solid`, `liquid`, `frost`, `clear`, `custom`, `glass` and `frosted` values load safely and normalize to the acrylic presentation; pane and grid
metadata live separately and are untouched.

## Acceptance pass

1. Test one bright and one dark wallpaper. Confirm search, labels, counts, settings text and focus rings remain readable.
2. Inspect a pane, loose app and folder at every icon size. Confirm loose entries have no bubble, pane mini-icons share exactly one bubble,
   names sit below, and long names clamp without overlapping a neighbour.
3. Verify final rows containing one through five entries begin at the grid's first column and remain inside the centred Home surface.
4. Reorder entries, search, clear search, switch pages and change acrylic controls. Confirm grid order and grouping do not change.
5. Change the Appearance controls and a preset, press Done, restart, and confirm the values return (Cancel must restore the previous ones).
6. Load settings created by the old multi-theme build and confirm acrylic is selected without resetting panes.
7. Enable Windows reduced motion and keyboard through search, cards and every transient surface. Confirm focus remains visible and motion is suppressed.
8. Profile opening and scrolling with at least 45 Desktop items on the target Intel Iris Xe. Confirm card count does not increase backdrop-filter
   count and warm snapshot request-to-visible stays below the 300 ms work-order budget.
9. Switch through all five presets. With any of them, set Light bending to 100% and to 0%, then scroll and change pages on the target GPU; confirm the edges bend only
   when it is on, text stays readable on bright and dark wallpapers, and frames stay smooth.

Do not mark V-01–V-10 `[x]` from a screenshot or build alone; record the observed Windows build, scaling, GPU and wallpaper exercised.
