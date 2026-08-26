use serde_json::{json, Value};
use std::process::Command;
use sysinfo::System;
use tauri::AppHandle;

fn disk_usage() -> Option<Value> {
  #[cfg(target_os = "windows")]
  {
    let output = Command::new("wmic")
      .args([
        "logicaldisk",
        "where",
        "DeviceID='C:'",
        "get",
        "Size,FreeSpace",
        "/format:value",
      ])
      .output()
      .ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let free = stdout
      .lines()
      .find_map(|l| l.strip_prefix("FreeSpace="))
      .and_then(|v| v.trim().parse::<u64>().ok())?;
    let total = stdout
      .lines()
      .find_map(|l| l.strip_prefix("Size="))
      .and_then(|v| v.trim().parse::<u64>().ok())?;
    if total == 0 {
      return None;
    }
    return Some(json!({
      "mount": "C:",
      "total": total,
      "free": free,
      "used": total.saturating_sub(free),
    }));
  }

  #[cfg(not(target_os = "windows"))]
  {
    let targets: &[&str] = if cfg!(target_os = "macos") {
      &["/System/Volumes/Data", "/"]
    } else {
      &["/"]
    };
    for target in targets {
      let output = Command::new("df").args(["-kP", target]).output().ok()?;
      let stdout = String::from_utf8_lossy(&output.stdout);
      let line = stdout.lines().last()?.trim();
      let parts: Vec<&str> = line.split_whitespace().collect();
      if parts.len() < 6 {
        continue;
      }
      let total_kb = parts[1].parse::<u64>().ok()?;
      let used_kb = parts[2].parse::<u64>().ok()?;
      let free_kb = parts[3].parse::<u64>().ok()?;
      if total_kb == 0 {
        continue;
      }
      return Some(json!({
        "mount": parts[5],
        "total": total_kb * 1024,
        "used": used_kb * 1024,
        "free": free_kb * 1024,
      }));
    }
    None
  }
}

#[tauri::command]
pub fn system_machine_info(_app: AppHandle) -> Result<Value, String> {
  let mut sys = System::new_all();
  sys.refresh_memory();
  sys.refresh_cpu_all();

  let total_mem = sys.total_memory();
  let free_mem = sys.available_memory();
  let used_mem = total_mem.saturating_sub(free_mem);

  let platform = std::env::consts::OS;
  let platform_key = match platform {
    "macos" => "darwin",
    "windows" => "win32",
    other => other,
  };
  let platform_label = match platform_key {
    "darwin" => "macOS",
    "win32" => "Windows",
    "linux" => "Linux",
    other => other,
  };

  let cpu_model = sys
    .cpus()
    .first()
    .map(|c| c.brand().replace(['\t'], " ").split_whitespace().collect::<Vec<_>>().join(" "))
    .unwrap_or_default();

  let username = whoami::username();
  let hostname = whoami::fallible::hostname().unwrap_or_else(|_| "unknown".into());

  Ok(json!({
    "hostname": hostname,
    "username": username,
    "platform": platform_key,
    "platformLabel": platform_label,
    "arch": std::env::consts::ARCH,
    "release": System::os_version().unwrap_or_default(),
    "cpuModel": cpu_model,
    "cpuCores": sys.cpus().len(),
    "totalMem": total_mem,
    "freeMem": free_mem,
    "usedMem": used_mem,
    "disk": disk_usage(),
  }))
}
