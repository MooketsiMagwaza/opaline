//! Local foreground/maximised time. The native sampler keeps working while the webview is hidden.
use crate::{store, taskbar};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Entry {
    name: String,
    path: String,
    total_ms: u64,
    day: String,
    today_ms: u64,
    #[serde(default)]
    days: BTreeMap<String, u64>,
}

#[derive(Clone, Deserialize, Serialize)]
struct History {
    enabled: bool,
    entries: BTreeMap<String, Entry>,
}
impl Default for History {
    fn default() -> Self {
        Self {
            enabled: true,
            entries: BTreeMap::new(),
        }
    }
}

#[derive(Default)]
pub struct Tracker {
    history: History,
    previous: Option<(String, String)>,
    save_error: Option<String>,
    unreadable: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageEntry {
    id: String,
    name: String,
    path: String,
    total_seconds: u64,
    today_seconds: u64,
    daily_seconds: BTreeMap<String, u64>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    enabled: bool,
    supported: bool,
    entries: Vec<UsageEntry>,
    save_error: Option<String>,
}

impl Tracker {
    fn sample(&mut self, active: Option<(String, String)>, day: &str, elapsed: Duration) {
        if !self.history.enabled {
            self.previous = None;
            return;
        }
        // Require both interval endpoints to agree; never charge suspension or workspace transitions.
        if elapsed <= Duration::from_secs(2)
            && let Some((path, name)) = &active
            && self
                .previous
                .as_ref()
                .is_some_and(|(previous, previous_day)| previous == path && previous_day == day)
        {
            let entry = self.history.entries.entry(path.clone()).or_default();
            entry.name = name.clone();
            entry.path = path.clone();
            if entry.day != day {
                entry.day = day.into();
                entry.today_ms = 0;
            }
            let milliseconds = elapsed.as_millis() as u64;
            entry.total_ms = entry.total_ms.saturating_add(milliseconds);
            entry.today_ms = entry.today_ms.saturating_add(milliseconds);
            let daily_total = entry.days.entry(day.into()).or_default();
            *daily_total = daily_total.saturating_add(milliseconds);
            while entry.days.len() > 90 {
                entry.days.pop_first();
            }
        }
        self.previous = active.map(|(path, _)| (path, day.into()));
    }

    fn save(&mut self, app: &AppHandle) -> Result<(), String> {
        let json = serde_json::to_string(&self.history).map_err(|error| error.to_string())?;
        let result = store::save(app, "screen-time.json", &json);
        self.save_error = result.as_ref().err().cloned();
        result
    }
}

pub fn start(app: &AppHandle) {
    let mut tracker = Tracker::default();
    if let Some(text) = store::load(app, "screen-time.json") {
        match serde_json::from_str::<History>(&text) {
            Ok(mut history) => {
                for entry in history.entries.values_mut() {
                    if entry.days.is_empty() && entry.today_ms > 0 {
                        entry.days.insert(entry.day.clone(), entry.today_ms);
                    }
                }
                tracker.history = history;
            }
            Err(error) => {
                tracker.unreadable = true;
                tracker.history.enabled = false;
                tracker.save_error = Some(format!(
                    "Saved history could not be read. Clear history to start again: {error}"
                ));
            }
        }
    }
    app.manage(Mutex::new(tracker));
    let app = app.clone();
    std::thread::spawn(move || {
        let mut last = Instant::now();
        let mut ticks = 0;
        loop {
            std::thread::sleep(Duration::from_secs(1));
            let now = Instant::now();
            let enabled = app
                .state::<Mutex<Tracker>>()
                .lock()
                .is_ok_and(|tracker| tracker.history.enabled);
            let active = if enabled {
                taskbar::foreground_maximized()
            } else {
                None
            };
            let day = local_day();
            if let Ok(mut tracker) = app.state::<Mutex<Tracker>>().lock() {
                tracker.sample(active, &day, now.duration_since(last));
                ticks += 1;
                if ticks >= 30 && tracker.history.enabled {
                    let _ = tracker.save(&app);
                    ticks = 0;
                }
            }
            last = now;
        }
    });
}

pub fn flush(app: &AppHandle) {
    if let Ok(mut tracker) = app.state::<Mutex<Tracker>>().lock() {
        // A corrupt file remains recoverable until the user explicitly clears it.
        if tracker.history.enabled || tracker.save_error.is_none() {
            let _ = tracker.save(app);
        }
    }
}
pub fn report(app: &AppHandle) -> Result<Report, String> {
    let tracker = app.state::<Mutex<Tracker>>();
    let tracker = tracker.lock().map_err(|error| error.to_string())?;
    let day = local_day();
    Ok(Report {
        enabled: tracker.history.enabled,
        supported: cfg!(windows),
        save_error: tracker.save_error.clone(),
        entries: tracker
            .history
            .entries
            .iter()
            .map(|(id, entry)| UsageEntry {
                id: id.clone(),
                name: entry.name.clone(),
                path: entry.path.clone(),
                total_seconds: entry.total_ms / 1000,
                today_seconds: if entry.day == day {
                    entry.today_ms / 1000
                } else {
                    0
                },
                daily_seconds: entry
                    .days
                    .iter()
                    .map(|(day, milliseconds)| (day.clone(), milliseconds / 1000))
                    .collect(),
            })
            .collect(),
    })
}
pub fn set_enabled(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let tracker = app.state::<Mutex<Tracker>>();
    let mut tracker = tracker.lock().map_err(|error| error.to_string())?;
    if tracker.unreadable {
        return Err("Clear the unreadable history before starting a new record.".into());
    }
    let previous = tracker.history.enabled;
    tracker.history.enabled = enabled;
    tracker.previous = None;
    if let Err(error) = tracker.save(app) {
        tracker.history.enabled = previous;
        return Err(error);
    }
    Ok(())
}
pub fn clear(app: &AppHandle) -> Result<(), String> {
    let tracker = app.state::<Mutex<Tracker>>();
    let mut tracker = tracker.lock().map_err(|error| error.to_string())?;
    let previous = tracker.history.clone();
    tracker.history.entries.clear();
    tracker.previous = None;
    if let Err(error) = tracker.save(app) {
        tracker.history = previous;
        return Err(error);
    }
    tracker.unreadable = false;
    Ok(())
}

#[cfg(windows)]
fn local_day() -> String {
    let time = unsafe { windows::Win32::System::SystemInformation::GetLocalTime() };
    format!("{:04}-{:02}-{:02}", time.wYear, time.wMonth, time.wDay)
}
#[cfg(not(windows))]
fn local_day() -> String {
    String::new()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn active() -> Option<(String, String)> {
        Some(("editor.exe".into(), "Editor".into()))
    }
    #[test]
    fn counts_only_matching_foreground_endpoints_and_never_sleep() {
        let mut tracker = Tracker::default();
        tracker.sample(active(), "2026-10-28", Duration::from_secs(1));
        tracker.sample(active(), "2026-10-28", Duration::from_secs(1));
        tracker.sample(None, "2026-10-28", Duration::from_secs(1));
        tracker.sample(active(), "2026-10-28", Duration::from_secs(1));
        tracker.sample(active(), "2026-10-28", Duration::from_secs(3600));
        assert_eq!(tracker.history.entries["editor.exe"].total_ms, 1000);
        tracker.history.enabled = false;
        tracker.sample(active(), "2026-10-28", Duration::from_secs(1));
        assert!(tracker.previous.is_none());
    }
    #[test]
    fn rolls_today_over_without_losing_total_or_charging_midnight_gap() {
        let mut tracker = Tracker::default();
        for _ in 0..3 {
            tracker.sample(active(), "2026-10-28", Duration::from_secs(1));
        }
        for _ in 0..2 {
            tracker.sample(active(), "2026-10-29", Duration::from_secs(1));
        }
        assert_eq!(tracker.history.entries["editor.exe"].total_ms, 3000);
        assert_eq!(tracker.history.entries["editor.exe"].today_ms, 1000);
        assert_eq!(
            tracker.history.entries["editor.exe"].days["2026-10-28"],
            2000
        );
        assert_eq!(
            tracker.history.entries["editor.exe"].days["2026-10-29"],
            1000
        );
        let restored: History =
            serde_json::from_str(&serde_json::to_string(&tracker.history).unwrap()).unwrap();
        assert_eq!(restored.entries["editor.exe"].total_ms, 3000);
    }
}
