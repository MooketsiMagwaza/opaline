//! Opt-in in-app screen saver. Windows lock/sign-in and system screen-saver policy are untouched.
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use tauri::{AppHandle, Manager};
static ENABLED: AtomicBool = AtomicBool::new(false);
static IDLE_SECONDS: AtomicU64 = AtomicU64::new(300);
static READY: AtomicBool = AtomicBool::new(false);
static ACTIVE: AtomicBool = AtomicBool::new(false);

pub fn configure(enabled: bool, idle_minutes: u64) -> Result<(), String> {
    if enabled && !cfg!(windows) {
        return Err("Automatic screen saver is available on Windows.".into());
    }
    IDLE_SECONDS.store(idle_minutes.clamp(1, 60) * 60, Ordering::Relaxed);
    ENABLED.store(enabled, Ordering::Relaxed);
    Ok(())
}
pub fn ready() {
    READY.store(true, Ordering::Relaxed);
}
pub fn dismiss() {
    ACTIVE.store(false, Ordering::Relaxed);
}

#[cfg(windows)]
fn idle_seconds() -> Option<u64> {
    use windows::Win32::{
        System::SystemInformation::GetTickCount,
        UI::{
            Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO},
            WindowsAndMessaging::GetForegroundWindow,
        },
    };
    unsafe {
        if GetForegroundWindow().is_invalid() {
            return None;
        }
        let mut input = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            ..Default::default()
        };
        GetLastInputInfo(&mut input)
            .as_bool()
            .then(|| GetTickCount().wrapping_sub(input.dwTime) as u64 / 1000)
    }
}
#[cfg(not(windows))]
fn idle_seconds() -> Option<u64> {
    None
}

pub fn start(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(2));
            if !READY.load(Ordering::Relaxed) || !ENABLED.load(Ordering::Relaxed) {
                continue;
            }
            let Some(seconds) = idle_seconds() else {
                continue;
            };
            if ACTIVE.load(Ordering::Relaxed) && seconds < 2 {
                ACTIVE.store(false, Ordering::Relaxed);
                let handle = app.clone();
                let _ = app.run_on_main_thread(move || crate::hide(&handle));
            } else if seconds >= IDLE_SECONDS.load(Ordering::Relaxed)
                && !ACTIVE.load(Ordering::Relaxed)
            {
                let handle = app.clone();
                let _ = app.run_on_main_thread(move || {
                    let hidden = crate::main_window(&handle)
                        .is_some_and(|window| !window.is_visible().unwrap_or(true));
                    let preparing = handle
                        .state::<crate::AppState>()
                        .present_pending
                        .load(Ordering::Relaxed);
                    if hidden && !preparing && ENABLED.load(Ordering::Relaxed) {
                        ACTIVE.store(true, Ordering::Relaxed);
                        crate::begin_show_page(&handle, "screen-saver");
                    }
                });
            }
        }
    });
}
