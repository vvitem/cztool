use std::collections::HashSet;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use super::adapters::{all_adapters, infer_kind, resolve_root_path, should_include};
use super::types::{
  empty_counts, hash_content, make_asset_id, mtime_ms, normalize_slug, now_ms, title_from_content,
  AssetKind, RuleAsset, ScanResult, ToolSummary, HASH_BYTES,
};

const MAX_WALK_DEPTH: usize = 8;

fn path_exists(p: &Path) -> bool {
  p.exists()
}

fn walk_dir(
  root: &Path,
  dir: &Path,
  exclude: &HashSet<&str>,
  include_top_dirs: Option<&[&str]>,
  depth: usize,
  out: &mut Vec<PathBuf>,
) {
  if depth > MAX_WALK_DEPTH {
    return;
  }
  let entries = match fs::read_dir(dir) {
    Ok(e) => e,
    Err(_) => return,
  };
  for entry in entries.flatten() {
    let path = entry.path();
    let name = entry.file_name().to_string_lossy().to_string();
    if path.is_dir() {
      if exclude.contains(name.as_str()) {
        continue;
      }
      if depth == 0 {
        if let Some(tops) = include_top_dirs {
          if !tops.contains(&name.as_str()) {
            continue;
          }
        }
      }
      if name.starts_with('.') && name != ".cursor" && name != ".agents" {
        continue;
      }
      walk_dir(root, &path, exclude, include_top_dirs, depth + 1, out);
    } else if path.is_file() {
      out.push(path);
    }
  }
}

fn build_asset(
  tool_id: &str,
  root_path: &Path,
  abs_path: &Path,
  kind: AssetKind,
) -> Option<RuleAsset> {
  let meta = fs::metadata(abs_path).ok()?;
  if !meta.is_file() {
    return None;
  }
  let rel_path = abs_path.strip_prefix(root_path).ok()?.to_string_lossy().to_string();
  let file_name = abs_path.file_name()?.to_string_lossy().to_string();
  let abs_str = abs_path.to_string_lossy().to_string();
  let root_str = root_path.to_string_lossy().to_string();

  let mut head = String::new();
  let mut content_hash = None;
  if let Ok(mut file) = fs::File::open(abs_path) {
    let read_len = HASH_BYTES.min(meta.len() as usize);
    let mut buf = vec![0u8; read_len];
    if let Ok(n) = file.read(&mut buf) {
      buf.truncate(n);
      content_hash = Some(hash_content(&buf));
      head = String::from_utf8_lossy(&buf).to_string();
    }
  }

  Some(RuleAsset {
    id: make_asset_id(tool_id, &abs_str),
    tool_id: tool_id.to_string(),
    kind,
    title: title_from_content(&file_name, &rel_path, &head),
    slug: normalize_slug(&file_name, &rel_path),
    abs_path: abs_str,
    rel_path,
    root_path: root_str,
    size: meta.len(),
    mtime: mtime_ms(&meta),
    content_hash,
  })
}

pub fn scan_rules(tool_ids: Option<Vec<String>>) -> Result<ScanResult, String> {
  let adapters: Vec<_> = match tool_ids {
    Some(ids) if !ids.is_empty() => all_adapters()
      .into_iter()
      .filter(|a| ids.contains(&a.id.to_string()))
      .collect(),
    _ => all_adapters(),
  };

  let mut assets: Vec<RuleAsset> = Vec::new();
  let mut tools: Vec<ToolSummary> = Vec::new();

  for adapter in adapters {
    let roots: Vec<PathBuf> = (adapter.roots)()
      .into_iter()
      .map(|r| r.canonicalize().unwrap_or(r))
      .collect();
    let mut present_roots: Vec<String> = Vec::new();
    let exclude: HashSet<&str> = adapter.exclude_dir_names.iter().copied().collect();
    let mut tool_assets: Vec<RuleAsset> = Vec::new();

    for root in &roots {
      if !path_exists(root) {
        continue;
      }
      present_roots.push(resolve_root_path(root));
      let mut files: Vec<PathBuf> = Vec::new();
      walk_dir(
        root,
        root,
        &exclude,
        adapter.include_top_dirs,
        0,
        &mut files,
      );

      for abs in files {
        let rel = abs.strip_prefix(root).unwrap_or(&abs);
        let rel_str = rel.to_string_lossy().to_string();
        let name = abs.file_name().unwrap_or_default().to_string_lossy().to_string();
        if !should_include(adapter.id, &abs.to_string_lossy(), &rel_str, &name) {
          continue;
        }
        let kind = infer_kind(adapter.id, &rel_str, &name);
        if let Some(asset) = build_asset(adapter.id, root, &abs, kind) {
          tool_assets.push(asset);
        }
      }
    }

    let mut counts = empty_counts();
    for a in &tool_assets {
      *counts.entry(a.kind.clone()).or_insert(0) += 1;
    }

    let detected = !present_roots.is_empty();
    tools.push(ToolSummary {
      tool_id: adapter.id.to_string(),
      label: adapter.label.to_string(),
      roots: roots.iter().map(|r| resolve_root_path(r)).collect(),
      present_roots,
      detected,
      counts,
      total: tool_assets.len() as u32,
    });
    assets.extend(tool_assets);
  }

  assets.sort_by(|a, b| b.mtime.partial_cmp(&a.mtime).unwrap_or(std::cmp::Ordering::Equal));

  Ok(ScanResult {
    tools,
    assets,
    scanned_at: now_ms(),
  })
}

pub fn read_asset_preview(
  abs_path: &str,
  full: bool,
  max_bytes: Option<usize>,
) -> Result<super::types::ReadPreviewResult, String> {
  let resolved = PathBuf::from(abs_path);
  let meta = fs::metadata(&resolved).map_err(|_| "无法读取文件".to_string())?;
  let file_size = meta.len() as usize;
  let limit = if full {
    file_size.min(2 * 1024 * 1024)
  } else {
    file_size.min(max_bytes.unwrap_or(256 * 1024))
  };
  let mut file = fs::File::open(&resolved).map_err(|e| e.to_string())?;
  let mut buf = vec![0u8; limit];
  let n = file.read(&mut buf).map_err(|e| e.to_string())?;
  buf.truncate(n);
  let text = String::from_utf8_lossy(&buf).to_string();
  Ok(super::types::ReadPreviewResult {
    abs_path: resolved.to_string_lossy().to_string(),
    truncated: file_size > limit,
    size: meta.len(),
    content: text,
  })
}

pub fn write_asset_content(abs_path: &str, content: &str) -> Result<super::types::WriteResult, String> {
  if content.len() > 2 * 1024 * 1024 {
    return Err("文件过大，无法在应用内保存（上限 2MB）".into());
  }
  let resolved = PathBuf::from(abs_path);
  fs::write(&resolved, content).map_err(|e| e.to_string())?;
  let meta = fs::metadata(&resolved).map_err(|e| e.to_string())?;
  Ok(super::types::WriteResult {
    abs_path: resolved.to_string_lossy().to_string(),
    size: meta.len(),
    mtime: mtime_ms(&meta),
  })
}
