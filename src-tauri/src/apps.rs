//! Enumerates Windows' AppsFolder, which merges classic Start-menu programs and packaged apps.
//! The catalogue is read-only and is requested after the overlay's first visible frame.

use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppEntry {
    pub name: String,
    pub path: String,
}

#[cfg(windows)]
mod imp {
    use std::{collections::HashSet, ffi::c_void};

    use windows::Win32::{
        System::Com::{
            COINIT_APARTMENTTHREADED, CoInitializeEx, CoTaskMemFree, CoUninitialize, IBindCtx,
        },
        UI::Shell::{
            BHID_EnumItems, FOLDERID_AppsFolder, IEnumShellItems, IShellItem, KNOWN_FOLDER_FLAG,
            SHGetKnownFolderItem, SIGDN_NORMALDISPLAY, SIGDN_PARENTRELATIVEPARSING,
        },
    };

    use super::AppEntry;

    unsafe fn display_name(
        item: &IShellItem,
        kind: windows::Win32::UI::Shell::SIGDN,
    ) -> Option<String> {
        let value = unsafe { item.GetDisplayName(kind) }.ok()?;
        let text = unsafe { value.to_string() }.ok();
        unsafe { CoTaskMemFree(Some(value.0.cast::<c_void>())) };
        text.filter(|text| !text.trim().is_empty())
    }

    unsafe fn enumerate() -> Vec<AppEntry> {
        if unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) }.is_err() {
            return Vec::new();
        }

        let result = (|| {
            let folder: IShellItem =
                unsafe { SHGetKnownFolderItem(&FOLDERID_AppsFolder, KNOWN_FOLDER_FLAG(0), None) }
                    .ok()?;
            let enumerator: IEnumShellItems =
                unsafe { folder.BindToHandler(None::<&IBindCtx>, &BHID_EnumItems) }.ok()?;

            let mut entries = Vec::new();
            let mut seen = HashSet::new();
            loop {
                let mut slot = [None];
                let mut fetched = 0;
                if unsafe { enumerator.Next(&mut slot, Some(&mut fetched)) }.is_err()
                    || fetched == 0
                {
                    break;
                }
                let Some(item) = slot[0].take() else { continue };
                let Some(name) = (unsafe { display_name(&item, SIGDN_NORMALDISPLAY) }) else {
                    continue;
                };
                if name.starts_with('.') {
                    continue;
                }
                let Some(relative) = (unsafe { display_name(&item, SIGDN_PARENTRELATIVEPARSING) })
                else {
                    continue;
                };
                if !seen.insert(name.to_lowercase()) {
                    continue;
                }
                entries.push(AppEntry {
                    name,
                    path: format!(r"shell:AppsFolder\{relative}"),
                });
            }
            Some(entries)
        })()
        .unwrap_or_default();

        unsafe { CoUninitialize() };
        result
    }

    pub fn scan() -> Vec<AppEntry> {
        let mut entries = std::thread::spawn(|| unsafe { enumerate() })
            .join()
            .unwrap_or_default();
        entries.sort_by_key(|entry| entry.name.to_lowercase());
        entries
    }
}

#[cfg(windows)]
pub use imp::scan;

#[cfg(not(windows))]
pub fn scan() -> Vec<AppEntry> {
    Vec::new()
}
