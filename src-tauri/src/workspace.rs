//! Only move Opaline's own window; the user's windows stay on their Windows desktops.
#[cfg(windows)]
pub fn current_id() -> Option<String> {
    use windows::Win32::{
        System::Com::{
            CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, CoCreateInstance, CoInitializeEx,
            CoUninitialize,
        },
        UI::{
            Shell::{IVirtualDesktopManager, VirtualDesktopManager},
            WindowsAndMessaging::GetForegroundWindow,
        },
    };
    unsafe {
        let initialized = CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_ok();
        let id = (|| {
            let manager: IVirtualDesktopManager =
                CoCreateInstance(&VirtualDesktopManager, None, CLSCTX_INPROC_SERVER).ok()?;
            Some(format!(
                "{:?}",
                manager.GetWindowDesktopId(GetForegroundWindow()).ok()?
            ))
        })();
        if initialized {
            CoUninitialize();
        }
        id
    }
}
#[cfg(not(windows))]
pub fn current_id() -> Option<String> {
    Some("default".into())
}

#[cfg(windows)]
pub fn prepare(hwnd: windows::Win32::Foundation::HWND) -> bool {
    use windows::Win32::{
        System::Com::{
            CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, CoCreateInstance, CoInitializeEx,
            CoUninitialize,
        },
        UI::{
            Shell::{IVirtualDesktopManager, VirtualDesktopManager},
            WindowsAndMessaging::GetForegroundWindow,
        },
    };
    unsafe {
        let initialized = CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_ok();
        let changed = (|| {
            let manager: IVirtualDesktopManager =
                CoCreateInstance(&VirtualDesktopManager, None, CLSCTX_INPROC_SERVER).ok()?;
            if manager
                .IsWindowOnCurrentVirtualDesktop(hwnd)
                .ok()?
                .as_bool()
            {
                return Some(false);
            }
            let target = manager.GetWindowDesktopId(GetForegroundWindow()).ok()?;
            manager.MoveWindowToDesktop(hwnd, &target).ok()?;
            Some(true)
        })()
        .unwrap_or(false);
        if initialized {
            CoUninitialize();
        }
        changed
    }
}

#[cfg(windows)]
pub fn is_current(hwnd: windows::Win32::Foundation::HWND) -> bool {
    use windows::Win32::{
        System::Com::{
            CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, CoCreateInstance, CoInitializeEx,
            CoUninitialize,
        },
        UI::Shell::{IVirtualDesktopManager, VirtualDesktopManager},
    };
    unsafe {
        let initialized = CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_ok();
        let manager: windows::core::Result<IVirtualDesktopManager> =
            CoCreateInstance(&VirtualDesktopManager, None, CLSCTX_INPROC_SERVER);
        let current = manager
            .and_then(|manager| manager.IsWindowOnCurrentVirtualDesktop(hwnd))
            .map(|value| value.as_bool())
            .unwrap_or(true);
        if initialized {
            CoUninitialize();
        }
        current
    }
}
