/** Every way to drive Opaline without a menu, in one place. Keep it in step with the key handlers in app/launcher.ts. */
export type Shortcut = {
  /** Alternative key combinations; each combination is the keys pressed together. */
  keys?: string[][];
  /** For pointer and touch input, where there is nothing to press. */
  gesture?: string;
  action: string;
};
export type ShortcutGroup = { title: string; items: Shortcut[] };

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Open and close",
    items: [
      { keys: [["Ctrl", "Alt", "Space"]], action: "Open or close Opaline. This is the default hotkey; yours is set under Behaviour." },
      { keys: [["Esc"]], action: "Close the top layer: a menu, the picker, a pane, search text, Settings, then Opaline." },
      { keys: [["Ctrl", "Q"]], action: "Quit Opaline." },
      { keys: [["F1"], ["?"]], action: "Open this help." },
    ],
  },
  {
    title: "Pages",
    items: [
      { keys: [["Alt", "1–5"]], action: "Home, All apps, Screen time, Focus and Settings, always, whichever navigation style you use." },
      { keys: [["Ctrl", "Tab"], ["Ctrl", "Shift", "Tab"]], action: "Next or previous page." },
      { keys: [["Tab"], ["Shift", "Tab"]], action: "On Home, the next or previous Home screen, ending at the plus page that adds one." },
      { keys: [["Ctrl", "Alt", "A"], ["Ctrl", "Alt", "T"], ["Ctrl", "Alt", "F"]], action: "All apps, Screen time or Focus." },
      { keys: [["Ctrl", "B"]], action: "Minimise or restore the navigation controls." },
    ],
  },
  {
    title: "Finding and opening",
    items: [
      { keys: [["A–Z"]], action: "Start typing on Home or All apps to search." },
      { keys: [["↓"]], action: "From the search box, move to the first result." },
      { keys: [["←"], ["↑"], ["↓"], ["→"]], action: "Move between tiles and list items." },
      { keys: [["Enter"]], action: "Open the focused item, or the first match while you are searching." },
      { keys: [["Space"]], action: "Press the focused button." },
    ],
  },
  {
    title: "Menus and panes",
    items: [
      { gesture: "Right-click", action: "Options for an item: add it to a Home screen, and more." },
      { keys: [["↑"], ["↓"]], action: "Move through a menu." },
      { keys: [["→"], ["←"]], action: "Open a submenu, or go back out of it." },
      { keys: [["Tab"]], action: "Close a menu." },
    ],
  },
  {
    title: "Focus",
    items: [
      { keys: [["Space"]], action: "Start or pause the timer, unless a button has focus." },
      { keys: [["←"], ["→"]], action: "In Zen mode, the previous or next reminder." },
      { keys: [["Esc"]], action: "Leave Zen mode or the quiet clock." },
    ],
  },
  {
    title: "Touchpad and mouse",
    items: [
      { gesture: "Two-finger swipe", action: "Move between Home screens." },
      { gesture: "Pinch in or out", action: "Move to the previous or next page." },
      { gesture: "Click a dot", action: "Jump to that Home screen. The last dot is a plus that adds one." },
      { gesture: "Hover a taskbar icon", action: "Preview its window. Once one preview is open, the next icon shows at once." },
      { gesture: "Hover a pane or folder", action: "Peek inside without opening it." },
      { gesture: "Drag a tile", action: "Drop it between tiles to reorder, or onto a tile to make a pane." },
    ],
  },
];
