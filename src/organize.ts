import type { Item } from "./api";
import { ensureGroup, groupOf, groups } from "./groups";

/**
 * Auto-organise rules (WORKORDER §6). Plain data on purpose: adding a rule is one line.
 * The first matching rule wins, so order matters. A pane needs at least two members.
 */
type Rule = { id: string; name: string; folders?: boolean; match: RegExp };

const RULES: Rule[] = [
  {
    id: "ides",
    name: "IDEs",
    match:
      /android studio|visual studio|vs ?code|vscode|intellij|pycharm|webstorm|phpstorm|\brider\b|clion|goland|rubymine|datagrip|eclipse|netbeans|xcode|sublime|notepad\+\+|\bkate\b|\bzed\b|cursor|windsurf|neovim|\bvim\b|emacs|helix|jetbrains|fleet/i,
  },
  {
    id: "ai",
    name: "AI & code agents",
    match:
      /chatgpt|claude|gemini|copilot|codex|perplexity|grok|ollama|lm studio|\bjan\b|aider|mistral|deepseek|wispr|openai|anthropic|qwen|kimi/i,
  },
  {
    id: "devtools",
    name: "Dev tools",
    match:
      /docker|dbeaver|postman|insomnia|\bgit(hub)?\b|sourcetree|\bfork\b|warp|terminal|powershell|\bwsl\b|ubuntu|putty|filezilla|tableplus|mongodb|redis|virtualbox|vmware|hyper-v|android sdk/i,
  },
  {
    id: "notes",
    name: "Notes & planning",
    match: /notion|obsidian|onenote|evernote|logseq|todoist|trello|calendar|sticky notes|joplin|clickup|asana|\blinear\b/i,
  },
  {
    id: "browsers",
    name: "Browsers",
    match: /firefox|chrome|\bedge\b|brave|opera|vivaldi|safari|\barc\b|tor browser|zen browser/i,
  },
  {
    id: "chat",
    name: "Chat",
    match: /discord|whatsapp|telegram|slack|\bteams\b|zoom|signal|messenger|skype|element|viber/i,
  },
  {
    id: "creative",
    name: "Creative",
    match:
      /krita|blender|gimp|inkscape|photoshop|illustrator|figma|canva|davinci|premiere|after effects|\bobs\b|huion|wacom|audacity|clip studio|aseprite|affinity|lightroom|capcut|handbrake/i,
  },
  {
    id: "play",
    name: "Games & music",
    match:
      /steam|epic games|spotify|battle\.net|riot|league of legends|valorant|minecraft|xbox|gog galaxy|ea app|itunes|\bvlc\b|apple music|tidal|deezer|roblox|fortnite|playnite/i,
  },
  {
    id: "utilities",
    name: "Utilities",
    match:
      /download manager|wiztree|7-?zip|winrar|ccleaner|powertoys|sharex|rufus|balena|treesize|crystaldisk|cpu-z|hwinfo|teamviewer|anydesk|bitwarden|1password|keepass|nordvpn|speccy|autoruns/i,
  },
  {
    id: "university",
    name: "University",
    folders: true,
    match: /semester|\buni(versity|stuff)?\b|lecture|course|module|vault|college|school/i,
  },
  {
    id: "code",
    name: "Code projects",
    folders: true,
    match: /[-_.]source$|^projects?$|tinker|\brepos?\b|workspace|sandbox|[-_]src$/i,
  },
  {
    id: "archive",
    name: "Archive",
    folders: true,
    match: /^backups?$|legacy|archive|\bold\b|^misc$/i,
  },
];

/**
 * Sorts loose items into panes. Never touches an item that is already in a pane, and leaves
 * anything that matches nothing (or would be alone in its pane) loose. Returns how many moved.
 */
export function organize(items: Item[]): number {
  const buckets = new Map<Rule, string[]>();

  for (const item of items) {
    if (groupOf(item.path)) continue;

    const rule = RULES.find((candidate) => !!candidate.folders === item.isFolder && candidate.match.test(item.name));
    if (!rule) continue;

    const bucket = buckets.get(rule) ?? [];
    bucket.push(item.path);
    buckets.set(rule, bucket);
  }

  let moved = 0;
  for (const [rule, paths] of buckets) {
    // a pane that already exists can take a single newcomer; a new pane needs company
    const exists = groups().some((group) => group.id === rule.id);
    if (!exists && paths.length < 2) continue;

    ensureGroup(rule.id, rule.name, paths);
    moved += paths.length;
  }
  return moved;
}
