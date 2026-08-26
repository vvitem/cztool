use std::collections::HashMap;
use std::path::{Path, PathBuf};

use regex::Regex;
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use sha2::Sha256;

pub const HASH_BYTES: usize = 64 * 1024;

pub type ToolId = String;
pub type AssetKind = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleAsset {
  pub id: String,
  pub tool_id: ToolId,
  pub kind: AssetKind,
  pub title: String,
  pub slug: String,
  pub abs_path: String,
  pub rel_path: String,
  pub root_path: String,
  pub size: u64,
  pub mtime: f64,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub content_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolSummary {
  pub tool_id: ToolId,
  pub label: String,
  pub roots: Vec<String>,
  pub present_roots: Vec<String>,
  pub detected: bool,
  pub counts: HashMap<String, u32>,
  pub total: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
  pub tools: Vec<ToolSummary>,
  pub assets: Vec<RuleAsset>,
  pub scanned_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareGroup {
  pub slug: String,
  pub title: String,
  pub tool_ids: Vec<ToolId>,
  pub assets: Vec<RuleAsset>,
  pub same_content: bool,
  pub match_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthIssue {
  pub id: String,
  #[serde(rename = "type")]
  pub issue_type: String,
  pub severity: String,
  pub title: String,
  pub message: String,
  pub asset_ids: Vec<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub slug: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthReport {
  pub scanned_at: i64,
  pub issue_count: u32,
  pub by_type: HashMap<String, u32>,
  pub issues: Vec<HealthIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResultItem {
  pub tool_id: ToolId,
  pub abs_path: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub skipped: Option<bool>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub reason: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub asset: Option<RuleAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadPreviewResult {
  pub abs_path: String,
  pub truncated: bool,
  pub size: u64,
  pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteResult {
  pub abs_path: String,
  pub size: u64,
  pub mtime: f64,
}

pub fn home_dir() -> PathBuf {
  dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
}

pub fn home(parts: &[&str]) -> PathBuf {
  let mut p = home_dir();
  for part in parts {
    p.push(part);
  }
  p
}

pub fn make_asset_id(tool_id: &str, abs_path: &str) -> String {
  let mut hasher = Sha1::new();
  hasher.update(format!("{tool_id}:{abs_path}").as_bytes());
  let hex = format!("{:x}", hasher.finalize());
  hex[..16.min(hex.len())].to_string()
}

pub fn hash_content(data: &[u8]) -> String {
  let mut hasher = Sha256::new();
  hasher.update(data);
  let hex = format!("{:x}", hasher.finalize());
  hex[..16.min(hex.len())].to_string()
}

pub fn norm_slash(s: &str) -> String {
  s.replace('\\', "/")
}

pub fn empty_counts() -> HashMap<String, u32> {
  let mut m = HashMap::new();
  for k in ["rule", "skill", "agent", "prompt", "other"] {
    m.insert(k.to_string(), 0);
  }
  m
}

pub fn normalize_slug(file_name: &str, rel_path: &str) -> String {
  let base = Path::new(file_name)
    .file_name()
    .and_then(|s| s.to_str())
    .unwrap_or(file_name);

  let name = if base.eq_ignore_ascii_case("skill.md") {
    Path::new(rel_path)
      .parent()
      .and_then(|p| p.file_name())
      .and_then(|s| s.to_str())
      .unwrap_or(base)
      .to_string()
  } else {
    static EXT_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    let re = EXT_RE.get_or_init(|| Regex::new(r"(?i)\.(mdc|md|toml|txt)$").unwrap());
    re.replace(base, "").to_string()
  };

  let lowered = name.to_lowercase();
  static TM_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
  let tm = TM_RE.get_or_init(|| Regex::new(r"(?i)\(r\)|\(tm\)").unwrap());
  let lowered = tm.replace_all(&lowered, "").to_string();
  static NON_WORD: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
  let non = NON_WORD.get_or_init(|| Regex::new(r"[^a-z0-9\u{4e00}-\u{9fff}]+").unwrap());
  let mut result = non.replace_all(&lowered, "-").to_string();
  result = result.trim_matches('-').to_string();
  if result.is_empty() {
    "untitled".to_string()
  } else {
    result
  }
}

pub fn title_from_content(file_name: &str, rel_path: &str, head: &str) -> String {
  static FM_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
  let fm_re = FM_RE.get_or_init(|| Regex::new(r"(?s)^---\s*\n(.*?)\n---").unwrap());
  if let Some(fm) = fm_re.captures(head) {
    static NAME_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    let name_re = NAME_RE
      .get_or_init(|| Regex::new(r#"(?mi)^(?:name|title)\s*:\s*["']?(.+?)["']?\s*$"#).unwrap());
    if let Some(cap) = name_re.captures(fm.get(1).map(|m| m.as_str()).unwrap_or("")) {
      if let Some(m) = cap.get(1) {
        return m.as_str().trim().to_string();
      }
    }
  }

  static HEADING_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
  let heading_re = HEADING_RE.get_or_init(|| Regex::new(r"(?m)^#\s+(.+)$").unwrap());
  if let Some(cap) = heading_re.captures(head) {
    if let Some(m) = cap.get(1) {
      return m.as_str().trim().to_string();
    }
  }

  if file_name.eq_ignore_ascii_case("skill.md") {
    return Path::new(rel_path)
      .parent()
      .and_then(|p| p.file_name())
      .and_then(|s| s.to_str())
      .unwrap_or(file_name)
      .to_string();
  }

  static EXT_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
  let re = EXT_RE.get_or_init(|| Regex::new(r"(?i)\.(mdc|md|toml|txt)$").unwrap());
  re.replace(file_name, "").to_string()
}

pub fn mtime_ms(meta: &std::fs::Metadata) -> f64 {
  meta
    .modified()
    .ok()
    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
    .map(|d| d.as_secs_f64() * 1000.0)
    .unwrap_or(0.0)
}

pub fn now_ms() -> i64 {
  std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis() as i64)
    .unwrap_or(0)
}
