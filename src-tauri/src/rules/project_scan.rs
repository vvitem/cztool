use std::collections::HashSet;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use regex::Regex;

use super::types::{
  empty_counts, hash_content, make_asset_id, mtime_ms, normalize_slug, now_ms, title_from_content,
  AssetKind, RuleAsset, ScanResult, ToolSummary, HASH_BYTES,
};

const MAX_DEPTH: usize = 6;

const EXCLUDE: &[&str] = &[
  "node_modules",
  ".git",
  "dist",
  "build",
  "Cache",
  "cache",
  "vendor",
  ".next",
  "coverage",
];

const TOOL_DOT_DIRS: &[&str] = &[
  ".cursor",
  ".claude",
  ".codex",
  ".trae",
  ".trae-cn",
  ".qoder",
  ".qoder-cn",
];

pub struct RulesState(pub Mutex<Option<PathBuf>>);

pub fn get_project_root(state: &RulesState) -> Option<String> {
  state
    .0
    .lock()
    .ok()
    .and_then(|g| g.as_ref().map(|p| p.to_string_lossy().to_string()))
}

pub fn set_project_root(state: &RulesState, root: Option<PathBuf>) -> Option<String> {
  let mut guard = state.0.lock().ok()?;
  *guard = root.map(|r| r.canonicalize().unwrap_or(r));
  guard.as_ref().map(|p| p.to_string_lossy().to_string())
}

pub fn get_project_allowed_roots(state: &RulesState) -> Vec<PathBuf> {
  state
    .0
    .lock()
    .ok()
    .and_then(|g| g.clone())
    .into_iter()
    .collect()
}

fn path_exists(p: &Path) -> bool {
  p.exists()
}

fn infer_project_kind(rel_path: &str, file_name: &str) -> AssetKind {
  let p = rel_path.replace('\\', "/").to_lowercase();
  let f = file_name.to_lowercase();
  if f == "skill.md" || p.contains("/skills/") {
    return "skill".into();
  }
  if p.contains("/agents/") {
    return "agent".into();
  }
  if p.contains("/prompts/") || p.contains("/commands/") {
    return "prompt".into();
  }
  if f == "agents.md"
    || f == "claude.md"
    || f == ".cursorrules"
    || f.ends_with(".mdc")
    || p.contains("/rules/")
  {
    return "rule".into();
  }
  "other".into()
}

fn infer_tool_id(rel_path: &str) -> String {
  let p = rel_path.replace('\\', "/").to_lowercase();
  if p.starts_with(".cursor/") || p.contains("/.cursor/") {
    return "cursor".into();
  }
  if p.starts_with(".claude/") || p.contains("/.claude/") {
    return "claude".into();
  }
  if p.starts_with(".codex/") || p.contains("/.codex/") {
    return "codex".into();
  }
  if p.contains(".trae") {
    return "trae".into();
  }
  if p.contains(".qoder") {
    return "qoder".into();
  }
  "workspace".into()
}

fn should_collect(rel_path: &str, file_name: &str) -> bool {
  let p = rel_path.replace('\\', "/");
  let f = file_name.to_lowercase();
  if ["agents.md", "claude.md", ".cursorrules"].contains(&f.as_str()) && !p.contains('/') {
    return true;
  }
  static CURSOR_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
  let cursor_dir = CURSOR_RE.get_or_init(|| Regex::new(r"(?i)(^|/)\.cursor/rules/").unwrap());
  static MD_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
  let md_ext = MD_RE.get_or_init(|| Regex::new(r"(?i)\.(md|mdc)$").unwrap());
  if cursor_dir.is_match(&p) && md_ext.is_match(&f) {
    return true;
  }
  static CLAUDE_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
  let claude_dir = CLAUDE_RE.get_or_init(|| {
    Regex::new(r"(?i)(^|/)\.claude/(skills|agents|commands|rules)/").unwrap()
  });
  static CLAUDE_EXT: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
  let claude_ext = CLAUDE_EXT.get_or_init(|| Regex::new(r"(?i)\.(md|mdc|toml)$").unwrap());
  if claude_dir.is_match(&p) && claude_ext.is_match(&f) {
    return true;
  }
  static CODEX_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
  let codex = CODEX_RE
    .get_or_init(|| Regex::new(r"(?i)(^|/)\.codex/(prompts|agents|skills)/").unwrap());
  if codex.is_match(&p) {
    return true;
  }
  f == "skill.md"
}

fn build_asset(root_path: &Path, abs_path: &Path) -> Option<RuleAsset> {
  let meta = fs::metadata(abs_path).ok()?;
  if !meta.is_file() {
    return None;
  }
  let rel_path = abs_path.strip_prefix(root_path).ok()?.to_string_lossy().to_string();
  let file_name = abs_path.file_name()?.to_string_lossy().to_string();
  let tool_id = infer_tool_id(&rel_path);
  let kind = infer_project_kind(&rel_path, &file_name);
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
    id: make_asset_id(&format!("project:{tool_id}"), &abs_str),
    tool_id,
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

fn walk(root: &Path, dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
  if depth > MAX_DEPTH {
    return;
  }
  let exclude: HashSet<&str> = EXCLUDE.iter().copied().collect();
  let tool_dots: HashSet<&str> = TOOL_DOT_DIRS.iter().copied().collect();
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
      if name.starts_with('.') && !tool_dots.contains(name.as_str()) {
        continue;
      }
      walk(root, &path, depth + 1, out);
    } else if path.is_file() {
      out.push(path);
    }
  }
}

pub fn scan_project(state: &RulesState, root_path: &str) -> Result<ScanResult, String> {
  let root = PathBuf::from(root_path);
  let root = root.canonicalize().map_err(|_| "项目目录不存在")?;
  if !path_exists(&root) {
    return Err("项目目录不存在".into());
  }
  set_project_root(state, Some(root.clone()));

  let mut files: Vec<PathBuf> = Vec::new();
  walk(&root, &root, 0, &mut files);

  let mut assets: Vec<RuleAsset> = Vec::new();
  let mut seen: HashSet<String> = HashSet::new();

  for abs in files {
    let rel = abs.strip_prefix(&root).unwrap_or(&abs);
    let rel_str = rel.to_string_lossy().to_string();
    let name = abs.file_name().unwrap_or_default().to_string_lossy().to_string();
    if !should_collect(&rel_str, &name) {
      continue;
    }
    if let Some(asset) = build_asset(&root, &abs) {
      if seen.insert(asset.abs_path.clone()) {
        assets.push(asset);
      }
    }
  }

  for name in [
    "AGENTS.md",
    "CLAUDE.md",
    ".cursorrules",
    "agents.md",
    "claude.md",
  ] {
    let abs = root.join(name);
    if !path_exists(&abs) || seen.contains(abs.to_string_lossy().as_ref()) {
      continue;
    }
    if let Some(asset) = build_asset(&root, &abs) {
      seen.insert(asset.abs_path.clone());
      assets.push(asset);
    }
  }

  assets.sort_by(|a, b| b.mtime.partial_cmp(&a.mtime).unwrap_or(std::cmp::Ordering::Equal));

  let mut counts = empty_counts();
  for a in &assets {
    *counts.entry(a.kind.clone()).or_insert(0) += 1;
  }

  let label = root
    .file_name()
    .and_then(|s| s.to_str())
    .unwrap_or("当前项目")
    .to_string();

  let root_str = root.to_string_lossy().to_string();
  let tools = vec![ToolSummary {
    tool_id: "workspace".into(),
    label,
    roots: vec![root_str.clone()],
    present_roots: vec![root_str],
    detected: true,
    counts,
    total: assets.len() as u32,
  }];

  Ok(ScanResult {
    tools,
    assets,
    scanned_at: now_ms(),
  })
}
