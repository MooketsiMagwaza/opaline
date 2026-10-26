mod capture;
mod desktop;
mod icons;
mod store;
mod taskbar;

use std::{
    sync::{
        Mutex,
        atomic::{AtomicBool, Ordering},
    },
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, State, WebviewWindow, WindowEvent,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_opener::OpenerExt;

const DEFAULT_HOTKEY: &str = "ctrl+alt+space";
const CODENAME: &str = "Annealed";
const SNAPSHOT_WIDTH: u32 = 1280;
const THUMBNAIL_WIDTH: u32 = 360;
/// How long Rust waits for the UI to say the backdrop is ready before showing the window anyway.
const PRESENT_TIMEOUT: Duration = Duration::from_millis(900);
/// Focus changes this soon after showing are the window settling, not the user clicking away.
const BLUR_GRACE: Duration = Duration::from_millis(500);

struct AppState {
    /// Development flag: never hide on focus loss.
    pinned: bool,
    hotkey: Mutex<String>,
    hotkey_ok: AtomicBool,
    close_on_blur: AtomicBool,
    show_on_ready: AtomicBool,
    present_pending: AtomicBool,
    last_present: Mutex<Option<Instant>>,
    last_monitor: Mutex<Option<(i32, i32)>>,
}

#[derive(Serialize, Clone)]
struct Prepare {
    snapshot: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Status {
    hotkey_ok: bool,
    hotkey: String,
    version: &'static str,
    codename: &'static str,
    pinned: bool,
}

// ---------- hotkey ----------

fn hotkey_label(combo: &str) -> String {
    combo
        .split('+')
        .map(|part| {
            let mut chars = part.trim().chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join("+")
}

fn load_hotkey(app: &AppHandle) -> String {
    store::load(app, "config.json")
        .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
        .and_then(|value| value.get("hotkey")?.as_str().map(str::to_owned))
        .unwrap_or_else(|| DEFAULT_HOTKEY.to_string())
}

fn save_hotkey(app: &AppHandle, combo: &str) {
    let _ = store::save(app, "config.json", &serde_json::json!({ "hotkey": combo }).to_string());
}

fn register_hotkey(app: &AppHandle, combo: &str) -> Result<Shortcut, String> {
    let shortcut: Shortcut = combo.parse().map_err(|error| format!("{error}"))?;
    app.global_shortcut()
        .register(shortcut)
        .map_err(|error| error.to_string())?;
    Ok(shortcut)
}

// ---------- window lifecycle ----------

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

fn hide(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        let _ = window.hide();
    }
}

fn show_window(app: &AppHandle) {
    let Some(window) = main_window(app) else {
        return;
    };

    let _ = window.show();
    let _ = window.set_focus();
    if let Ok(mut last) = app.state::<AppState>().last_present.lock() {
        *last = Some(Instant::now());
    }
}

/// Shows the window if the UI's backdrop is still pending; a late `present` is a no-op.
fn show_if_pending(app: &AppHandle) {
    if app.state::<AppState>().present_pending.swap(false, Ordering::SeqCst) {
        show_window(app);
    }
}

/// Makes the (hidden) window cover the monitor, borderless.
fn fit_to_monitor(state: &AppState, window: &WebviewWindow, origin: PhysicalPosition<i32>) {
    let Ok(mut last) = state.last_monitor.lock() else {
        return;
    };

    let fullscreen = window.is_fullscreen().unwrap_or(false);
    if *last != Some((origin.x, origin.y)) || !fullscreen {
        let _ = window.set_fullscreen(false);
        let _ = window.set_position(origin);
        let _ = window.set_fullscreen(true);
        *last = Some((origin.x, origin.y));
    }
}

/// Step one of showing: snapshot the screen *before* the overlay exists on it, then ask the UI to
/// load the snapshot. The UI answers with `present`.
fn begin_show(app: &AppHandle) {
    let Some(window) = main_window(app) else {
        return;
    };
    let state = app.state::<AppState>();

    let monitor = window
        .cursor_position()
        .ok()
        .and_then(|cursor| window.monitor_from_point(cursor.x, cursor.y).ok().flatten())
        .or_else(|| window.primary_monitor().ok().flatten());

    let mut snapshot = None;
    if let Some(monitor) = &monitor {
        let origin = *monitor.position();
        let size = *monitor.size();
        snapshot = capture::snapshot_rect(
            origin.x,
            origin.y,
            size.width as i32,
            size.height as i32,
            SNAPSHOT_WIDTH,
        );
        fit_to_monitor(&state, &window, origin);
    }

    state.present_pending.store(true, Ordering::SeqCst);
    let _ = app.emit("launcher-prepare", Prepare { snapshot });

    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(PRESENT_TIMEOUT);
        show_if_pending(&app);
    });
}

fn toggle(app: &AppHandle) {
    let Some(window) = main_window(app) else {
        return;
    };

    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        begin_show(app);
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "Show Opaline", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let mut tray = TrayIconBuilder::new()
        .tooltip("Opaline")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => begin_show(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
}

// ---------- commands ----------

/// The UI has loaded its listeners; show the first overlay now if this launch should open it.
#[tauri::command]
fn ready(app: AppHandle, state: State<AppState>) {
    if state.show_on_ready.swap(false, Ordering::SeqCst) {
        begin_show(&app);
    }
}

#[tauri::command]
fn present(app: AppHandle) {
    show_if_pending(&app);
}

#[tauri::command]
fn list_items(app: AppHandle) -> Vec<desktop::Item> {
    desktop::scan(&app)
}

#[tauri::command]
async fn get_icon(path: String) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || icons::icon_data_url(&path))
        .await
        .ok()
        .flatten()
}

#[tauri::command]
fn launch(app: AppHandle, path: String) {
    hide(&app);
    if let Err(error) = app.opener().open_path(path.as_str(), None::<&str>) {
        eprintln!("couldn't open {path}: {error}");
    }
}

/// Opens the folder containing the item with the item selected.
#[tauri::command]
fn reveal(app: AppHandle, path: String) {
    hide(&app);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = std::process::Command::new("explorer")
            .raw_arg(format!("/select,\"{path}\""))
            .spawn();
    }

    #[cfg(not(windows))]
    if let Some(parent) = std::path::Path::new(&path).parent() {
        let _ = std::process::Command::new("xdg-open").arg(parent).spawn();
    }
}

#[tauri::command]
async fn rail_items() -> Vec<taskbar::RailItem> {
    tauri::async_runtime::spawn_blocking(taskbar::rail_items)
        .await
        .unwrap_or_default()
}

#[tauri::command]
async fn thumbnail(hwnd: i64) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || capture::window_thumbnail(hwnd, THUMBNAIL_WIDTH))
        .await
        .ok()
        .flatten()
}

#[tauri::command]
fn focus_window(app: AppHandle, hwnd: i64) {
    hide(&app);
    taskbar::focus_window(hwnd);
}

#[tauri::command]
fn hide_launcher(app: AppHandle) {
    hide(&app);
}

#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn status(state: State<AppState>) -> Status {
    let combo = state
        .hotkey
        .lock()
        .map(|combo| combo.clone())
        .unwrap_or_else(|_| DEFAULT_HOTKEY.to_string());

    Status {
        hotkey_ok: state.hotkey_ok.load(Ordering::Relaxed),
        hotkey: hotkey_label(&combo),
        version: env!("CARGO_PKG_VERSION"),
        codename: CODENAME,
        pinned: state.pinned,
    }
}

/// Rebinds the global hotkey. On failure the previous binding is restored and the error returned.
#[tauri::command]
fn set_hotkey(app: AppHandle, state: State<AppState>, combo: String) -> Result<String, String> {
    let combo = combo.trim().to_lowercase();
    let next: Shortcut = combo.parse().map_err(|error| format!("{error}"))?;

    let mut current = state.hotkey.lock().map_err(|error| error.to_string())?;
    let previous = current.parse::<Shortcut>().ok();

    if let Some(previous) = previous {
        let _ = app.global_shortcut().unregister(previous);
    }

    match app.global_shortcut().register(next) {
        Ok(()) => {
            *current = combo.clone();
            state.hotkey_ok.store(true, Ordering::Relaxed);
            save_hotkey(&app, &combo);
            Ok(hotkey_label(&combo))
        }
        Err(error) => {
            if let Some(previous) = previous {
                let _ = app.global_shortcut().register(previous);
            }
            Err(format!("{} is not available: {error}", hotkey_label(&combo)))
        }
    }
}

#[tauri::command]
fn set_behavior(state: State<AppState>, close_on_blur: bool) {
    state.close_on_blur.store(close_on_blur, Ordering::Relaxed);
}

#[tauri::command]
fn load_store(app: AppHandle, name: String) -> Option<String> {
    store::load(&app, &name)
}

#[tauri::command]
fn save_store(app: AppHandle, name: String, json: String) -> Result<(), String> {
    store::save(&app, &name, &json)
}

pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let start_hidden = args.iter().any(|arg| arg == "--hidden");
    let pinned = args.iter().any(|arg| arg == "--pin") || std::env::var_os("OPALINE_PIN").is_some();

    tauri::Builder::default()
        // A second launch just opens the running instance's overlay.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            begin_show(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle(app);
                    }
                })
                .build(),
        )
        .manage(AppState {
            pinned,
            hotkey: Mutex::new(DEFAULT_HOTKEY.to_string()),
            hotkey_ok: AtomicBool::new(false),
            close_on_blur: AtomicBool::new(true),
            show_on_ready: AtomicBool::new(!start_hidden),
            present_pending: AtomicBool::new(false),
            last_present: Mutex::new(None),
            last_monitor: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            ready,
            present,
            list_items,
            get_icon,
            launch,
            reveal,
            rail_items,
            thumbnail,
            focus_window,
            hide_launcher,
            quit,
            status,
            set_hotkey,
            set_behavior,
            load_store,
            save_store,
        ])
        .setup(|app| {
            let handle = app.handle();
            let state = handle.state::<AppState>();

            let combo = load_hotkey(handle);
            state
                .hotkey_ok
                .store(register_hotkey(handle, &combo).is_ok(), Ordering::Relaxed);
            if let Ok(mut current) = state.hotkey.lock() {
                *current = combo;
            }

            build_tray(handle)?;
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::Focused(false) => {
                let state = window.state::<AppState>();
                let settling = state
                    .last_present
                    .lock()
                    .ok()
                    .and_then(|last| *last)
                    .is_some_and(|last| last.elapsed() < BLUR_GRACE);

                if state.close_on_blur.load(Ordering::Relaxed) && !state.pinned && !settling {
                    let _ = window.hide();
                }
            }
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running Opaline");
}
