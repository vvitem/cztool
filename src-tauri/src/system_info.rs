use serde_json::{json, Value};
use sysinfo::{DiskKind, Disks, System};
use tauri::AppHandle;

fn disk_usage() -> Option<Value> {
  let disks = Disks::new_with_refreshed_list();
  let list = disks.list();
  if list.is_empty() {
    return None;
  }

  let preferred: &[&str] = if cfg!(target_os = "windows") {
    &["C:\\", "C:/", "C:"]
  } else if cfg!(target_os = "macos") {
    &["/System/Volumes/Data", "/"]
  } else {
    &["/"]
  };

  let mut chosen = None;
  for mount in preferred {
    if let Some(disk) = list.iter().find(|d| {
      let p = d.mount_point().to_string_lossy();
      p.eq_ignore_ascii_case(mount) || p.trim_end_matches(['\\', '/']).eq_ignore_ascii_case(mount.trim_end_matches(['\\', '/']))
    }) {
      if disk.total_space() > 0 {
        chosen = Some(disk);
        break;
      }
    }
  }

  if chosen.is_none() {
    chosen = list
      .iter()
      .filter(|d| {
        d.total_space() > 0
          && !matches!(d.kind(), DiskKind::Unknown(_))
          && !d.mount_point().to_string_lossy().contains("loop")
      })
      .max_by_key(|d| d.total_space());
  }

  if chosen.is_none() {
    chosen = list.iter().filter(|d| d.total_space() > 0).max_by_key(|d| d.total_space());
  }

  let disk = chosen?;
  let total = disk.total_space();
  if total == 0 {
    return None;
  }
  let free = disk.available_space();
  let mount = disk.mount_point().to_string_lossy().trim_end_matches('\\').to_string();
  Some(json!({
    "mount": mount,
    "total": total,
    "free": free,
    "used": total.saturating_sub(free),
  }))
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
