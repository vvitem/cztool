//! 自动更新：与 Electron `update:*` IPC 契约对齐，事件通道 `update:status`。

use std::fs;
use std::sync::Mutex;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;

use crate::paths::migrate_file_if_needed;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettings {
  pub auto_check: bool,
}

impl Default for UpdateSettings {
  fn default() -> Self {
    Self { auto_check: true }
  }
}

pub struct UpdateState {
  pub last_downloaded_version: Mutex<Option<String>>,
}

impl Default for UpdateState {
  fn default() -> Self {
    Self {
      last_downloaded_version: Mutex::new(None),
    }
  }
}

fn settings_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  migrate_file_if_needed(app, "update-settings.json")
}

fn read_settings(app: &AppHandle) -> UpdateSettings {
  let Ok(path) = settings_path(app) else {
    return UpdateSettings::default();
  };
  match fs::read_to_string(path) {
    Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
    Err(_) => UpdateSettings::default(),
  }
}

fn write_settings(app: &AppHandle, settings: &UpdateSettings) -> Result<UpdateSettings, String> {
  let path = settings_path(app)?;
  let raw = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
  fs::write(path, raw).map_err(|e| e.to_string())?;
  Ok(settings.clone())
}

fn emit_status(app: &AppHandle, status: Value) {
  let _ = app.emit("update:status", status);
}

fn sanitize_update_error(raw: &str) -> String {
  let text = raw.split_whitespace().collect::<Vec<_>>().join(" ");
  if text.is_empty() {
    return "检查更新失败".into();
  }
  if regex_is_match(r"(?i)ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network|fetch failed|net::", &text) {
    return "网络异常，请稍后重试".into();
  }
  if regex_is_match(r"(?i)401|403|Unauthorized|Bad credentials|private", &text) {
    return "无法访问更新源（仓库权限或 Token 无效）".into();
  }
  if regex_is_match(r"(?i)Unable to find|Cannot parse|latest\.(yml|json)|404|not found", &text)
  {
    return "暂未找到可用更新，请稍后再试".into();
  }
  if regex_is_match(r"(?i)signature|not signed|notariz|minisign", &text) {
    return "更新包校验失败".into();
  }
  let first = text.lines().next().unwrap_or(&text);
  if first.len() <= 80 {
    first.to_string()
  } else {
    format!("{}…", &first[..80])
  }
}

fn regex_is_match(pat: &str, text: &str) -> bool {
  regex::Regex::new(pat)
    .map(|re| re.is_match(text))
    .unwrap_or(false)
}

#[tauri::command]
pub fn update_get_version(app: AppHandle) -> String {
  app.package_info().version.to_string()
}

#[tauri::command]
pub fn update_get_settings(app: AppHandle) -> UpdateSettings {
  read_settings(&app)
}

#[tauri::command]
pub fn update_set_auto_check(app: AppHandle, payload: bool) -> Result<UpdateSettings, String> {
  write_settings(
    &app,
    &UpdateSettings {
      auto_check: payload,
    },
  )
}

#[tauri::command]
pub async fn update_check(app: AppHandle) -> Result<Value, String> {
  check_for_updates(app, true).await
}

#[tauri::command]
pub fn update_quit_and_install(app: AppHandle) -> Result<Value, String> {
  // download_and_install 已写入新版本；此处重启以加载（never returns）
  app.restart()
}

pub async fn check_for_updates(app: AppHandle, manual: bool) -> Result<Value, String> {
  if cfg!(debug_assertions) {
    let message = "开发环境不可用，请使用打包后的应用检查更新";
    emit_status(
      &app,
      json!({ "type": "dev-skip", "message": message }),
    );
    return Ok(json!({
      "ok": false,
      "manual": manual,
      "type": "dev-skip",
      "message": message,
    }));
  }

  emit_status(&app, json!({ "type": "checking" }));

  let updater = match app.updater() {
    Ok(u) => u,
    Err(e) => {
      let message = sanitize_update_error(&e.to_string());
      emit_status(&app, json!({ "type": "error", "message": message }));
      return Ok(json!({ "ok": false, "manual": manual, "message": message }));
    }
  };

  let update = match updater.check().await {
    Ok(u) => u,
    Err(e) => {
      let message = sanitize_update_error(&e.to_string());
      emit_status(&app, json!({ "type": "error", "message": message }));
      return Ok(json!({ "ok": false, "manual": manual, "message": message }));
    }
  };

  let Some(update) = update else {
    let version = app.package_info().version.to_string();
    emit_status(
      &app,
      json!({ "type": "not-available", "version": version }),
    );
    return Ok(json!({ "ok": true, "manual": manual, "version": version }));
  };

  let version = update.version.clone();
  emit_status(
    &app,
    json!({ "type": "available", "version": version }),
  );

  let app_progress = app.clone();
  let mut downloaded: u64 = 0;
  let mut content_length: u64 = 0;

  let result = update
    .download_and_install(
      |chunk_len, total| {
        downloaded += chunk_len as u64;
        if let Some(t) = total {
          content_length = t;
        }
        let percent = if content_length > 0 {
          ((downloaded as f64 / content_length as f64) * 100.0).round() as u32
        } else {
          0
        };
        emit_status(
          &app_progress,
          json!({ "type": "downloading", "percent": percent }),
        );
      },
      || {},
    )
    .await;

  if let Err(e) = result {
    let message = sanitize_update_error(&e.to_string());
    emit_status(&app, json!({ "type": "error", "message": message }));
    return Ok(json!({ "ok": false, "manual": manual, "message": message }));
  }

  if let Ok(mut guard) = app.state::<UpdateState>().last_downloaded_version.lock() {
    *guard = Some(version.clone());
  }
  emit_status(
    &app,
    json!({ "type": "downloaded", "version": version }),
  );

  Ok(json!({ "ok": true, "manual": manual, "version": version }))
}

/// 启动后延迟自动检查（对齐 Electron scheduleAutoUpdateCheck）
pub fn schedule_auto_update_check(app: AppHandle, delay_ms: u64) {
  let settings = read_settings(&app);
  if !settings.auto_check {
    return;
  }
  std::thread::spawn(move || {
    std::thread::sleep(Duration::from_millis(delay_ms));
    tauri::async_runtime::block_on(async move {
      let _ = check_for_updates(app, false).await;
    });
  });
}
