//! Reads the items that live on the desktop: the user's desktop folder plus, on Windows, the shared one.
//! The files stay where they are; Opaline only lists them.

use std::{collections::HashSet, fs, path::PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub name: String,
    pub path: String,
    pub is_folder: bool,
}

fn roots(app: &AppHandle) -> Vec<PathBuf> {
    let mut roots = Vec::new();

    // Follows OneDrive folder redirection, so no hard-coded paths.
    if let Ok(dir) = app.path().desktop_dir() {
        roots.push(dir);
    }

    #[cfg(windows)]
    if let Some(public) = std::env::var_os("PUBLIC") {
        roots.push(PathBuf::from(public).join("Desktop"));
    }

    roots
}

#[cfg(windows)]
fn is_hidden(entry: &fs::DirEntry, _name: &str) -> bool {
    use std::os::windows::fs::MetadataExt;

    const HIDDEN: u32 = 0x2;
    const SYSTEM: u32 = 0x4;

    entry
        .metadata()
        .map(|meta| meta.file_attributes() & (HIDDEN | SYSTEM) != 0)
        .unwrap_or(false)
}

#[cfg(not(windows))]
fn is_hidden(_entry: &fs::DirEntry, name: &str) -> bool {
    name.starts_with('.')
}

/// Shortcuts read better without their extension, the way Explorer shows them.
fn display_name(file_name: &str, is_folder: bool) -> String {
    if !is_folder {
        let lower = file_name.to_lowercase();
        for ext in [".lnk", ".url", ".desktop"] {
            if lower.ends_with(ext) {
                return file_name[..file_name.len() - ext.len()].to_string();
            }
        }
    }
    file_name.to_string()
}

pub fn scan(app: &AppHandle) -> Vec<Item> {
    let mut seen = HashSet::new();
    let mut items = Vec::new();

    for root in roots(app) {
        let Ok(entries) = fs::read_dir(&root) else {
            continue;
        };

        for entry in entries.flatten() {
            let file_name = entry.file_name().to_string_lossy().into_owned();
            if file_name.eq_ignore_ascii_case("desktop.ini") || is_hidden(&entry, &file_name) {
                continue;
            }

            let is_folder = entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false);
            let name = display_name(&file_name, is_folder);
            if !seen.insert(name.to_lowercase()) {
                continue;
            }

            items.push(Item {
                name,
                path: entry.path().to_string_lossy().into_owned(),
                is_folder,
            });
        }
    }

    items.sort_by(|a, b| {
        b.is_folder
            .cmp(&a.is_folder)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    items
}
