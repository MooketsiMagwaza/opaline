//! A tiny append-only log of how Opaline started, kept beside the other data files.
//!
//! A login start has no console and no window, so a failure there (a panic, a tray icon that could not be created yet)
//! would otherwise vanish without a trace. This file is what the owner, or the next person debugging, reads instead of guessing.
//! It stays on the machine, holds no user content, and is cut back once it passes 64 KiB.

use std::{
    fs,
    io::Write,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

const IDENTIFIER: &str = "io.github.mooketsimagwaza.opaline";
const MAX_BYTES: u64 = 64 * 1024;

fn log_path() -> Option<PathBuf> {
    let base = std::env::var_os("APPDATA")?;
    Some(PathBuf::from(base).join(IDENTIFIER).join("startup.log"))
}

/// Appends one line. Never fails the caller: a log that cannot be written must not take the app down with it.
pub fn write(message: &str) {
    let Some(path) = log_path() else {
        return;
    };
    if let Some(folder) = path.parent() {
        let _ = fs::create_dir_all(folder);
    }
    if fs::metadata(&path).is_ok_and(|meta| meta.len() > MAX_BYTES) {
        let _ = fs::remove_file(&path);
    }
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_secs());
    if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(file, "[{}] {message}", utc_stamp(seconds));
    }
}

/// Records any panic before the process dies, which is otherwise silent in a release build.
pub fn install_panic_hook() {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        write(&format!("panic: {info}"));
        previous(info);
    }));
}

/// `YYYY-MM-DD HH:MM:SS` in UTC, without pulling in a date library for one log line.
fn utc_stamp(unix_seconds: u64) -> String {
    let days = (unix_seconds / 86_400) as i64;
    let time = unix_seconds % 86_400;
    // Civil-from-days (Howard Hinnant's algorithm), valid for the proleptic Gregorian calendar.
    let shifted = days + 719_468;
    let era = shifted.div_euclid(146_097);
    let day_of_era = shifted.rem_euclid(146_097);
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_index = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_index + 2) / 5 + 1;
    let month = if month_index < 10 {
        month_index + 3
    } else {
        month_index - 9
    };
    let year = year_of_era + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02} {:02}:{:02}:{:02}",
        time / 3_600,
        time % 3_600 / 60,
        time % 60
    )
}

#[cfg(test)]
mod tests {
    use super::utc_stamp;

    #[test]
    fn formats_known_instants() {
        assert_eq!(utc_stamp(0), "1970-01-01 00:00:00");
        assert_eq!(utc_stamp(31_536_000), "1971-01-01 00:00:00");
        // A leap day, to exercise the month arithmetic.
        assert_eq!(utc_stamp(951_782_400), "2000-02-29 00:00:00");
        assert_eq!(utc_stamp(951_868_800 + 3_661), "2000-03-01 01:01:01");
    }
}
