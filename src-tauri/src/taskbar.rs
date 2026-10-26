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
            Foundation::{CloseHandle, HWND, LPARAM, RECT, TRUE},
            Graphics::Dwm::{DWMWA_CLOAKED, DwmGetWindowAttribute},
            System::{
                Com::{
                    CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, CoCreateInstance,
                    CoInitializeEx, CoUninitialize, IPersistFile, STGM_READ,
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
        core::{BOOL, HSTRING, Interface, PWSTR},
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
            if !app_window {
                if let Ok(owner) = GetWindow(hwnd, GW_OWNER) {
                    if !owner.is_invalid() {
                        return None;
                    }
                }
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
            if SHELL_EXECUTABLES.iter().any(|shell| exe_lower.ends_with(shell)) {
                return None;
            }

            let handle = hwnd.0 as i64;
            let minimized = IsIconic(hwnd).as_bool();

            // Store apps all share ApplicationFrameHost.exe; give each window its own entry.
            let shared_host = exe_lower.ends_with("applicationframehost.exe");
            let (key, name) = if shared_host {
                (format!("{exe_lower}|{handle}"), title.clone())
            } else {
                (exe_lower, display_name(&exe))
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
            let _ = EnumWindows(Some(collect), LPARAM(&mut windows as *mut Vec<RawWindow> as isize));
        }
        windows
    }

    unsafe fn resolve_link(path: &Path) -> Option<String> {
        unsafe {
            let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).ok()?;
            let file: IPersistFile = link.cast().ok()?;
            file.Load(&HSTRING::from(path.as_os_str()), STGM_READ).ok()?;

            let mut buffer = [0u16; 260];
            link.GetPath(&mut buffer, std::ptr::null_mut(), 0).ok()?;
            let length = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
            let target = wide_to_string(&buffer, length);
            (!target.is_empty()).then_some(target)
        }
    }

    /// The shortcuts behind the icons pinned to the taskbar, with their targets resolved so running
    /// windows can be matched to them. Order is alphabetical: the taskbar's own order lives in an
    /// undocumented registry blob.
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

        // COM wants its own apartment, so resolve on a short-lived thread.
        thread::spawn(move || {
            unsafe {
                let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            }
            let pinned = links
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
            let key = pinned
                .target
                .as_deref()
                .unwrap_or(&pinned.link)
                .to_lowercase();

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
}

#[cfg(not(windows))]
mod imp {
    use super::RailItem;

    pub fn rail_items() -> Vec<RailItem> {
        Vec::new()
    }

    pub fn focus_window(_hwnd: i64) {}
}
