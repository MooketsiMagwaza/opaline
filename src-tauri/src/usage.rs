//! Local foreground/maximised time. The native sampler keeps working while the webview is hidden.
use crate::{
    identity::{self, Identity},
    store, taskbar,
};
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

impl Entry {
    /// Adds another record of the same app, keeping the most recent name and icon.
    fn absorb(&mut self, other: Entry) {
        self.total_ms = self.total_ms.saturating_add(other.total_ms);
        for (day, milliseconds) in other.days {
            let total = self.days.entry(day).or_default();
            *total = total.saturating_add(milliseconds);
        }
        while self.days.len() > 90 {
            self.days.pop_first();
        }
        if other.day == self.day {
            self.today_ms = self.today_ms.saturating_add(other.today_ms);
        } else if other.day > self.day {
            self.day = other.day;
            self.today_ms = other.today_ms;
            self.name = other.name;
            self.path = other.path;
        }
    }
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
    fn sample(&mut self, active: Option<Identity>, day: &str, elapsed: Duration) {
        if !self.history.enabled {
            self.previous = None;
            return;
        }
        // Require both interval endpoints to agree; never charge suspension or workspace transitions.
        if elapsed <= Duration::from_secs(2)
            && let Some(active) = &active
            && self
                .previous
                .as_ref()
                .is_some_and(|(previous, previous_day)| {
                    *previous == active.key && previous_day == day
                })
        {
            let entry = self.history.entries.entry(active.key.clone()).or_default();
            entry.name = active.name.clone();
            entry.path = active.icon_path.clone();
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
        self.previous = active.map(|active| (active.key, day.into()));
    }

    /// Brings history recorded before apps had an identity up to date: one entry per app across package updates,
    /// the name people know it by, and an icon that can actually be read. `resolve` returns None for time that was
    /// charged to a Store frame host, which belongs to no nameable app.
    fn adopt_identities(&mut self, resolve: impl Fn(&str) -> Option<Identity>) {
        let recorded = std::mem::take(&mut self.history.entries);
        for (id, mut entry) in recorded {
            let key = if id.starts_with("package:") {
                id
            } else {
                let Some(identity) = resolve(&entry.path) else {
                    continue;
                };
                entry.name = identity.name;
                entry.path = identity.icon_path;
                identity.key
            };
            match self.history.entries.get_mut(&key) {
                Some(existing) => existing.absorb(entry),
                None => {
                    self.history.entries.insert(key, entry);
                }
            }
        }
        self.previous = None;
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
        // Looking apps up reads the Start-menu catalogue, so it happens here rather than before the first frame.
        let recorded: Vec<String> = app
            .state::<Mutex<Tracker>>()
            .lock()
            .map(|tracker| {
                tracker
                    .history
                    .entries
                    .iter()
                    .filter(|(id, _)| !id.starts_with("package:"))
                    .map(|(_, entry)| entry.path.clone())
                    .collect()
            })
            .unwrap_or_default();
        let known: BTreeMap<String, Option<Identity>> = recorded
            .into_iter()
            .map(|path| {
                let identity = (!identity::is_frame_host(&path)).then(|| identity::resolve(&path));
                (path, identity)
            })
            .collect();
        if let Ok(mut tracker) = app.state::<Mutex<Tracker>>().lock()
            && !tracker.unreadable
        {
            tracker.adopt_identities(|path| known.get(path).cloned().flatten());
        }
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
    fn active() -> Option<Identity> {
        Some(Identity {
            key: "editor.exe".into(),
            name: "Editor".into(),
            icon_path: "editor.exe".into(),
        })
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
    fn recorded(path: &str, name: &str, day: &str, days: &[(&str, u64)]) -> Entry {
        Entry {
            name: name.into(),
            path: path.into(),
            total_ms: days.iter().map(|(_, ms)| ms).sum(),
            day: day.into(),
            today_ms: days
                .iter()
                .find(|(d, _)| *d == day)
                .map_or(0, |(_, ms)| *ms),
            days: days.iter().map(|(d, ms)| (d.to_string(), *ms)).collect(),
        }
    }
    #[test]
    fn history_from_before_identities_becomes_one_named_entry_per_app() {
        let key = "package:5319275a.whatsappdesktop_cv1g1gvanyjgm";
        let (old, new, host) = (
            r"a\v2640\whatsapp.root.exe",
            r"a\v2641\whatsapp.root.exe",
            r"c:\windows\applicationframehost.exe",
        );
        let mut tracker = Tracker::default();
        for (path, name, day, days) in [
            (
                old,
                "WhatsApp.Root",
                "2026-11-02",
                vec![("2026-11-02", 4000)],
            ),
            (
                new,
                "WhatsApp.Root",
                "2026-11-04",
                vec![("2026-11-02", 1000), ("2026-11-04", 122000)],
            ),
            (
                host,
                "ApplicationFrameHost",
                "2026-11-04",
                vec![("2026-11-04", 9000)],
            ),
        ] {
            tracker
                .history
                .entries
                .insert(path.into(), recorded(path, name, day, &days));
        }
        tracker.adopt_identities(|path| {
            path.contains("whatsapp").then(|| Identity {
                key: key.into(),
                name: "WhatsApp".into(),
                icon_path: r"shell:AppsFolder\5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App".into(),
            })
        });
        assert_eq!(
            tracker.history.entries.len(),
            1,
            "duplicates merge and the frame host is dropped"
        );
        let merged = &tracker.history.entries[key];
        assert_eq!(merged.name, "WhatsApp");
        assert!(merged.path.starts_with("shell:AppsFolder"));
        assert_eq!(merged.total_ms, 127000);
        assert_eq!(merged.days["2026-11-02"], 5000);
        assert_eq!(merged.days["2026-11-04"], 122000);
        assert_eq!(
            (merged.day.as_str(), merged.today_ms),
            ("2026-11-04", 122000)
        );
        // Running it again changes nothing.
        tracker.adopt_identities(|_| None);
        assert_eq!(tracker.history.entries[key].total_ms, 127000);
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
