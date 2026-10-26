# Opaline centred grid — work order

This work order extends the main launcher brief without changing its safety boundary: Opaline still only reads Desktop files. Reordering
something changes `groups.json` metadata, never the file or folder on disk. The filename is retained for compatibility with existing
links from the early spatial-canvas prototype.

## Objective

Keep every app, folder and pane in a predictable centred grid. Dragging changes grid order only: entries cannot be left between cells,
overlap one another or become stranded off-screen. Search and the rail remain independent floating surfaces.

## Requirements

| ID | Requirement | Status | Notes |
|---|---|---|---|
| S-01 | Drag a loose app or folder between snapped grid cells to reorder it | `[~]` | Implemented; real pointer/restart pass pending |
| S-02 | Drag a pane between snapped grid cells to reorder it | `[~]` | Implemented; real pointer/restart pass pending |
| S-03 | Every row remains centred across display-size and scaling changes | `[~]` | Flex grid centres each wrapped row; multi-monitor pass pending |
| S-04 | Search uses the same centred flow and does not disturb the saved order | `[~]` | Automated build passes; clear-search regression pass pending |
| S-05 | App-to-app grouping and app-to-pane drops retain priority over reordering | `[~]` | Drop handlers retain priority; manual drag pass pending |
| S-06 | One rounded apps surface holds the grid; search and rail float independently | `[x]` | Observed in the Windows app at 1920×1200 / 150% |
| S-07 | A reordered entry can return to automatic order | `[~]` | Context-menu action implemented; manual pass pending |
| S-08 | Order metadata is validated and never changes Desktop files | `[x]` | Unit-tested store clamping/order; only `groups.json` is written |

`[x]` means verified; `[~]` means implemented but still needs the indicated real-app check.

## Interaction rules

- Drop a loose item, folder or pane between cells to reorder the centred grid.
- Drop one loose item on another to make a pane, exactly as before.
- Drop an item on a pane to add it, exactly as before.
- Search results use a centred flow; clearing search restores the saved order.
- Right-click a reordered item or pane and choose **Return to automatic order** to rejoin the generated order.
- Pane-member removal remains metadata-only. No drag operation moves a Desktop file.

## Data format

`groups.json` keeps a `layout` object alongside panes and launch counts. Keys are namespaced (`item:<path>` and `group:<id>`), and values
remain normalized `{ "x": 0..1, "y": 0..1 }` records for backward compatibility. The current grid writes monotonically increasing `x`
ranks with `y: 0`; older free-position records are read once in row-major order and rendered in snapped cells.

## Acceptance pass

1. Reorder a folder, loose app and pane; confirm all three snap to cells and every wrapped row remains centred.
2. Close and reopen Opaline and confirm the order persists.
3. Resize/change monitor scaling and confirm entries stay centred, non-overlapping and on-screen.
4. Drop one loose item onto another, then drop a third item onto the new pane; confirm grouping wins over reordering.
5. Search for a known item, clear the search and confirm the prior order returns unchanged.
6. Use **Return to automatic order** on an item and pane and confirm each rejoins the generated flow.
7. Restart and inspect the real Desktop folder to confirm no file or folder was moved or renamed.
