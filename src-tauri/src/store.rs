//! Small JSON files in the app data folder. The UI owns the schema of `groups.json`;
//! Rust only needs `config.json` (the hotkey) before the UI exists.

use std::{fs, path::PathBuf};

use tauri::{AppHandle, Manager};

const ALLOWED: [&str; 5] = [
    "groups.json",
    "config.json",
    "workspaces.json",
    "screen-time.json",
    "shell.json",
];
const MAX_BYTES: usize = 1024 * 1024;

pub fn test_data_dir() -> Option<PathBuf> {
    #[cfg(debug_assertions)]
    {
        std::env::var_os("OPALINE_TEST_DATA")
            .map(PathBuf::from)
            .filter(|path| path.is_absolute())
    }
    #[cfg(not(debug_assertions))]
    {
        None
    }
}

fn file(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    if !ALLOWED.contains(&name) {
        return Err(format!("unknown store file: {name}"));
    }
    let dir = test_data_dir()
        .map(Ok)
        .unwrap_or_else(|| app.path().app_data_dir().map_err(|error| error.to_string()))?;
    Ok(dir.join(name))
}

pub fn load(app: &AppHandle, name: &str) -> Option<String> {
    let path = file(app, name).ok()?;
    if let Ok(contents) = fs::read_to_string(&path) {
        return Some(contents);
    }
    if test_data_dir().is_some() {
        return None;
    }

    // The public bundle identifier replaced the development placeholder. Preserve panes and the
    // hotkey from pre-release builds once, without moving or deleting the legacy file.
    let legacy = path
        .parent()?
        .parent()?
        .join("dev.opaline.launcher")
        .join(name);
    let contents = fs::read_to_string(legacy).ok()?;
    let _ = save(app, name, &contents);
    Some(contents)
}

pub fn save(app: &AppHandle, name: &str, contents: &str) -> Result<(), String> {
    if contents.len() > MAX_BYTES {
        return Err("store file too large".into());
    }
    serde_json::from_str::<serde_json::Value>(contents).map_err(|error| error.to_string())?;

    let path = file(app, name)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    }

    // Write beside the file and rename, so a crash never leaves half a file.
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, contents).map_err(|error| error.to_string())?;
    fs::rename(&temporary, &path).map_err(|error| error.to_string())
}
