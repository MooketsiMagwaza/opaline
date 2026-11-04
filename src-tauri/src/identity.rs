//! Who an executable is: a stable key, a human name and an icon source. Screen time and the taskbar share it so
//! "WhatsApp.Root" in a protected `WindowsApps` folder is shown as the Start-menu name "WhatsApp" with its real icon,
//! and one app is one entry across package updates.

use std::path::Path;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Identity {
    /// Stable across updates: `package:<family>` for packaged apps, the lower-case executable path otherwise.
    pub key: String,
    pub name: String,
    /// What to ask the shell for an icon of. A packaged app's executable is unreadable, so it uses its AppsFolder entry.
    pub icon_path: String,
}

/// Store apps are shown by `ApplicationFrameHost.exe`; the app itself lives in a child window.
pub fn is_frame_host(exe: &str) -> bool {
    exe.to_lowercase().ends_with("applicationframehost.exe")
}

/// `…\WindowsApps\5319275A.WhatsAppDesktop_2.2641.101.0_x64__cv1g1gvanyjgm\app.exe` belongs to the package family
/// `5319275a.whatsappdesktop_cv1g1gvanyjgm`, which does not change when the version in the folder name does.
pub fn package_family(exe: &str) -> Option<String> {
    let lower = exe.to_lowercase().replace('/', "\\");
    let mut parts = lower.split('\\');
    parts.find(|part| *part == "windowsapps")?;
    let folder = parts.next()?;
    // <name>_<version>_<architecture>_<resource id>_<publisher id>; the resource id is usually empty.
    let fields: Vec<&str> = folder.split('_').collect();
    if fields.len() < 5 || fields[0].is_empty() || fields[fields.len() - 1].is_empty() {
        return None;
    }
    Some(format!("{}_{}", fields[0], fields[fields.len() - 1]))
}

/// The family an AppsFolder entry such as `shell:AppsFolder\Claude_pzs8sxrjxfjjc!Claude` belongs to.
pub fn family_of_app_id(app_path: &str) -> Option<String> {
    let id = app_path.rsplit('\\').next()?;
    let (family, _) = id.split_once('!')?;
    (!family.is_empty()).then(|| family.to_lowercase())
}

/// A readable name from a file name alone, for when nothing better is known.
pub fn name_from_file(exe: &str) -> String {
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

pub fn key_for(exe: &str) -> String {
    match package_family(exe) {
        Some(family) => format!("package:{family}"),
        None => exe.to_lowercase(),
    }
}

pub use imp::resolve;

#[cfg(windows)]
mod imp {
    use std::{
        collections::BTreeMap,
        sync::Mutex,
        time::{Duration, Instant},
    };

    use windows::{
        Win32::Storage::FileSystem::{
            GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW,
        },
        core::{HSTRING, PCWSTR},
    };

    use super::{Identity, family_of_app_id, key_for, name_from_file, package_family};
    use crate::apps::{self, AppEntry};

    /// A guess made while the Start-menu catalogue lacked the app is retried later; a settled answer is kept.
    const RETRY_AFTER: Duration = Duration::from_secs(600);

    struct Cached {
        identity: Identity,
        retry_at: Option<Instant>,
    }

    static CACHE: Mutex<BTreeMap<String, Cached>> = Mutex::new(BTreeMap::new());
    static CATALOGUE: Mutex<Option<(Instant, Vec<AppEntry>)>> = Mutex::new(None);

    /// The Start-menu entry for a package family. The catalogue is scanned once and again only after it has gone stale.
    fn start_menu_entry(family: &str) -> Option<AppEntry> {
        let known = CATALOGUE.lock().ok().and_then(|catalogue| {
            catalogue
                .as_ref()
                .filter(|(at, _)| at.elapsed() < RETRY_AFTER)
                .map(|(_, entries)| entries.clone())
        });
        let entries = known.unwrap_or_else(|| {
            let scanned = apps::scan();
            if let Ok(mut catalogue) = CATALOGUE.lock() {
                *catalogue = Some((Instant::now(), scanned.clone()));
            }
            scanned
        });
        entries
            .into_iter()
            .find(|entry| family_of_app_id(&entry.path).as_deref() == Some(family))
    }

    unsafe fn version_text(exe: &str, field: &str) -> Option<String> {
        unsafe {
            let path = HSTRING::from(exe);
            let size = GetFileVersionInfoSizeW(&path, None);
            if size == 0 {
                return None;
            }
            let mut block = vec![0u8; size as usize];
            GetFileVersionInfoW(&path, None, size, block.as_mut_ptr().cast()).ok()?;

            let mut translations: *mut core::ffi::c_void = std::ptr::null_mut();
            let mut length = 0u32;
            if !VerQueryValueW(
                block.as_ptr().cast(),
                windows::core::w!("\\VarFileInfo\\Translation"),
                &mut translations,
                &mut length,
            )
            .as_bool()
                || length < 4
            {
                return None;
            }
            let pairs =
                std::slice::from_raw_parts(translations as *const u16, (length / 2) as usize);
            for pair in pairs.chunks_exact(2) {
                let query = HSTRING::from(format!(
                    "\\StringFileInfo\\{:04x}{:04x}\\{field}",
                    pair[0], pair[1]
                ));
                let mut text: *mut core::ffi::c_void = std::ptr::null_mut();
                let mut text_length = 0u32;
                if VerQueryValueW(
                    block.as_ptr().cast(),
                    PCWSTR(query.as_ptr()),
                    &mut text,
                    &mut text_length,
                )
                .as_bool()
                    && text_length > 1
                {
                    let chars =
                        std::slice::from_raw_parts(text as *const u16, text_length as usize);
                    let value = String::from_utf16_lossy(chars)
                        .trim_end_matches('\0')
                        .trim()
                        .to_string();
                    if !value.is_empty() {
                        return Some(value);
                    }
                }
            }
            None
        }
    }

    /// The name the publisher gave the file, which is usually the one people know the app by.
    fn described_name(exe: &str) -> Option<String> {
        ["FileDescription", "ProductName"]
            .into_iter()
            .find_map(|field| unsafe { version_text(exe, field) })
    }

    fn lookup(exe: &str) -> (Identity, bool) {
        let key = key_for(exe);
        let Some(family) = package_family(exe) else {
            let name = described_name(exe).unwrap_or_else(|| name_from_file(exe));
            return (
                Identity {
                    key,
                    name,
                    icon_path: exe.to_string(),
                },
                true,
            );
        };
        if let Some(entry) = start_menu_entry(&family) {
            return (
                Identity {
                    key,
                    name: entry.name,
                    icon_path: entry.path,
                },
                true,
            );
        }
        // Not in the catalogue we hold: it may be newly installed, so look again later.
        let name = described_name(exe).unwrap_or_else(|| name_from_file(exe));
        (
            Identity {
                key,
                name,
                icon_path: exe.to_string(),
            },
            false,
        )
    }

    pub fn resolve(exe: &str) -> Identity {
        let lower = exe.to_lowercase();
        if let Ok(cache) = CACHE.lock()
            && let Some(hit) = cache.get(&lower)
            && hit.retry_at.is_none_or(|at| Instant::now() < at)
        {
            return hit.identity.clone();
        }
        let (identity, settled) = lookup(exe);
        if let Ok(mut cache) = CACHE.lock() {
            cache.insert(
                lower,
                Cached {
                    identity: identity.clone(),
                    retry_at: (!settled).then(|| Instant::now() + RETRY_AFTER),
                },
            );
        }
        identity
    }
}

#[cfg(not(windows))]
mod imp {
    use super::{Identity, key_for, name_from_file};

    pub fn resolve(exe: &str) -> Identity {
        Identity {
            key: key_for(exe),
            name: name_from_file(exe),
            icon_path: exe.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const WHATSAPP: &str = r"C:\Program Files\WindowsApps\5319275A.WhatsAppDesktop_2.2641.101.0_x64__cv1g1gvanyjgm\WhatsApp.Root.exe";

    #[test]
    fn a_package_keeps_one_identity_across_versions() {
        let older = WHATSAPP.replace("2.2641.101.0", "2.2640.100.0");
        assert_eq!(
            package_family(WHATSAPP).as_deref(),
            Some("5319275a.whatsappdesktop_cv1g1gvanyjgm")
        );
        assert_eq!(key_for(WHATSAPP), key_for(&older));
        assert_eq!(
            key_for(WHATSAPP),
            "package:5319275a.whatsappdesktop_cv1g1gvanyjgm"
        );
    }

    #[test]
    fn ordinary_programs_are_keyed_by_their_lower_case_path() {
        let firefox = r"C:\Program Files\Mozilla Firefox\firefox.exe";
        assert_eq!(package_family(firefox), None);
        assert_eq!(
            key_for(firefox),
            r"c:\program files\mozilla firefox\firefox.exe"
        );
    }

    #[test]
    fn rejects_folders_that_are_not_package_directories() {
        assert_eq!(
            package_family(r"C:\Program Files\WindowsApps\Deleted\x.exe"),
            None
        );
        assert_eq!(package_family(r"C:\Program Files\WindowsApps"), None);
        assert_eq!(
            package_family(r"C:\Windows\System32\ApplicationFrameHost.exe"),
            None
        );
    }

    #[test]
    fn a_start_menu_entry_belongs_to_its_package_family() {
        assert_eq!(
            family_of_app_id(r"shell:AppsFolder\Claude_pzs8sxrjxfjjc!Claude").as_deref(),
            Some("claude_pzs8sxrjxfjjc")
        );
        assert_eq!(
            family_of_app_id(r"shell:AppsFolder\OpenAI.Codex_2p2nqsd0c76g0!App").as_deref(),
            Some("openai.codex_2p2nqsd0c76g0")
        );
        assert_eq!(family_of_app_id(r"shell:AppsFolder\308046B0AF4A39CB"), None);
    }

    #[test]
    fn the_store_frame_host_is_not_an_app() {
        assert!(is_frame_host(
            r"C:\Windows\System32\ApplicationFrameHost.exe"
        ));
        assert!(!is_frame_host(WHATSAPP));
    }

    #[test]
    fn a_file_name_alone_still_gives_a_readable_name() {
        assert_eq!(name_from_file(r"C:\tools\notepad.exe"), "Notepad");
    }
}
