//! Start at Windows sign-in, through a per-user Scheduled Task with a logon trigger.
//!
//! This replaced the Run-key entry that `tauri-plugin-autostart` writes. On the owner's machine Explorer read
//! `HKCU\…\Run` at every sign-in for a week and never started Opaline: the value and its `StartupApproved` flag were
//! correct and Explorer's own log (Shell-Core event 9707) lists every other entry it launched, but never this one, with no
//! reason given. Task Scheduler does not go through that path, runs the task as the signed-in user without elevation, and
//! keeps a history of why a start failed.
//!
//! The task starts Opaline with `--hidden` ten seconds after sign-in. A second launch (for example the legacy Run entry
//! firing as well) hands over to the running instance and, because of `--hidden`, does nothing.

use std::path::Path;

/// The task's name in Task Scheduler's root folder.
const TASK_NAME: &str = "Opaline";
/// Where the previous mechanism wrote, kept so an existing install is carried over instead of silently turned off.
const LEGACY_RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
const LEGACY_APPROVAL_KEY: &str =
    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";
const LEGACY_VALUE_NAME: &str = "Opaline";
/// Wait before the first start so Explorer's taskbar usually exists and the tray icon does not need its retry.
const LOGON_DELAY: &str = "PT10S";

fn escape_xml(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// The task definition, as the XML Task Scheduler imports. Priority 4 keeps the process at normal priority; the
/// scheduler's default of 7 would run Opaline (and the WebView2 processes it starts) below normal.
fn task_xml(user: &str, executable: &Path) -> String {
    let user = escape_xml(user);
    let command = escape_xml(&executable.display().to_string());
    let working_folder = executable
        .parent()
        .map(|folder| escape_xml(&folder.display().to_string()))
        .unwrap_or_default();
    format!(
        r#"<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Starts Opaline hidden in the tray when you sign in to Windows.</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>{user}</UserId>
      <Delay>{LOGON_DELAY}</Delay>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>{user}</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>4</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{command}</Command>
      <Arguments>--hidden</Arguments>
      <WorkingDirectory>{working_folder}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"#
    )
}

pub fn is_enabled() -> bool {
    imp::task_exists()
}

/// Turns start at login on or off. Either way the old Run-key entry is removed, so the two never both fire.
pub fn set_enabled(enabled: bool) -> Result<(), String> {
    if enabled {
        imp::register_task()?;
    } else {
        imp::remove_task()?;
    }
    imp::remove_legacy_entry();
    Ok(())
}

/// An install that was set to start at login by the Run-key mechanism keeps that preference under the new one.
pub fn migrate_legacy_entry() {
    if imp::legacy_entry_exists() {
        let outcome = set_enabled(true);
        crate::startup_log::write(&match outcome {
            Ok(()) => {
                "moved the start-at-login entry from the Run key to a scheduled task".to_string()
            }
            Err(error) => {
                format!("could not move the start-at-login entry to a scheduled task: {error}")
            }
        });
    }
}

#[cfg(windows)]
mod imp {
    use super::*;
    use std::{
        fs,
        os::windows::process::CommandExt,
        process::{Command, Output},
    };

    /// Keeps `schtasks` and `reg` from flashing a console window.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    fn run(program: &str, arguments: &[&str]) -> Result<Output, String> {
        Command::new(program)
            .args(arguments)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|error| format!("could not run {program}: {error}"))
    }

    fn describe_failure(output: &Output) -> String {
        let text = String::from_utf8_lossy(&output.stderr);
        let text = text.trim();
        if text.is_empty() {
            format!("exit code {:?}", output.status.code())
        } else {
            text.to_string()
        }
    }

    pub fn task_exists() -> bool {
        run("schtasks.exe", &["/Query", "/TN", TASK_NAME])
            .is_ok_and(|output| output.status.success())
    }

    pub fn register_task() -> Result<(), String> {
        let domain = std::env::var("USERDOMAIN").unwrap_or_default();
        let name = std::env::var("USERNAME")
            .map_err(|_| "Windows did not say who is signed in".to_string())?;
        let user = if domain.is_empty() {
            name
        } else {
            format!("{domain}\\{name}")
        };
        let executable = std::env::current_exe()
            .map_err(|error| format!("could not find Opaline's own path: {error}"))?;

        // Task Scheduler reads the definition as UTF-16 with a byte-order mark.
        let mut definition: Vec<u8> = vec![0xFF, 0xFE];
        for unit in task_xml(&user, &executable).encode_utf16() {
            definition.extend_from_slice(&unit.to_le_bytes());
        }
        let definition_path = std::env::temp_dir().join("opaline-login-task.xml");
        fs::write(&definition_path, definition)
            .map_err(|error| format!("could not write the task definition: {error}"))?;

        let outcome = run(
            "schtasks.exe",
            &[
                "/Create",
                "/TN",
                TASK_NAME,
                "/XML",
                &definition_path.display().to_string(),
                "/F",
            ],
        );
        let _ = fs::remove_file(&definition_path);
        let output = outcome?;
        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Windows would not register the start-at-login task: {}",
                describe_failure(&output)
            ))
        }
    }

    pub fn remove_task() -> Result<(), String> {
        if !task_exists() {
            return Ok(());
        }
        let output = run("schtasks.exe", &["/Delete", "/TN", TASK_NAME, "/F"])?;
        if output.status.success() {
            Ok(())
        } else {
            Err(format!(
                "Windows would not remove the start-at-login task: {}",
                describe_failure(&output)
            ))
        }
    }

    pub fn legacy_entry_exists() -> bool {
        run(
            "reg.exe",
            &["query", LEGACY_RUN_KEY, "/v", LEGACY_VALUE_NAME],
        )
        .is_ok_and(|output| output.status.success())
    }

    pub fn remove_legacy_entry() {
        if !legacy_entry_exists() {
            return;
        }
        for key in [LEGACY_RUN_KEY, LEGACY_APPROVAL_KEY] {
            let _ = run("reg.exe", &["delete", key, "/v", LEGACY_VALUE_NAME, "/f"]);
        }
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn task_exists() -> bool {
        false
    }
    pub fn register_task() -> Result<(), String> {
        Err("Start at login is only available on Windows.".into())
    }
    pub fn remove_task() -> Result<(), String> {
        Ok(())
    }
    pub fn legacy_entry_exists() -> bool {
        false
    }
    pub fn remove_legacy_entry() {}
}

#[cfg(test)]
mod tests {
    use super::{escape_xml, task_xml};
    use std::path::Path;

    #[test]
    fn the_task_starts_the_installed_exe_hidden_at_logon_for_that_user() {
        let xml = task_xml(
            r"DESKTOP\Nido",
            Path::new(r"C:\Program Files\Opaline\opaline.exe"),
        );
        assert!(xml.contains("<LogonTrigger>"));
        assert!(xml.contains(r"<UserId>DESKTOP\Nido</UserId>"));
        assert!(xml.contains(r"<Command>C:\Program Files\Opaline\opaline.exe</Command>"));
        assert!(xml.contains("<Arguments>--hidden</Arguments>"));
        assert!(xml.contains(r"<WorkingDirectory>C:\Program Files\Opaline</WorkingDirectory>"));
        assert!(xml.contains("<RunLevel>LeastPrivilege</RunLevel>"));
        assert!(xml.contains("<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>"));
        assert!(xml.contains("<Priority>4</Priority>"));
    }

    #[test]
    fn characters_that_xml_reserves_are_escaped_in_paths_and_names() {
        assert_eq!(
            escape_xml(r#"A&B <C> "D""#),
            "A&amp;B &lt;C&gt; &quot;D&quot;"
        );
        let xml = task_xml("PC\\Tom & Jerry", Path::new(r"C:\Apps & Tools\opaline.exe"));
        assert!(xml.contains(r"<UserId>PC\Tom &amp; Jerry</UserId>"));
        assert!(xml.contains(r"<Command>C:\Apps &amp; Tools\opaline.exe</Command>"));
    }
}
