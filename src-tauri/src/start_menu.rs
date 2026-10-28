//! Opt-in Windows-key tap routing. Windows chords pass through unchanged.
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::AppHandle;

static ENABLED: AtomicBool = AtomicBool::new(false);
static AVAILABLE: AtomicBool = AtomicBool::new(false);

#[derive(Serialize)]
pub struct Status {
    enabled: bool,
    available: bool,
}
pub fn status() -> Status {
    Status {
        enabled: ENABLED.load(Ordering::Relaxed),
        available: AVAILABLE.load(Ordering::Relaxed),
    }
}
pub fn set_enabled(app: &AppHandle, enabled: bool) -> Result<(), String> {
    if enabled && !AVAILABLE.load(Ordering::Relaxed) {
        return Err(
            "Windows-key integration is unavailable. Windows Start is still active.".into(),
        );
    }
    crate::store::save(
        app,
        "shell.json",
        &serde_json::json!({ "startMenu": enabled }).to_string(),
    )?;
    ENABLED.store(enabled, Ordering::Relaxed);
    Ok(())
}
pub fn start(app: &AppHandle) {
    #[cfg(windows)]
    imp::start(app);
    #[cfg(not(windows))]
    let _ = app;
}

#[cfg(windows)]
mod imp {
    use super::*;
    use std::{
        mem::size_of,
        sync::{OnceLock, atomic::AtomicU32, mpsc},
    };
    use windows::Win32::{
        Foundation::{HINSTANCE, LPARAM, LRESULT, WPARAM},
        System::LibraryLoader::GetModuleHandleW,
        UI::{
            Input::KeyboardAndMouse::{
                GetAsyncKeyState, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT,
                KEYEVENTF_EXTENDEDKEY, KEYEVENTF_KEYUP, SendInput, VIRTUAL_KEY, VK_CONTROL,
                VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT,
            },
            WindowsAndMessaging::{
                CallNextHookEx, GetMessageW, KBDLLHOOKSTRUCT, LLKHF_INJECTED, MSG,
                SetWindowsHookExW, UnhookWindowsHookEx, WH_KEYBOARD_LL, WM_KEYDOWN, WM_SYSKEYDOWN,
            },
        },
    };

    static WIN: AtomicU32 = AtomicU32::new(0);
    static CHORD: AtomicBool = AtomicBool::new(false);
    static OPEN: OnceLock<mpsc::Sender<()>> = OnceLock::new();
    const MARKER: usize = 0x4f50414c;

    fn key(vk: u16, up: bool) -> INPUT {
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VIRTUAL_KEY(vk),
                    dwFlags: (if up {
                        KEYEVENTF_KEYUP
                    } else {
                        Default::default()
                    }) | (if vk == VK_LWIN.0 || vk == VK_RWIN.0 {
                        KEYEVENTF_EXTENDEDKEY
                    } else {
                        Default::default()
                    }),
                    dwExtraInfo: MARKER,
                    ..Default::default()
                },
            },
        }
    }

    unsafe extern "system" fn hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        unsafe {
            if code < 0 {
                return CallNextHookEx(None, code, wparam, lparam);
            }
            let event = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
            if event.flags.contains(LLKHF_INJECTED) || event.dwExtraInfo == MARKER {
                return CallNextHookEx(None, code, wparam, lparam);
            }
            if !ENABLED.load(Ordering::Relaxed) {
                WIN.store(0, Ordering::Relaxed);
                return CallNextHookEx(None, code, wparam, lparam);
            }
            let down = wparam.0 == WM_KEYDOWN as usize || wparam.0 == WM_SYSKEYDOWN as usize;
            let vk = event.vkCode;
            if vk == VK_LWIN.0 as u32 || vk == VK_RWIN.0 as u32 {
                if down {
                    if WIN.load(Ordering::Relaxed) == 0 {
                        WIN.store(vk, Ordering::Relaxed);
                        CHORD.store(
                            [VK_CONTROL, VK_MENU, VK_SHIFT]
                                .iter()
                                .any(|key| GetAsyncKeyState(key.0 as i32) < 0),
                            Ordering::Relaxed,
                        );
                    }
                } else if WIN.swap(0, Ordering::Relaxed) == vk && !CHORD.load(Ordering::Relaxed) {
                    // Ctrl held across Win-up cancels Start without delaying or replaying Win chords.
                    // On injection failure, pass the original release so the shell remains usable.
                    let inputs = [
                        key(VK_CONTROL.0, false),
                        key(vk as u16, true),
                        key(VK_CONTROL.0, true),
                    ];
                    if SendInput(&inputs, size_of::<INPUT>() as i32) == inputs.len() as u32 {
                        if let Some(open) = OPEN.get() {
                            let _ = open.send(());
                        }
                        return LRESULT(1);
                    }
                }
            } else if down && WIN.load(Ordering::Relaxed) != 0 {
                CHORD.store(true, Ordering::Relaxed);
            }
            CallNextHookEx(None, code, wparam, lparam)
        }
    }

    pub fn start(app: &AppHandle) {
        let enabled = crate::store::load(app, "shell.json")
            .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
            .and_then(|value| value.get("startMenu")?.as_bool())
            .unwrap_or(false);
        let (send, receive) = mpsc::channel();
        let _ = OPEN.set(send);
        let app = app.clone();
        std::thread::spawn(move || {
            for () in receive {
                let handle = app.clone();
                let _ = app.run_on_main_thread(move || crate::open_app_list(&handle));
            }
        });
        std::thread::spawn(move || unsafe {
            let module = GetModuleHandleW(None)
                .ok()
                .map(|module| HINSTANCE(module.0));
            let Ok(hook) = SetWindowsHookExW(WH_KEYBOARD_LL, Some(hook), module, 0) else {
                return;
            };
            AVAILABLE.store(true, Ordering::Relaxed);
            ENABLED.store(enabled, Ordering::Relaxed);
            let mut message = MSG::default();
            while GetMessageW(&mut message, None, 0, 0).0 > 0 {}
            ENABLED.store(false, Ordering::Relaxed);
            AVAILABLE.store(false, Ordering::Relaxed);
            let _ = UnhookWindowsHookEx(hook);
        });
    }
}
