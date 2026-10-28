# UI guidance applied to this change

Reviewed 28 October 2026. These are design references, not promises of platform certification.

| Primary source | Applied decision |
|---|---|
| [Apple: Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars) | Separate page navigation from taskbar actions; use a small set of clear commands; keep a reliable expand control when navigation is collapsed. |
| [Apple: Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards) | Preserve modal Tab navigation and visible focus. The owner specifically requested Shift+Tab for page cycling; offer Ctrl+Tab as the conventional alternative. Show shortcut hints beside page names. |
| [Apple: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) | Stable top-level destinations and an explicit selected page. Desktop is always the first space. |
| [Figma: Components, styles and shared libraries](https://www.figma.com/best-practices/components-styles-and-shared-libraries/) | Reuse acrylic tokens, library rows, icons, settings controls and states. Keep app/pane/workspace hierarchy consistent rather than inventing another visual system. |
| [Figma: Name and organize components](https://help.figma.com/hc/en-us/articles/360038663994-Name-and-organize-components) | Use purpose-based names: workspace, pane, app list, taskbar and screen time. Keep the same vocabulary in UI and work orders. |

The compact taskbar follows the toolbar guidance to keep frequent actions distinct and make more room for content. The period dropdown and charts use the same labelled, focusable controls as the rest of Opaline. Focus is a separate destination, with a visible selected state; Zen and the screen saver have clear exit controls. These are applications of the guidance to a Windows launcher, not claims that the controls are Apple or Figma components.

The owner later preferred four matching header icons. Plain < and > arrows sit vertically centered outside the app surface; All apps and Focus sit left of search, and Screen time and Settings sit right of search. Each pair shares one acrylic capsule matching search and the taskbar, with transparent buttons and hover, focus and active feedback. The top-left switcher and shutdown orb are removed. The taskbar mirror contains only apps and shares search's 52 px height. A 500 ms hover (or immediate keyboard focus) shows an icon grid of group/folder contents. Demo groups are internally coherent, with Android Studio in IDEs and project folders inside Code projects.

Windows integration follows [Microsoft's virtual desktop interface](https://learn.microsoft.com/windows/win32/api/shobjidl_core/nn-shobjidl_core-ivirtualdesktopmanager), [keyboard hook guidance](https://learn.microsoft.com/windows/win32/winmsg/lowlevelkeyboardproc), and [SendInput's documented integrity limitations](https://learn.microsoft.com/windows/win32/api/winuser/nf-winuser-sendinput). A Windows-key tap override supplements the shell while Opaline runs; it does not modify Windows policy or intercept the native taskbar Start button.

## Screenshot and artwork policy

`docs/images/*.png` are rendered from the real frontend using isolated fixtures in `scripts/verify-ui.mjs`. Familiar public app names and their locally extracted icons are used for identification; folders, preview contents, usage totals and wallpaper are synthetic. Blur (10 px), tint (16%, `#0b1226`) and small icons match the owner's latest saved appearance. These screenshots are not Windows integration evidence or measured real usage. `workspace-flow.svg` is an original vector illustration.

App names, logos and `docs/demo-icons/*.png` belong to their respective owners and are used only to illustrate the launcher with those apps. They are excluded from any claim that this repository owns or relicenses third-party trademarks or artwork. The fixture manifest contains public app names and repository-relative icon paths, never the owner's installation paths.

To reproduce, run Vite, make Playwright available to Node (or set `OPALINE_PLAYWRIGHT_MODULE` to an installed module), and run `node scripts/verify-ui.mjs`. `OPALINE_BROWSER_PATH` optionally selects an installed Chromium/Edge executable. This does not connect to or alter the owner's real app data.
