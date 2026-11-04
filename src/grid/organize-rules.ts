/** Editable pane-classification data. Order matters because the first matching rule wins. */
export type OrganizeRuleDefinition = {
  id: string;
  name: string;
  folders?: boolean;
  pattern: string;
};

export const ORGANIZE_RULES: readonly OrganizeRuleDefinition[] = [
  { id: "ides", name: "IDEs", pattern: "android studio|visual studio|vs ?code|vscode|intellij|pycharm|webstorm|phpstorm|\\brider\\b|clion|goland|rubymine|datagrip|eclipse|netbeans|xcode|sublime|notepad\\+\\+|\\bkate\\b|\\bzed\\b|cursor|windsurf|neovim|\\bvim\\b|emacs|helix|jetbrains|fleet" },
  { id: "ai", name: "AI & code agents", pattern: "chatgpt|claude|gemini|copilot|codex|perplexity|grok|ollama|lm studio|\\bjan\\b|aider|mistral|deepseek|wispr|openai|anthropic|qwen|kimi" },
  { id: "devtools", name: "Dev tools", pattern: "docker|dbeaver|postman|insomnia|\\bgit(hub)?\\b|sourcetree|\\bfork\\b|warp|terminal|powershell|\\bwsl\\b|ubuntu|putty|filezilla|tableplus|mongodb|redis|virtualbox|vmware|hyper-v|android sdk" },
  { id: "notes", name: "Notes & planning", pattern: "notion|obsidian|onenote|evernote|logseq|todoist|trello|calendar|sticky notes|joplin|clickup|asana|\\blinear\\b" },
  { id: "browsers", name: "Browsers", pattern: "firefox|chrome|\\bedge\\b|brave|opera|vivaldi|safari|\\barc\\b|tor browser|zen browser" },
  { id: "chat", name: "Chat", pattern: "discord|whatsapp|telegram|slack|\\bteams\\b|zoom|signal|messenger|skype|element|viber" },
  { id: "creative", name: "Creative", pattern: "krita|blender|gimp|inkscape|photoshop|illustrator|figma|canva|davinci|premiere|after effects|\\bobs\\b|huion|wacom|audacity|clip studio|aseprite|affinity|lightroom|capcut|handbrake" },
  { id: "play", name: "Games & music", pattern: "steam|epic games|spotify|battle\\.net|riot|league of legends|valorant|minecraft|xbox|gog galaxy|ea app|itunes|\\bvlc\\b|apple music|tidal|deezer|roblox|fortnite|playnite" },
  { id: "utilities", name: "Utilities", pattern: "download manager|wiztree|7-?zip|winrar|ccleaner|powertoys|sharex|rufus|balena|treesize|crystaldisk|cpu-z|hwinfo|teamviewer|anydesk|bitwarden|1password|keepass|nordvpn|speccy|autoruns" },
  { id: "university", name: "University", folders: true, pattern: "semester|\\buni(versity|stuff)?\\b|lecture|course|module|vault|college|school" },
  { id: "code", name: "Code projects", folders: true, pattern: "[-_.]source$|^projects?$|tinker|\\brepos?\\b|workspace|sandbox|[-_]src$" },
  { id: "archive", name: "Archive", folders: true, pattern: "^backups?$|legacy|archive|\\bold\\b|^misc$" },
] as const;
