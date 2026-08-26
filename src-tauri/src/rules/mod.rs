mod adapters;
mod compare;
mod create;
mod health;
mod project_scan;
mod scan;
mod sync;
mod templates;
mod types;

use std::path::{Path, PathBuf};

use project_scan::RulesState;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

pub use project_scan::RulesState as RulesProjectState;

use adapters::get_allowed_roots;
use compare::compare_assets;
use create::create_rule_asset;
use health::analyze_health;
use project_scan::{get_project_allowed_roots, get_project_root, scan_project, set_project_root};
use scan::{read_asset_preview, scan_rules, write_asset_content};
use sync::sync_asset_to_tools;
use types::{
  CompareGroup, HealthReport, ReadPreviewResult, RuleAsset, ScanResult, SyncResultItem, WriteResult,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthPayload {
  tools: Option<Vec<types::ToolSummary>>,
  assets: Option<Vec<RuleAsset>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePayload {
  tool_id: String,
  template: String,
  slug: Option<String>,
  kind: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPayload {
  source_abs_path: String,
  source_tool_id: String,
  source_kind: String,
  source_rel_path: String,
  source_title: String,
  target_tool_ids: Vec<String>,
  overwrite: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReadOptions {
  full: Option<bool>,
  max_bytes: Option<usize>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRootResponse {
  project_root: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SuccessResponse {
  success: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickProjectResult {
  canceled: bool,
  project_root: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  tools: Option<Vec<types::ToolSummary>>,
  #[serde(skip_serializing_if = "Option::is_none")]
  assets: Option<Vec<RuleAsset>>,
  #[serde(skip_serializing_if = "Option::is_none")]
  scanned_at: Option<i64>,
}

fn canonical_or_resolve(path: &Path) -> PathBuf {
  path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

fn path_under_root(path: &Path, root: &Path) -> bool {
  let path = canonical_or_resolve(path);
  let root = canonical_or_resolve(root);
  path == root || path.starts_with(&root)
}

pub fn assert_allowed_path(abs_path: &str, state: &RulesState) -> Result<PathBuf, String> {
  let resolved = PathBuf::from(abs_path);
  let real = match resolved.canonicalize() {
    Ok(p) => p,
    Err(_) => {
      let parent = resolved.parent().ok_or("文件不存在或无法访问")?;
      let parent_real = parent.canonicalize().map_err(|_| "文件不存在或无法访问")?;
      parent_real.join(resolved.file_name().unwrap_or_default())
    }
  };

  let mut roots: Vec<PathBuf> = get_allowed_roots();
  roots.extend(get_project_allowed_roots(state));

  let real_roots: Vec<PathBuf> = roots
    .into_iter()
    .map(|r| r.canonicalize().unwrap_or(r))
    .collect();

  let check = real.canonicalize().unwrap_or_else(|_| real.clone());
  let ok = real_roots.iter().any(|root| path_under_root(&check, root));
  if !ok {
    return Err("路径不在允许的规则目录内".into());
  }
  Ok(real)
}

#[tauri::command]
pub fn rules_scan(payload: Option<Vec<String>>) -> Result<ScanResult, String> {
  scan_rules(payload)
}

#[tauri::command]
pub async fn rules_health(payload: Option<HealthPayload>) -> Result<HealthReport, String> {
  let (tools, assets) = if payload
    .as_ref()
    .and_then(|p| p.assets.as_ref())
    .map(|a| !a.is_empty())
    .unwrap_or(false)
  {
    let p = payload.unwrap();
    (
      p.tools.unwrap_or_default(),
      p.assets.unwrap_or_default(),
    )
  } else {
    let scan = scan_rules(None)?;
    (scan.tools, scan.assets)
  };
  Ok(analyze_health(tools, assets))
}

#[tauri::command]
pub fn rules_read(
  payload: Option<String>,
  args: Option<Vec<Value>>,
  state: State<'_, RulesState>,
) -> Result<ReadPreviewResult, String> {
  let (abs_path_owned, options): (String, ReadOptions) = if let Some(a) = args {
    let path = a
      .first()
      .and_then(|v| v.as_str())
      .ok_or("缺少文件路径")?
      .to_string();
    let opts = a
      .get(1)
      .and_then(|v| serde_json::from_value::<ReadOptions>(v.clone()).ok())
      .unwrap_or(ReadOptions {
        full: None,
        max_bytes: None,
      });
    (path, opts)
  } else {
    (
      payload.ok_or("缺少文件路径")?,
      ReadOptions {
        full: None,
        max_bytes: None,
      },
    )
  };
  let real = assert_allowed_path(&abs_path_owned, &state)?;
  read_asset_preview(
    &real.to_string_lossy(),
    options.full.unwrap_or(false),
    options.max_bytes,
  )
}

#[tauri::command]
pub fn rules_write(args: Vec<Value>, state: State<'_, RulesState>) -> Result<WriteResult, String> {
  let abs_path = args
    .first()
    .and_then(|v| v.as_str())
    .ok_or("缺少文件路径")?;
  let content = args.get(1).and_then(|v| v.as_str()).ok_or("缺少内容")?;
  let real = assert_allowed_path(abs_path, &state)?;
  write_asset_content(&real.to_string_lossy(), content)
}

#[tauri::command]
pub fn rules_reveal(payload: String, app: AppHandle, state: State<'_, RulesState>) -> Result<SuccessResponse, String> {
  let real = assert_allowed_path(&payload, &state)?;
  app
    .opener()
    .reveal_item_in_dir(&real)
    .map_err(|e| e.to_string())?;
  Ok(SuccessResponse { success: true })
}

#[tauri::command]
pub fn rules_open(payload: String, app: AppHandle, state: State<'_, RulesState>) -> Result<SuccessResponse, String> {
  let real = assert_allowed_path(&payload, &state)?;
  app
    .opener()
    .open_path(real.to_string_lossy().as_ref(), None::<&str>)
    .map_err(|e| e.to_string())?;
  Ok(SuccessResponse { success: true })
}

#[tauri::command]
pub fn rules_compare(payload: Option<Vec<RuleAsset>>) -> Result<Vec<CompareGroup>, String> {
  let list = match payload {
    Some(a) if !a.is_empty() => a,
    _ => scan_rules(None)?.assets,
  };
  Ok(compare_assets(list))
}

#[tauri::command]
pub fn rules_create(payload: CreatePayload) -> Result<RuleAsset, String> {
  create_rule_asset(
    &payload.tool_id,
    &payload.template,
    payload.slug.as_deref(),
    payload.kind.as_deref(),
  )
}

#[tauri::command]
pub fn rules_sync(payload: SyncPayload, state: State<'_, RulesState>) -> Result<Vec<SyncResultItem>, String> {
  assert_allowed_path(&payload.source_abs_path, &state)?;
  sync_asset_to_tools(
    &payload.source_abs_path,
    &payload.source_tool_id,
    &payload.source_kind,
    &payload.source_rel_path,
    &payload.source_title,
    payload.target_tool_ids,
    payload.overwrite.unwrap_or(false),
  )
}

#[tauri::command]
pub fn rules_get_project(state: State<'_, RulesState>) -> ProjectRootResponse {
  ProjectRootResponse {
    project_root: get_project_root(&state),
  }
}

#[tauri::command]
pub fn rules_clear_project(state: State<'_, RulesState>) -> ProjectRootResponse {
  set_project_root(&state, None);
  ProjectRootResponse {
    project_root: None,
  }
}

#[tauri::command]
pub fn rules_pick_project(app: AppHandle, state: State<'_, RulesState>) -> Result<PickProjectResult, String> {
  let picked = app
    .dialog()
    .file()
    .set_title("选择项目目录")
    .blocking_pick_folder();

  let Some(picked) = picked else {
    return Ok(PickProjectResult {
      canceled: true,
      project_root: get_project_root(&state),
      tools: None,
      assets: None,
      scanned_at: None,
    });
  };

  let root: PathBuf = picked.into_path().map_err(|_| "无效的项目目录".to_string())?;
  set_project_root(&state, Some(root.clone()));
  let scan = scan_project(&state, &root.to_string_lossy())?;
  Ok(PickProjectResult {
    canceled: false,
    project_root: Some(root.to_string_lossy().to_string()),
    tools: Some(scan.tools),
    assets: Some(scan.assets),
    scanned_at: Some(scan.scanned_at),
  })
}

#[tauri::command]
pub fn rules_scan_project(
  payload: Option<String>,
  state: State<'_, RulesState>,
) -> Result<ScanResult, String> {
  let root = payload.or_else(|| get_project_root(&state));
  let root = root.ok_or("尚未选择项目目录")?;
  scan_project(&state, &root)
}
