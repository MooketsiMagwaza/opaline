mod apps;
mod capture;
mod desktop;
mod icons;
mod identity;
mod idle;
mod media;
mod picker;
mod start_menu;
mod startup_log;
mod store;
mod taskbar;
mod usage;
mod workspace;

use std::{
    sync::{
        Mutex,
        atomic::{AtomicBool, AtomicU64, Ordering},
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
const CODENAME: &str = "Crown";
// Acrylic blur hides the extra detail; a smaller frame cuts GDI readback, JPEG work and IPC size.
const SNAPSHOT_WIDTH: u32 = 960;
/// How long Rust waits for the UI to say the backdrop is ready before showing the window anyway.
const PRESENT_TIMEOUT: Duration = Duration::from_millis(900);
/// How long the overlay must stay hidden before WebView2 is asked to trim its memory. Short idle gaps keep the fast warm open.
const MEMORY_TRIM_DELAY: Duration = Duration::from_secs(20);
/// Focus changes this soon after showing are the window settling, not the user clicking away.
const BLUR_GRACE: Duration = Duration::from_millis(500);

struct AppState {
    /// Development flag: never hide on focus loss.
    pinned: bool,
    hotkey: Mutex<String>,
    hotkey_ok: AtomicBool,
    close_on_blur: AtomicBool,
    picker_open: AtomicBool,
    capture_backdrop: AtomicBool,
    show_on_ready: AtomicBool,
    present_pending: AtomicBool,
    last_present: Mutex<Option<Instant>>,
    show_started: Mutex<Option<(Instant, &'static str)>>,
    last_monitor: Mutex<Option<(i32, i32)>>,
    cached_snapshot: Mutex<Option<CachedSnapshot>>,
    snapshot_refreshing: AtomicBool,
    /// Whether WebView2 is currently asked to keep its memory low (see `schedule_memory_trim`).
    memory_trimmed: AtomicBool,
    /// Bumped whenever the overlay is shown or hidden, so a trim scheduled for an earlier idle period does nothing.
    memory_generation: AtomicU64,
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
    schedule_memory_trim(app);
    let _ = app.emit("launcher-hidden", ());
    refresh_snapshot_while_hidden(app);
}

/// Once the overlay has stayed hidden for `MEMORY_TRIM_DELAY`, asks WebView2 to keep its memory low. Opaline sits resident
/// all day and a hidden Chromium otherwise holds its full working set (about 430 MB across its processes, about 145 MB trimmed).
/// Doing it straight after every hide made the next open about 90 ms slower, hence the delay and `restore_memory_target`.
fn schedule_memory_trim(app: &AppHandle) {
    let state = app.state::<AppState>();
    let generation = state.memory_generation.fetch_add(1, Ordering::SeqCst) + 1;
    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(MEMORY_TRIM_DELAY);
        let state = app.state::<AppState>();
        let still_hidden =
            main_window(&app).is_some_and(|window| !window.is_visible().unwrap_or(true));
        if still_hidden && state.memory_generation.load(Ordering::SeqCst) == generation {
            state.memory_trimmed.store(true, Ordering::SeqCst);
            set_webview_memory_target(&app, true);
        }
    });
}

/// First thing a show does: cancels a pending trim and, if memory was trimmed, lifts it while the snapshot and the UI
/// get ready, so the cost is hidden behind work that has to happen anyway.
fn restore_memory_target(app: &AppHandle) {
    let state = app.state::<AppState>();
    state.memory_generation.fetch_add(1, Ordering::SeqCst);
    if state.memory_trimmed.swap(false, Ordering::SeqCst) {
        set_webview_memory_target(app, false);
    }
}

/// Asks WebView2 for a low or normal memory target. A runtime without the API (or a failed call) leaves memory as it was.
#[cfg(windows)]
fn set_webview_memory_target(app: &AppHandle, low: bool) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
        ICoreWebView2_19,
    };
    use windows::core::Interface;

    let Some(window) = main_window(app) else {
        return;
    };
    let level = if low {
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
    } else {
        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
    };
    let _ = window.with_webview(move |webview| {
        // SAFETY: the controller is alive for the duration of the closure, which runs on the UI thread.
        let result = unsafe {
            webview
                .controller()
                .CoreWebView2()
                .and_then(|core| core.cast::<ICoreWebView2_19>())
                .and_then(|core| core.SetMemoryUsageTargetLevel(level))
        };
        if let Err(error) = result {
            eprintln!("opaline: WebView2 memory target not changed: {error}");
        }
    });
}

#[cfg(not(windows))]
fn set_webview_memory_target(_app: &AppHandle, _low: bool) {}

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
    restore_memory_target(app);
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

/// Keeps trying to create the tray icon for about two minutes, on the UI thread, then gives up and says so.
fn retry_tray(app: AppHandle) {
    thread::spawn(move || {
        for attempt in 1..=60 {
            thread::sleep(Duration::from_secs(2));
            let (sender, receiver) = std::sync::mpsc::channel();
            let handle = app.clone();
            if app
                .run_on_main_thread(move || {
                    let _ = sender.send(build_tray(&handle));
                })
                .is_err()
            {
                return;
            }
            match receiver.recv_timeout(Duration::from_secs(5)) {
                Ok(Ok(())) => {
                    startup_log::write(&format!("tray ready after {attempt} retries"));
                    return;
                }
                Ok(Err(error)) => startup_log::write(&format!("tray retry {attempt}: {error}")),
                Err(_) => {}
            }
        }
        startup_log::write("tray never became available; the hotkey still opens Opaline");
    });
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
    } else {
        // A login start never shows the overlay, so it would otherwise keep a full working set until the first hide.
        schedule_memory_trim(&app);
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
async fn pick_workspace_item(
    app: AppHandle,
    kind: String,
) -> Result<Option<desktop::Item>, String> {
    if kind != "folder" && kind != "file" {
        return Err("Choose a folder or file.".into());
    }
    let owner = main_window(&app)
        .and_then(|window| window.hwnd().ok())
        .map(|hwnd| hwnd.0 as isize)
        .unwrap_or_default();
    if app
        .state::<AppState>()
        .picker_open
        .swap(true, Ordering::AcqRel)
    {
        return Err("Finish the open picker first.".into());
    }
    let chosen = tauri::async_runtime::spawn_blocking(move || picker::choose(&kind, owner)).await;
    app.state::<AppState>()
        .picker_open
        .store(false, Ordering::Relaxed);
    let path = chosen.map_err(|error| error.to_string())??;
    path.map(workspace_item).transpose()
}

#[tauri::command]
async fn folder_preview(path: String) -> Result<Vec<desktop::Item>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let folder = std::path::Path::new(&path);
        if !folder.is_absolute() || !folder.is_dir() {
            return Err("Folder preview needs an existing folder.".into());
        }
        let mut entries = std::fs::read_dir(folder)
            .map_err(|error| format!("Could not read this folder: {error}"))?
            .take(128)
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.file_name().to_string_lossy() != "desktop.ini")
            .collect::<Vec<_>>();
        entries.sort_by_key(|entry| entry.file_name().to_string_lossy().to_lowercase());
        entries.truncate(7);
        Ok(entries
            .into_iter()
            .map(|entry| desktop::Item {
                name: entry.file_name().to_string_lossy().into_owned(),
                path: entry.path().to_string_lossy().into_owned(),
                is_folder: entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false),
            })
            .collect())
    })
    .await
    .map_err(|error| error.to_string())?
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
    startup_log::install_panic_hook();
    let args: Vec<String> = std::env::args().collect();
    startup_log::write(&format!("start v{} {args:?}", env!("CARGO_PKG_VERSION")));
    let start_hidden = args.iter().any(|arg| arg == "--hidden");
    let pinned = args.iter().any(|arg| arg == "--pin") || std::env::var_os("OPALINE_PIN").is_some();
    let mut context = tauri::generate_context!();
    if let Some(test_dir) = store::test_data_dir()
        && let Some(window) = context.config_mut().app.windows.first_mut()
    {
        window.data_directory = Some(test_dir.join("webview"));
    }

    tauri::Builder::default()
        // Icons and window previews are served as plain images instead of base64 text (see media.rs).
        .register_asynchronous_uri_scheme_protocol(media::SCHEME, |_context, request, responder| {
            let path = request.uri().path().to_string();
            tauri::async_runtime::spawn_blocking(move || responder.respond(media::respond(&path)));
        })
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
            picker_open: AtomicBool::new(false),
            capture_backdrop: AtomicBool::new(false),
            show_on_ready: AtomicBool::new(!start_hidden),
            present_pending: AtomicBool::new(false),
            last_present: Mutex::new(None),
            show_started: Mutex::new(None),
            last_monitor: Mutex::new(None),
            cached_snapshot: Mutex::new(None),
            snapshot_refreshing: AtomicBool::new(false),
            memory_trimmed: AtomicBool::new(false),
            memory_generation: AtomicU64::new(0),
        })
        .invoke_handler(tauri::generate_handler![
            ready,
            present,
            list_items,
            list_apps,
            workspace_item,
            pick_workspace_item,
            folder_preview,
            launch,
            reveal,
            rail_items,
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

            // A login start can beat Explorer's taskbar, so a tray icon that cannot be added yet is retried instead of ending the app.
            if let Err(error) = build_tray(handle) {
                startup_log::write(&format!("tray not ready: {error}; retrying"));
                retry_tray(handle.clone());
            }
            usage::start(handle);
            start_menu::start(handle);
            idle::start(handle);
            startup_log::write(&format!(
                "ready, hotkey registered: {}",
                state.hotkey_ok.load(Ordering::Relaxed)
            ));
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

                if state.close_on_blur.load(Ordering::Relaxed)
                    && !state.picker_open.load(Ordering::Relaxed)
                    && !state.pinned
                    && !settling
                {
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
