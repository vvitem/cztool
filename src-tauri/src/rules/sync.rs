use std::fs;
use std::path::{Path, PathBuf};

use super::adapters::{get_adapter, resolve_root_path};
use super::types::{
  hash_content, make_asset_id, mtime_ms, normalize_slug, title_from_content, RuleAsset,
  SyncResultItem,
};

fn target_rel_path(kind: &str, source_rel_path: &str, source_title: &str) -> PathBuf {
  let base = Path::new(source_rel_path)
    .file_name()
    .and_then(|s| s.to_str())
    .unwrap_or(source_rel_path);
  let lower = base.to_lowercase();

  if kind == "skill" || lower == "skill.md" {
    let folder = if lower == "skill.md" {
      Path::new(source_rel_path)
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|s| s.to_str())
        .unwrap_or(base)
        .to_string()
    } else {
      regex::Regex::new(r"(?i)\.(md|mdc)$")
        .unwrap()
        .replace(base, "")
        .to_string()
    };
    return PathBuf::from("skills").join(folder).join("SKILL.md");
  }
  if kind == "agent" {
    return PathBuf::from("agents").join(base);
  }
  if kind == "prompt" {
    return PathBuf::from("prompts").join(base);
  }
  if lower == "agents.md" || lower == "claude.md" {
    return PathBuf::from(base);
  }
  if lower.ends_with(".mdc") {
    return PathBuf::from("rules").join(base);
  }
  let name = regex::Regex::new(r"(?i)\.(md|txt)$")
    .unwrap()
    .replace(base, "")
    .to_string();
  let name = if name.is_empty() {
    source_title.to_string()
  } else {
    name
  };
  PathBuf::from("rules").join(format!("{name}.md"))
}

pub fn sync_asset_to_tools(
  source_abs_path: &str,
  source_tool_id: &str,
  source_kind: &str,
  source_rel_path: &str,
  source_title: &str,
  target_tool_ids: Vec<String>,
  overwrite: bool,
) -> Result<Vec<SyncResultItem>, String> {
  let content = fs::read_to_string(source_abs_path).map_err(|e| e.to_string())?;
  let mut results: Vec<SyncResultItem> = Vec::new();

  for tool_id in target_tool_ids {
    if tool_id == source_tool_id {
      results.push(SyncResultItem {
        tool_id,
        abs_path: source_abs_path.to_string(),
        skipped: Some(true),
        reason: Some("源工具跳过".into()),
        asset: None,
      });
      continue;
    }
    let Some(adapter) = get_adapter(&tool_id) else {
      results.push(SyncResultItem {
        tool_id,
        abs_path: String::new(),
        skipped: Some(true),
        reason: Some("未知工具".into()),
        asset: None,
      });
      continue;
    };

    let roots: Vec<PathBuf> = (adapter.roots)()
      .into_iter()
      .map(|r| r.canonicalize().unwrap_or(r))
      .collect();
    let mut root = roots.first().cloned();
    for r in &roots {
      if r.exists() {
        root = Some(r.clone());
        break;
      }
    }
    let Some(root) = root else {
      results.push(SyncResultItem {
        tool_id,
        abs_path: String::new(),
        skipped: Some(true),
        reason: Some("目录不存在".into()),
        asset: None,
      });
      continue;
    };

    let _ = fs::create_dir_all(&root);
    let rel = target_rel_path(source_kind, source_rel_path, source_title);
    let abs_path = root.join(&rel);

    if abs_path.exists() && !overwrite {
      results.push(SyncResultItem {
        tool_id: tool_id.clone(),
        abs_path: abs_path.to_string_lossy().to_string(),
        skipped: Some(true),
        reason: Some("目标已存在".into()),
        asset: None,
      });
      continue;
    }

    if let Some(parent) = abs_path.parent() {
      let _ = fs::create_dir_all(parent);
    }
    fs::write(&abs_path, &content).map_err(|e| e.to_string())?;
    let meta = fs::metadata(&abs_path).map_err(|e| e.to_string())?;
    let file_name = abs_path
      .file_name()
      .and_then(|s| s.to_str())
      .unwrap_or("")
      .to_string();
    let rel_str = rel.to_string_lossy().to_string();
    let abs_str = abs_path.to_string_lossy().to_string();

    let asset = RuleAsset {
      id: make_asset_id(&tool_id, &abs_str),
      tool_id: tool_id.clone(),
      kind: source_kind.to_string(),
      title: title_from_content(&file_name, &rel_str, &content),
      slug: normalize_slug(&file_name, &rel_str),
      abs_path: abs_str.clone(),
      rel_path: rel_str,
      root_path: resolve_root_path(&root),
      size: meta.len(),
      mtime: mtime_ms(&meta),
      content_hash: Some(hash_content(content.as_bytes())),
    };
    results.push(SyncResultItem {
      tool_id,
      abs_path: abs_str,
      skipped: None,
      reason: None,
      asset: Some(asset),
    });
  }

  Ok(results)
}
