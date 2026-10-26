; Opaline belongs in Start, not on the user's Desktop.
; Tauri creates the Start Menu shortcut before this hook runs.
!macro NSIS_HOOK_POSTINSTALL
  Delete "$DESKTOP\Opaline.lnk"
!macroend
