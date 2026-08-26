use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, State};

use crate::paths::migrate_file_if_needed;

pub struct HistoryDb(pub Mutex<Connection>);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryAddPayload {
  pub module_name: String,
  pub app_name: String,
  pub content: String,
  pub status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryListPayload {
  pub page: Option<u32>,
  pub page_size: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HistoryRow {
  id: i64,
  module_name: String,
  app_name: String,
  operation_time: i64,
  content: String,
  status: String,
}

fn now_ms() -> i64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis() as i64)
    .unwrap_or(0)
}

pub fn init_db(app: &AppHandle) -> Result<HistoryDb, String> {
  let path = migrate_file_if_needed(app, "data.db")?;
  let conn = Connection::open(path).map_err(|e| format!("open data.db: {e}"))?;
  conn
    .execute_batch(
      r#"
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        moduleName TEXT NOT NULL,
        appName TEXT NOT NULL,
        operationTime INTEGER NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL
      );
      PRAGMA encoding = 'UTF-8';
      "#,
    )
    .map_err(|e| format!("init schema: {e}"))?;
  Ok(HistoryDb(Mutex::new(conn)))
}

#[tauri::command]
pub fn history_add(db: State<'_, HistoryDb>, payload: HistoryAddPayload) -> Result<Value, String> {
  let conn = db.0.lock().map_err(|e| e.to_string())?;
  conn
    .execute(
      "INSERT INTO history (moduleName, appName, operationTime, content, status) VALUES (?1, ?2, ?3, ?4, ?5)",
      params![
        payload.module_name,
        payload.app_name,
        now_ms(),
        payload.content,
        payload.status
      ],
    )
    .map_err(|e| format!("添加历史记录失败: {e}"))?;
  let id = conn.last_insert_rowid();
  let row = conn
    .query_row(
      "SELECT id, moduleName, appName, operationTime, content, status FROM history WHERE id = ?1",
      params![id],
      |r| {
        Ok(HistoryRow {
          id: r.get(0)?,
          module_name: r.get(1)?,
          app_name: r.get(2)?,
          operation_time: r.get(3)?,
          content: r.get(4)?,
          status: r.get(5)?,
        })
      },
    )
    .map_err(|e| e.to_string())?;
  serde_json::to_value(row).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn history_list(db: State<'_, HistoryDb>, payload: HistoryListPayload) -> Result<Value, String> {
  let page = payload.page.unwrap_or(1).max(1);
  let page_size = payload.page_size.unwrap_or(10).clamp(1, 200);
  let offset = (page - 1) * page_size;

  let conn = db.0.lock().map_err(|e| e.to_string())?;
  let total: i64 = conn
    .query_row("SELECT COUNT(*) FROM history", [], |r| r.get(0))
    .map_err(|e| e.to_string())?;

  let mut stmt = conn
    .prepare(
      "SELECT id, moduleName, appName, operationTime, content, status FROM history ORDER BY operationTime DESC LIMIT ?1 OFFSET ?2",
    )
    .map_err(|e| e.to_string())?;

  let rows = stmt
    .query_map(params![page_size as i64, offset as i64], |r| {
      Ok(HistoryRow {
        id: r.get(0)?,
        module_name: r.get(1)?,
        app_name: r.get(2)?,
        operation_time: r.get(3)?,
        content: r.get(4)?,
        status: r.get(5)?,
      })
    })
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

  let total_pages = ((total as f64) / (page_size as f64)).ceil() as i64;
  Ok(json!({
    "records": rows,
    "pagination": {
      "total": total,
      "page": page,
      "pageSize": page_size,
      "totalPages": total_pages,
    }
  }))
}

#[tauri::command]
pub fn history_clear(db: State<'_, HistoryDb>, payload: i64) -> Result<bool, String> {
  let conn = db.0.lock().map_err(|e| e.to_string())?;
  let n = conn
    .execute("DELETE FROM history WHERE id = ?1", params![payload])
    .map_err(|e| e.to_string())?;
  Ok(n > 0)
}

#[tauri::command]
pub fn history_clear_all(db: State<'_, HistoryDb>) -> Result<Value, String> {
  let conn = db.0.lock().map_err(|e| e.to_string())?;
  let deleted = conn
    .execute("DELETE FROM history", [])
    .map_err(|e| e.to_string())?;
  Ok(json!({ "success": true, "deleted": deleted }))
}
