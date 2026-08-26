use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tauri::AppHandle;
use uuid::Uuid;

use crate::paths::migrate_file_if_needed;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnlockSession {
  pub device_id: String,
  pub token: String,
  pub expires_at: i64,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub bound_code: Option<String>,
}

fn now_ms() -> i64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis() as i64)
    .unwrap_or(0)
}

fn unlock_api_base() -> String {
  std::env::var("CZTOOL_UNLOCK_API_URL")
    .or_else(|_| std::env::var("VITE_UNLOCK_API_URL"))
    .ok()
    .or_else(|| option_env!("VITE_UNLOCK_API_URL").map(|s| s.to_string()))
    .unwrap_or_else(|| "http://127.0.0.1:8787".into())
    .trim_end_matches('/')
    .to_string()
}

/// 与 Electron 对齐：仅未打包(debug)且 CZTOOL_UNLOCK_SKIP=1 时跳过
fn skip_unlock() -> bool {
  cfg!(debug_assertions) && std::env::var("CZTOOL_UNLOCK_SKIP").ok().as_deref() == Some("1")
}

pub fn get_device_id(app: &AppHandle) -> Result<String, String> {
  let path = migrate_file_if_needed(app, "device-id")?;
  let uuid = match fs::read_to_string(&path) {
    Ok(raw) if !raw.trim().is_empty() => raw.trim().to_string(),
    _ => {
      let id = Uuid::new_v4().to_string();
      if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
      }
      fs::write(&path, &id).map_err(|e| e.to_string())?;
      id
    }
  };
  let mut hasher = Sha256::new();
  hasher.update(uuid.as_bytes());
  Ok(format!("{:x}", hasher.finalize()))
}

fn session_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
  migrate_file_if_needed(app, "unlock-session.json")
}

fn read_session(app: &AppHandle) -> Option<UnlockSession> {
  let path = session_path(app).ok()?;
  let raw = fs::read_to_string(path).ok()?;
  serde_json::from_str(&raw).ok()
}

fn write_session(app: &AppHandle, session: &UnlockSession) -> Result<(), String> {
  let path = session_path(app)?;
  let raw = serde_json::to_string_pretty(session).map_err(|e| e.to_string())?;
  fs::write(path, raw).map_err(|e| e.to_string())
}

fn clear_session(app: &AppHandle) -> Result<(), String> {
  let path = session_path(app)?;
  let _ = fs::remove_file(path);
  Ok(())
}

fn is_session_valid(app: &AppHandle, session: &UnlockSession) -> bool {
  match get_device_id(app) {
    Ok(id) if id == session.device_id => session.expires_at > now_ms(),
    _ => false,
  }
}

async fn post_json(path: &str, body: Value) -> Result<Value, String> {
  let url = format!("{}{}", unlock_api_base(), path);
  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(15))
    .build()
    .map_err(|_| "网络连接失败，请检查网络后重试".to_string())?;

  let response = match client
    .post(&url)
    .header("Content-Type", "application/json")
    .json(&body)
    .send()
    .await
  {
    Ok(r) => r,
    Err(e) => {
      if e.is_timeout() {
        return Err("网络请求超时，请稍后重试".into());
      }
      return Err("网络连接失败，请检查网络后重试".into());
    }
  };

  let status = response.status().as_u16();
  let data: Value = response.json().await.unwrap_or_else(|_| json!({}));

  if !(200..300).contains(&status) {
    let message = data
      .get("error")
      .and_then(|v| v.as_str())
      .map(|s| s.to_string())
      .unwrap_or_else(|| map_status_message(status));
    return Err(message);
  }
  Ok(data)
}

fn map_status_message(status: u16) -> String {
  match status {
    403 => "该验证码已被其他设备使用".into(),
    400 => "验证码无效".into(),
    401 => "会话已失效，请重新输入验证码".into(),
    _ => "验证失败，请稍后重试".into(),
  }
}

#[tauri::command]
pub fn unlock_get_device_id(app: AppHandle) -> Result<String, String> {
  get_device_id(&app)
}

#[tauri::command]
pub async fn unlock_get_status(app: AppHandle) -> Result<Value, String> {
  let device_id = get_device_id(&app)?;

  if skip_unlock() {
    return Ok(json!({ "locked": false, "deviceId": device_id, "skipped": true }));
  }

  if let Some(session) = read_session(&app) {
    if is_session_valid(&app, &session) {
      return Ok(json!({
        "locked": false,
        "deviceId": device_id,
        "expiresAt": session.expires_at,
      }));
    }

    if !session.token.is_empty() {
      let body = json!({
        "deviceId": device_id,
        "token": session.token,
      });
      if let Ok(data) = post_json("/refresh", body).await {
        let token = data.get("token").and_then(|v| v.as_str()).unwrap_or("");
        let expires_at = data.get("expiresAt").and_then(|v| v.as_i64()).unwrap_or(0);
        if !token.is_empty() && expires_at > 0 {
          let next = UnlockSession {
            device_id: device_id.clone(),
            token: token.to_string(),
            expires_at,
            bound_code: session.bound_code,
          };
          write_session(&app, &next)?;
          return Ok(json!({
            "locked": false,
            "deviceId": device_id,
            "expiresAt": expires_at,
          }));
        }
      }
    }
  }

  Ok(json!({ "locked": true, "deviceId": device_id }))
}

#[tauri::command]
pub async fn unlock_verify(app: AppHandle, payload: String) -> Result<Value, String> {
  if skip_unlock() {
    return Ok(json!({ "ok": true, "skipped": true }));
  }

  let trimmed = payload.trim().to_string();
  if trimmed.is_empty() {
    return Ok(json!({ "ok": false, "message": "请输入验证码" }));
  }

  let device_id = get_device_id(&app)?;
  let version = app.package_info().version.to_string();
  let body = json!({
    "code": trimmed.to_uppercase(),
    "deviceId": device_id,
    "appVersion": version,
  });

  match post_json("/verify", body).await {
    Ok(data) => {
      let token = data.get("token").and_then(|v| v.as_str()).unwrap_or("");
      let expires_at = data.get("expiresAt").and_then(|v| v.as_i64()).unwrap_or(0);
      if token.is_empty() || expires_at == 0 {
        return Ok(json!({ "ok": false, "message": "验证失败" }));
      }
      write_session(
        &app,
        &UnlockSession {
          device_id,
          token: token.to_string(),
          expires_at,
          bound_code: Some(trimmed.to_uppercase()),
        },
      )?;
      Ok(json!({ "ok": true, "expiresAt": expires_at }))
    }
    Err(message) => Ok(json!({ "ok": false, "message": message })),
  }
}

#[tauri::command]
pub fn unlock_clear(app: AppHandle) -> Result<Value, String> {
  clear_session(&app)?;
  Ok(json!({ "ok": true }))
}

#[tauri::command]
pub fn unlock_open_external(app: AppHandle, payload: String) -> Result<Value, String> {
  let target = payload.trim().to_string();
  let lower = target.to_lowercase();
  if !(lower.starts_with("https://") || lower.starts_with("http://")) {
    return Err("仅允许打开 http/https 链接".into());
  }
  tauri_plugin_opener::OpenerExt::opener(&app)
    .open_url(&target, None::<&str>)
    .map_err(|e| e.to_string())?;
  Ok(json!({ "ok": true }))
}
