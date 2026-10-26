//! The rail's data: what the taskbar shows. Running apps come from the top-level window list,
//! filtered with the same rules Alt-Tab uses; pinned apps come from the user's pinned-taskbar folder.

use serde::Serialize;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WindowInfo {
    pub hwnd: i64,
    pub title: String,
    pub minimized: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RailItem {
    pub id: String,
    pub name: String,
    /// What to ask the shell for an icon of: the pinned shortcut, or the running executable.
    pub icon_path: String,
    /// What to open when no window is running.
    pub launch_path: Option<String>,
    pub pinned: bool,
    pub windows: Vec<WindowInfo>,
}

pub fn rail_items() -> Vec<RailItem> {
    imp::rail_items()
}

pub fn focus_window(hwnd: i64) {
    imp::focus_window(hwnd);
}

#[cfg(windows)]
mod imp {
    use std::{
        ffi::c_void,
        mem::size_of,
        path::{Path, PathBuf},
        thread,
    };

    use windows::{
        Win32::{
            Foundation::{CloseHandle, ERROR_SUCCESS, HWND, LPARAM, RECT, TRUE},
            Graphics::Dwm::{DWMWA_CLOAKED, DwmGetWindowAttribute},
            System::{
                Com::{
                    CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, CoCreateInstance,
                    CoInitializeEx, CoUninitialize, IPersistFile, STGM_READ,
                },
                Registry::{
                    HKEY, HKEY_CURRENT_USER, KEY_READ, REG_BINARY, RegCloseKey, RegOpenKeyExW,
                    RegQueryValueExW,
                },
                Threading::{
                    OpenProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
                    QueryFullProcessImageNameW,
                },
            },
            UI::{
                Shell::{IShellLinkW, ShellLink},
                WindowsAndMessaging::{
                    EnumWindows, GW_OWNER, GWL_EXSTYLE, GetClassNameW, GetWindow,
                    GetWindowLongPtrW, GetWindowRect, GetWindowTextLengthW, GetWindowTextW,
                    GetWindowThreadProcessId, IsIconic, IsWindowVisible, SW_RESTORE,
                    SetForegroundWindow, ShowWindow, WS_EX_APPWINDOW, WS_EX_TOOLWINDOW,
                },
            },
        },
        core::{BOOL, HSTRING, Interface, PWSTR, w},
    };

    use super::{RailItem, WindowInfo};

    /// Shell surfaces that own visible windows but are not apps.
    const SHELL_CLASSES: [&str; 6] = [
        "Progman",
        "WorkerW",
        "Shell_TrayWnd",
        "Shell_SecondaryTrayWnd",
        "Windows.UI.Core.CoreWindow",
        "XamlExplorerHostIslandWindow",
    ];

    const SHELL_EXECUTABLES: [&str; 6] = [
        "textinputhost.exe",
        "searchhost.exe",
        "shellexperiencehost.exe",
        "startmenuexperiencehost.exe",
        "lockapp.exe",
        "widgets.exe",
    ];

    struct RawWindow {
        key: String,
        name: String,
        exe: String,
        launchable: bool,
        info: WindowInfo,
    }

    struct Pinned {
        name: String,
        link: String,
        target: Option<String>,
    }

    enum RegistryPin {
        Link(String),
        AppId(String),
    }

    fn wide_to_string(buffer: &[u16], length: usize) -> String {
        String::from_utf16_lossy(&buffer[..length.min(buffer.len())])
    }

    unsafe fn process_image(pid: u32) -> Option<String> {
        unsafe {
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
            let mut buffer = [0u16; 1024];
            let mut length = buffer.len() as u32;
            let queried = QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_WIN32,
                PWSTR(buffer.as_mut_ptr()),
                &mut length,
            )
            .is_ok();
            let _ = CloseHandle(handle);
            queried.then(|| wide_to_string(&buffer, length as usize))
        }
    }

    fn display_name(exe: &str) -> String {
        let stem = Path::new(exe)
            .file_stem()
            .map(|stem| stem.to_string_lossy().into_owned())
            .unwrap_or_else(|| exe.to_string());
        let mut chars = stem.chars();
        match chars.next() {
            Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            None => stem,
        }
    }

    /// Windows shortcuts sometimes resolve an executable to a short/environment-based path while
    /// process enumeration returns an absolute one. Executable file names are stable enough for
    /// rail grouping and prevent a pinned app from appearing again as a separate running entry.
    fn application_key(path: &str) -> String {
        let lower = path.to_lowercase();
        let file = Path::new(&lower)
            .file_name()
            .map(|name| name.to_string_lossy().into_owned());
        match file {
            Some(name) if name.ends_with(".exe") => name,
            _ => lower,
        }
    }

    fn pinned_key(pinned: &Pinned) -> String {
        if let Some(target) = pinned.target.as_deref() {
            return application_key(target);
        }

        // Windows' built-in File Explorer pin is a shell link that often has no filesystem
        // target, even though its running window belongs to explorer.exe.
        let stem = Path::new(&pinned.link)
            .file_stem()
            .map(|name| name.to_string_lossy().to_lowercase());
        if stem
            .as_deref()
            .is_some_and(|name| matches!(name, "file explorer" | "windows explorer" | "explorer"))
        {
            return "explorer.exe".into();
        }

        application_key(&pinned.link)
    }

    unsafe fn inspect(hwnd: HWND) -> Option<RawWindow> {
        unsafe {
            if !IsWindowVisible(hwnd).as_bool() {
                return None;
            }

            let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
            let app_window = style & WS_EX_APPWINDOW.0 != 0;
            if style & WS_EX_TOOLWINDOW.0 != 0 && !app_window {
                return None;
            }
            if !app_window
                && let Ok(owner) = GetWindow(hwnd, GW_OWNER)
                && !owner.is_invalid()
            {
                return None;
            }

            // Windows on other virtual desktops and suspended Store apps are "cloaked".
            let mut cloaked = 0u32;
            let _ = DwmGetWindowAttribute(
                hwnd,
                DWMWA_CLOAKED,
                &mut cloaked as *mut u32 as *mut c_void,
                size_of::<u32>() as u32,
            );
            if cloaked != 0 {
                return None;
            }

            let mut rect = RECT::default();
            GetWindowRect(hwnd, &mut rect).ok()?;
            if rect.right - rect.left <= 0 || rect.bottom - rect.top <= 0 {
                return None;
            }

            let title_length = GetWindowTextLengthW(hwnd);
            if title_length <= 0 {
                return None;
            }
            let mut title = vec![0u16; title_length as usize + 1];
            let copied = GetWindowTextW(hwnd, &mut title);
            let title = wide_to_string(&title, copied.max(0) as usize);

            let mut class = [0u16; 256];
            let class_length = GetClassNameW(hwnd, &mut class);
            let class = wide_to_string(&class, class_length.max(0) as usize);
            if SHELL_CLASSES.contains(&class.as_str()) {
                return None;
            }

            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid == std::process::id() {
                return None;
            }

            let exe = process_image(pid)?;
            let exe_lower = exe.to_lowercase();
            if SHELL_EXECUTABLES
                .iter()
                .any(|shell| exe_lower.ends_with(shell))
            {
                return None;
            }

            let handle = hwnd.0 as i64;
            let minimized = IsIconic(hwnd).as_bool();

            // Store apps all share ApplicationFrameHost.exe; give each window its own entry.
            let shared_host = exe_lower.ends_with("applicationframehost.exe");
            let (key, name) = if shared_host {
                (format!("{exe_lower}|{handle}"), title.clone())
            } else {
                (application_key(&exe), display_name(&exe))
            };

            Some(RawWindow {
                key,
                name,
                exe,
                launchable: !shared_host,
                info: WindowInfo {
                    hwnd: handle,
                    title,
                    minimized,
                },
            })
        }
    }

    unsafe extern "system" fn collect(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let windows = unsafe { &mut *(lparam.0 as *mut Vec<RawWindow>) };
        if let Some(window) = unsafe { inspect(hwnd) } {
            windows.push(window);
        }
        TRUE
    }

    /// Top-level windows in z-order, most recent first.
    fn running_windows() -> Vec<RawWindow> {
        let mut windows: Vec<RawWindow> = Vec::new();
        unsafe {
            let _ = EnumWindows(
                Some(collect),
                LPARAM(&mut windows as *mut Vec<RawWindow> as isize),
            );
        }
        windows
    }

    unsafe fn resolve_link(path: &Path) -> Option<String> {
        unsafe {
            let link: IShellLinkW =
                CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).ok()?;
            let file: IPersistFile = link.cast().ok()?;
            file.Load(&HSTRING::from(path.as_os_str()), STGM_READ)
                .ok()?;

            let mut buffer = [0u16; 260];
            link.GetPath(&mut buffer, std::ptr::null_mut(), 0).ok()?;
            let length = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
            let target = wide_to_string(&buffer, length);
            (!target.is_empty()).then_some(target)
        }
    }

    fn unicode_strings(bytes: &[u8]) -> Vec<String> {
        let mut strings = Vec::new();
        let mut current = String::new();

        for pair in bytes.chunks_exact(2) {
            let unit = u16::from_le_bytes([pair[0], pair[1]]);
            let printable = char::from_u32(unit as u32).filter(|character| !character.is_control());
            if let Some(character) = printable {
                current.push(character);
            } else {
                if current.len() >= 3 {
                    strings.push(std::mem::take(&mut current));
                }
                current.clear();
            }
        }
        if current.len() >= 3 {
            strings.push(current);
        }
        strings
    }

    fn is_app_id(value: &str) -> bool {
        value.contains('!')
            && value.len() <= 256
            && !value
                .chars()
                .any(|character| ['\\', '/', ':'].contains(&character))
            && value
                .chars()
                .all(|character| character.is_ascii_alphanumeric() || "._-!".contains(character))
    }

    fn taskband_value() -> Option<Vec<u8>> {
        unsafe {
            let mut key = HKEY::default();
            if RegOpenKeyExW(
                HKEY_CURRENT_USER,
                w!(r"Software\Microsoft\Windows\CurrentVersion\Explorer\Taskband"),
                None,
                KEY_READ,
                &mut key,
            ) != ERROR_SUCCESS
            {
                return None;
            }

            let mut kind = Default::default();
            let mut length = 0u32;
            let measured = RegQueryValueExW(
                key,
                w!("FavoritesResolve"),
                None,
                Some(&mut kind),
                None,
                Some(&mut length),
            ) == ERROR_SUCCESS;
            if !measured || kind != REG_BINARY || length == 0 {
                let _ = RegCloseKey(key);
                return None;
            }

            let mut bytes = vec![0u8; length as usize];
            let read = RegQueryValueExW(
                key,
                w!("FavoritesResolve"),
                None,
                Some(&mut kind),
                Some(bytes.as_mut_ptr()),
                Some(&mut length),
            ) == ERROR_SUCCESS;
            let _ = RegCloseKey(key);
            read.then(|| {
                bytes.truncate(length as usize);
                bytes
            })
        }
    }

    /// Windows 11 keeps taskbar order and Store-app pins in an undocumented Taskband value.
    /// We only consume the self-describing UTF-16 link names and AppUserModelIDs inside it; an
    /// unfamiliar future blob format therefore degrades to the pinned-shortcut folder.
    fn taskband_pins() -> Vec<RegistryPin> {
        let Some(value) = taskband_value() else {
            return Vec::new();
        };

        let mut seen = std::collections::HashSet::new();
        unicode_strings(&value)
            .into_iter()
            .filter_map(|value| {
                let lower = value.to_lowercase();
                if lower.ends_with(".lnk") {
                    let name = Path::new(&value)
                        .file_name()?
                        .to_string_lossy()
                        .into_owned();
                    seen.insert(format!("link:{}", name.to_lowercase()))
                        .then_some(RegistryPin::Link(name))
                } else if is_app_id(&value) {
                    seen.insert(format!("app:{lower}"))
                        .then_some(RegistryPin::AppId(value))
                } else {
                    None
                }
            })
            .collect()
    }

    fn app_id_name(app_id: &str) -> String {
        let identifier = app_id
            .split('!')
            .next()
            .unwrap_or(app_id)
            .split('_')
            .next()
            .unwrap_or(app_id)
            .rsplit('.')
            .next()
            .unwrap_or(app_id);
        let mut name = String::new();
        for character in identifier.chars() {
            if character.is_uppercase() && !name.is_empty() {
                name.push(' ');
            }
            name.push(character);
        }
        name
    }

    /// The shortcuts and Store apps pinned to the taskbar, ordered by the Taskband registry when it
    /// can be read. Folder-only pins follow alphabetically as a compatibility fallback.
    fn pinned_items() -> Vec<Pinned> {
        let Some(appdata) = std::env::var_os("APPDATA") else {
            return Vec::new();
        };
        let folder = PathBuf::from(appdata)
            .join(r"Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar");

        let mut links: Vec<PathBuf> = std::fs::read_dir(&folder)
            .map(|entries| {
                entries
                    .flatten()
                    .map(|entry| entry.path())
                    .filter(|path| {
                        path.extension()
                            .is_some_and(|ext| ext.eq_ignore_ascii_case("lnk"))
                    })
                    .collect()
            })
            .unwrap_or_default();
        links.sort();
        let registry = taskband_pins();

        // COM wants its own apartment, so resolve on a short-lived thread.
        thread::spawn(move || {
            unsafe {
                let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            }
            let mut shortcuts = links
                .iter()
                .map(|link| Pinned {
                    name: link
                        .file_stem()
                        .map(|stem| stem.to_string_lossy().into_owned())
                        .unwrap_or_default(),
                    link: link.to_string_lossy().into_owned(),
                    target: unsafe { resolve_link(link) },
                })
                .collect::<Vec<_>>();
            let mut pinned = Vec::new();
            for entry in registry {
                match entry {
                    RegistryPin::Link(name) => {
                        let name = name.to_lowercase();
                        if let Some(index) = shortcuts.iter().position(|shortcut| {
                            Path::new(&shortcut.link)
                                .file_name()
                                .is_some_and(|file| file.to_string_lossy().to_lowercase() == name)
                        }) {
                            pinned.push(shortcuts.remove(index));
                        }
                    }
                    RegistryPin::AppId(app_id) => {
                        let shell_path = format!(r"shell:AppsFolder\{app_id}");
                        pinned.push(Pinned {
                            name: app_id_name(&app_id),
                            link: shell_path.clone(),
                            target: Some(shell_path),
                        });
                    }
                }
            }
            pinned.extend(shortcuts);
            unsafe { CoUninitialize() };
            pinned
        })
        .join()
        .unwrap_or_default()
    }

    pub fn rail_items() -> Vec<RailItem> {
        let mut windows = running_windows();
        let mut items = Vec::new();

        for pinned in pinned_items() {
            let key = pinned_key(&pinned);

            let (matched, rest): (Vec<RawWindow>, Vec<RawWindow>) =
                windows.into_iter().partition(|window| window.key == key);
            windows = rest;

            items.push(RailItem {
                id: key,
                name: pinned.name,
                icon_path: pinned.link.clone(),
                launch_path: Some(pinned.link),
                pinned: true,
                windows: matched.into_iter().map(|window| window.info).collect(),
            });
        }

        // Whatever is running but not pinned follows, grouped by executable.
        let mut running: Vec<RailItem> = Vec::new();
        for window in windows {
            match running.iter_mut().find(|item| item.id == window.key) {
                Some(item) => item.windows.push(window.info),
                None => running.push(RailItem {
                    id: window.key,
                    name: window.name,
                    icon_path: window.exe.clone(),
                    launch_path: window.launchable.then_some(window.exe),
                    pinned: false,
                    windows: vec![window.info],
                }),
            }
        }
        items.extend(running);
        items
    }

    pub fn focus_window(hwnd: i64) {
        unsafe {
            let hwnd = HWND(hwnd as _);
            if IsIconic(hwnd).as_bool() {
                let _ = ShowWindow(hwnd, SW_RESTORE);
            }
            let _ = SetForegroundWindow(hwnd);
        }
    }

    #[cfg(test)]
    mod tests {
        use super::{Pinned, app_id_name, application_key, is_app_id, pinned_key, unicode_strings};

        #[test]
        fn finds_utf16_strings_in_taskband_data() {
            let mut bytes = vec![0, 0, 1, 0];
            for unit in r"File Explorer.lnk".encode_utf16() {
                bytes.extend(unit.to_le_bytes());
            }
            bytes.extend([0, 0]);
            assert!(
                unicode_strings(&bytes)
                    .iter()
                    .any(|value| value == "File Explorer.lnk")
            );
        }

        #[test]
        fn recognizes_and_names_store_app_ids() {
            let app_id = "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App";
            assert!(is_app_id(app_id));
            assert_eq!(app_id_name(app_id), "Windows Calculator");
            assert!(!is_app_id(r"C:\Windows\not-an-app!id"));
        }

        #[test]
        fn executable_keys_match_short_and_absolute_paths() {
            assert_eq!(application_key(r"C:\Windows\explorer.exe"), "explorer.exe");
            assert_eq!(application_key(r"%windir%\explorer.exe"), "explorer.exe");
            assert_eq!(
                application_key(r"shell:AppsFolder\Package!App"),
                r"shell:appsfolder\package!app"
            );
        }

        #[test]
        fn file_explorer_shell_link_matches_the_running_process() {
            let pinned = Pinned {
                name: "File Explorer".into(),
                link: r"C:\Pinned\File Explorer.lnk".into(),
                target: None,
            };
            assert_eq!(pinned_key(&pinned), "explorer.exe");
        }
    }
}

#[cfg(not(windows))]
mod imp {
    use super::RailItem;

    pub fn rail_items() -> Vec<RailItem> {
        Vec::new()
    }

    pub fn focus_window(_hwnd: i64) {}
}
