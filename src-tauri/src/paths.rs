use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

/// Prefer Tauri app_data_dir; fall back to Electron legacy `…/cztool` for migration.
pub fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("app_data_dir: {e}"))?;
  fs::create_dir_all(&dir).map_err(|e| format!("create app_data_dir: {e}"))?;
  Ok(dir)
}

pub fn legacy_electron_data_dir() -> Option<PathBuf> {
  let home = dirs::home_dir()?;
  #[cfg(target_os = "macos")]
  {
    Some(home.join("Library/Application Support/cztool"))
  }
  #[cfg(target_os = "windows")]
  {
    std::env::var_os("APPDATA").map(|p| PathBuf::from(p).join("cztool"))
  }
  #[cfg(all(unix, not(target_os = "macos")))]
  {
    Some(home.join(".config/cztool"))
  }
}

/// If `name` missing in Tauri dir but exists in Electron dir, copy once.
pub fn migrate_file_if_needed(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
  let dest_dir = app_data_dir(app)?;
  let dest = dest_dir.join(name);
  if dest.exists() {
    return Ok(dest);
  }
  if let Some(legacy) = legacy_electron_data_dir() {
    let src = legacy.join(name);
    if src.exists() {
      if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).ok();
      }
      let _ = fs::copy(&src, &dest);
    }
  }
  Ok(dest)
}
