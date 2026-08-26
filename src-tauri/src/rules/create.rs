use std::fs;
use std::path::PathBuf;

use super::adapters::{get_adapter, resolve_root_path};
use super::templates::{get_template_content, template_file_name};
use super::types::{
  hash_content, make_asset_id, mtime_ms, normalize_slug, title_from_content, AssetKind, RuleAsset,
};

fn kind_for_template(template: &str) -> AssetKind {
  if template == "skill" {
    "skill".into()
  } else {
    "rule".into()
  }
}

pub fn create_rule_asset(
  tool_id: &str,
  template: &str,
  slug: Option<&str>,
  kind: Option<&str>,
) -> Result<RuleAsset, String> {
  let adapter = get_adapter(tool_id).ok_or("未知工具")?;
  let roots: Vec<PathBuf> = (adapter.roots)()
    .into_iter()
    .map(|r| r.canonicalize().unwrap_or(r))
    .collect();

  let mut root = roots.first().cloned().ok_or("未找到工具配置目录")?;
  for r in &roots {
    if r.exists() {
      root = r.clone();
      break;
    }
  }

  let _ = fs::create_dir_all(&root);
  let slug_str = slug.unwrap_or("untitled").trim();
  let (rel_dir, file_name) = template_file_name(template, slug_str);
  let dir = if rel_dir.is_empty() {
    root.clone()
  } else {
    root.join(&rel_dir)
  };
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let abs_path = dir.join(&file_name);
  if abs_path.exists() {
    let rel = abs_path.strip_prefix(&root).unwrap_or(&abs_path);
    return Err(format!("文件已存在：{}", rel.to_string_lossy()));
  }

  let content = get_template_content(template, slug_str);
  fs::write(&abs_path, &content).map_err(|e| e.to_string())?;
  let meta = fs::metadata(&abs_path).map_err(|e| e.to_string())?;
  let rel_path = abs_path
    .strip_prefix(&root)
    .unwrap_or(&abs_path)
    .to_string_lossy()
    .to_string();
  let kind = kind
    .map(String::from)
    .unwrap_or_else(|| kind_for_template(template));
  let abs_str = abs_path.to_string_lossy().to_string();

  Ok(RuleAsset {
    id: make_asset_id(tool_id, &abs_str),
    tool_id: tool_id.to_string(),
    kind,
    title: title_from_content(&file_name, &rel_path, &content),
    slug: normalize_slug(&file_name, &rel_path),
    abs_path: abs_str,
    rel_path,
    root_path: resolve_root_path(&root),
    size: meta.len(),
    mtime: mtime_ms(&meta),
    content_hash: Some(hash_content(content.as_bytes())),
  })
}
