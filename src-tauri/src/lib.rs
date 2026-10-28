mod apps;
mod capture;
mod desktop;
mod icons;
mod idle;
mod start_menu;
mod store;
mod taskbar;
mod usage;
mod workspace;

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
// Acrylic blur hides the extra detail; a smaller frame cuts GDI readback, JPEG work and IPC size.
const SNAPSHOT_WIDTH: u32 = 960;
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
    capture_backdrop: AtomicBool,
    show_on_ready: AtomicBool,
    present_pending: AtomicBool,
    last_present: Mutex<Option<Instant>>,
    show_started: Mutex<Option<(Instant, &'static str)>>,
    last_monitor: Mutex<Option<(i32, i32)>>,
    cached_snapshot: Mutex<Option<CachedSnapshot>>,
    snapshot_refreshing: AtomicBool,
}

#[derive(Clone)]
struct CachedSnapshot {
    bounds: (i32, i32, u32, u32),
    data_url: String,
    desktop_id: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Prepare {
    snapshot: Option<String>,
    reuse_snapshot: bool,
    page: &'static str,
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
    let _ = store::save(
        app,
        "config.json",
        &serde_json::json!({ "hotkey": combo }).to_string(),
    );
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
    idle::dismiss();
    if let Some(window) = main_window(app) {
        let _ = window.hide();
    }
    let _ = app.emit("launcher-hidden", ());
    refresh_snapshot_while_hidden(app);
}

fn capture_current_monitor(app: &AppHandle) -> Option<CachedSnapshot> {
    let window = main_window(app)?;
    let monitor = window
        .cursor_position()
        .ok()
        .and_then(|cursor| window.monitor_from_point(cursor.x, cursor.y).ok().flatten())
        .or_else(|| window.primary_monitor().ok().flatten())?;
    let origin = *monitor.position();
    let size = *monitor.size();
    let data_url = capture::snapshot_rect(
        origin.x,
        origin.y,
        size.width as i32,
        size.height as i32,
        SNAPSHOT_WIDTH,
    )?;
    Some(CachedSnapshot {
        bounds: (origin.x, origin.y, size.width, size.height),
        data_url,
        desktop_id: workspace::current_id(),
    })
}

fn refresh_snapshot_while_hidden(app: &AppHandle) {
    let state = app.state::<AppState>();
    if !state.capture_backdrop.load(Ordering::Relaxed)
        || state.snapshot_refreshing.swap(true, Ordering::SeqCst)
    {
        return;
    }

    let app = app.clone();
    thread::spawn(move || {
        // Give DWM one frame to remove the overlay before capturing the next warm-open backdrop.
        thread::sleep(Duration::from_millis(34));
        let hidden = main_window(&app).is_some_and(|window| !window.is_visible().unwrap_or(true));
        if hidden
            && let Some(snapshot) = capture_current_monitor(&app)
            && main_window(&app).is_some_and(|window| !window.is_visible().unwrap_or(true))
        {
            if let Ok(mut cached) = app.state::<AppState>().cached_snapshot.lock() {
                *cached = Some(snapshot.clone());
            }
            let _ = app.emit("launcher-backdrop-cache", snapshot.data_url);
        }
        app.state::<AppState>()
            .snapshot_refreshing
            .store(false, Ordering::SeqCst);
    });
}

fn show_window(app: &AppHandle) {
    let Some(window) = main_window(app) else {
        return;
    };

    let _ = window.show();
    let _ = window.set_focus();
    let state = app.state::<AppState>();
    if let Ok(mut last) = state.last_present.lock() {
        *last = Some(Instant::now());
    }
    #[cfg(debug_assertions)]
    if let Ok(mut started) = state.show_started.lock()
        && let Some((started, path)) = started.take()
    {
        eprintln!(
            "opaline: {path} request-to-visible took {:?}",
            started.elapsed()
        );
    }
}

/// Shows the window if the UI's backdrop is still pending; a late `present` is a no-op.
fn show_if_pending(app: &AppHandle) {
    if app
        .state::<AppState>()
        .present_pending
        .swap(false, Ordering::SeqCst)
    {
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
    begin_show_page(app, "desktop");
}

fn open_app_list(app: &AppHandle) {
    if let Some(window) = main_window(app)
        && window.is_visible().unwrap_or(false)
    {
        #[cfg(windows)]
        if window
            .hwnd()
            .is_ok_and(|hwnd| workspace::is_current(windows::Win32::Foundation::HWND(hwnd.0)))
        {
            let _ = app.emit("launcher-page", "all-apps");
            let _ = window.set_focus();
            return;
        }
    }
    begin_show_page(app, "all-apps");
}

fn begin_show_page(app: &AppHandle, page: &'static str) {
    let Some(window) = main_window(app) else {
        return;
    };
    let state = app.state::<AppState>();
    #[cfg(windows)]
    if let Ok(hwnd) = window.hwnd()
        && workspace::prepare(windows::Win32::Foundation::HWND(hwnd.0))
    {
        let _ = window.hide();
        if let Ok(mut cached) = state.cached_snapshot.lock() {
            *cached = None;
        }
    }
    let desktop_id = workspace::current_id();
    let capture_backdrop = page != "screen-saver" && state.capture_backdrop.load(Ordering::Relaxed);
    let started = Instant::now();

    let monitor = window
        .cursor_position()
        .ok()
        .and_then(|cursor| window.monitor_from_point(cursor.x, cursor.y).ok().flatten())
        .or_else(|| window.primary_monitor().ok().flatten());

    let mut snapshot = None;
    let mut reuse_snapshot = false;
    let mut path = "transparent";
    if let Some(monitor) = &monitor {
        let origin = *monitor.position();
        let size = *monitor.size();
        if capture_backdrop {
            let bounds = (origin.x, origin.y, size.width, size.height);
            reuse_snapshot = state.cached_snapshot.lock().ok().is_some_and(|cached| {
                cached.as_ref().is_some_and(|cached| {
                    cached.bounds == bounds
                        && desktop_id.is_some()
                        && cached.desktop_id == desktop_id
                })
            });
            if reuse_snapshot {
                path = "cached snapshot";
            } else {
                snapshot = capture::snapshot_rect(
                    origin.x,
                    origin.y,
                    size.width as i32,
                    size.height as i32,
                    SNAPSHOT_WIDTH,
                );
                if let Some(data_url) = &snapshot
                    && let Ok(mut cached) = state.cached_snapshot.lock()
                {
                    *cached = Some(CachedSnapshot {
                        bounds,
                        data_url: data_url.clone(),
                        desktop_id: desktop_id.clone(),
                    });
                }
                path = "snapshot";
            }
        }
        fit_to_monitor(&state, &window, origin);
    }

    if let Ok(mut current) = state.show_started.lock() {
        *current = Some((started, path));
    }

    state.present_pending.store(true, Ordering::SeqCst);
    let _ = app.emit(
        "launcher-prepare",
        Prepare {
            snapshot,
            reuse_snapshot,
            page,
        },
    );

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

    #[cfg(windows)]
    let on_current = window
        .hwnd()
        .map(|hwnd| workspace::is_current(windows::Win32::Foundation::HWND(hwnd.0)))
        .unwrap_or(true);
    #[cfg(not(windows))]
    let on_current = true;
    if window.is_visible().unwrap_or(false) && on_current {
        hide(app);
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
    idle::ready();
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
async fn list_apps() -> Vec<apps::AppEntry> {
    tauri::async_runtime::spawn_blocking(apps::scan)
        .await
        .unwrap_or_default()
}

#[tauri::command]
fn workspace_item(path: String) -> Result<desktop::Item, String> {
    let path = std::path::Path::new(path.trim());
    if !path.is_absolute() {
        return Err("Enter a full file or folder path.".into());
    }
    let metadata =
        std::fs::metadata(path).map_err(|error| format!("Could not read that path: {error}"))?;
    let name = path
        .file_name()
        .unwrap_or(path.as_os_str())
        .to_string_lossy()
        .into_owned();
    Ok(desktop::Item {
        name,
        path: path.to_string_lossy().into_owned(),
        is_folder: metadata.is_dir(),
    })
}

#[tauri::command]
async fn folder_preview(path: String) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let folder = std::path::Path::new(&path);
        if !folder.is_absolute() || !folder.is_dir() {
            return Err("Folder preview needs an existing folder.".into());
        }
        let mut names = std::fs::read_dir(folder)
            .map_err(|error| format!("Could not read this folder: {error}"))?
            .take(128)
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .filter(|name| name != "desktop.ini")
            .collect::<Vec<String>>();
        names.sort_by_key(|name| name.to_lowercase());
        names.truncate(7);
        Ok(names)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn get_icon(path: String) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || icons::icon_data_url(&path))
        .await
        .ok()
        .flatten()
}

#[tauri::command]
async fn get_window_icon(hwnd: i64) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || icons::window_icon_data_url(hwnd))
        .await
        .ok()
        .flatten()
}

#[tauri::command]
fn launch(app: AppHandle, path: String) {
    hide(&app);

    #[cfg(windows)]
    if path.starts_with(r"shell:AppsFolder\") {
        let _ = std::process::Command::new("explorer.exe")
            .arg(&path)
            .spawn();
        return;
    }

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
            Err(format!(
                "{} is not available: {error}",
                hotkey_label(&combo)
            ))
        }
    }
}

#[tauri::command]
fn set_behavior(state: State<AppState>, close_on_blur: bool) {
    state.close_on_blur.store(close_on_blur, Ordering::Relaxed);
}

#[tauri::command]
fn set_backdrop_capture(state: State<AppState>, enabled: bool) {
    state.capture_backdrop.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
fn screen_time(app: AppHandle) -> Result<usage::Report, String> {
    usage::report(&app)
}
#[tauri::command]
fn set_screen_time(app: AppHandle, enabled: bool) -> Result<(), String> {
    usage::set_enabled(&app, enabled)
}
#[tauri::command]
fn clear_screen_time(app: AppHandle) -> Result<(), String> {
    usage::clear(&app)
}
#[tauri::command]
fn start_menu_status() -> start_menu::Status {
    start_menu::status()
}
#[tauri::command]
fn set_start_menu(app: AppHandle, enabled: bool) -> Result<(), String> {
    start_menu::set_enabled(&app, enabled)
}

#[tauri::command]
fn set_screen_saver(enabled: bool, idle_minutes: u64) -> Result<(), String> {
    idle::configure(enabled, idle_minutes)
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
    let mut context = tauri::generate_context!();
    if let Some(test_dir) = store::test_data_dir()
        && let Some(window) = context.config_mut().app.windows.first_mut()
    {
        window.data_directory = Some(test_dir.join("webview"));
    }

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
            capture_backdrop: AtomicBool::new(false),
            show_on_ready: AtomicBool::new(!start_hidden),
            present_pending: AtomicBool::new(false),
            last_present: Mutex::new(None),
            show_started: Mutex::new(None),
            last_monitor: Mutex::new(None),
            cached_snapshot: Mutex::new(None),
            snapshot_refreshing: AtomicBool::new(false),
        })
        .invoke_handler(tauri::generate_handler![
            ready,
            present,
            list_items,
            list_apps,
            workspace_item,
            folder_preview,
            get_icon,
            get_window_icon,
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
            set_backdrop_capture,
            screen_time,
            set_screen_time,
            clear_screen_time,
            start_menu_status,
            set_start_menu,
            set_screen_saver,
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
            usage::start(handle);
            start_menu::start(handle);
            idle::start(handle);
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
                    hide(window.app_handle());
                }
            }
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                hide(window.app_handle());
            }
            _ => {}
        })
        .build(context)
        .expect("error while building Opaline")
        .run(|app, event| {
            if matches!(
                event,
                tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
            ) {
                usage::flush(app);
            }
        });
}
