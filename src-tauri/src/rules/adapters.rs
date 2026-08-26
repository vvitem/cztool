use std::path::{Path, PathBuf};

use regex::Regex;

use super::types::{home, norm_slash, AssetKind};

const COMMON_EXCLUDE: &[&str] = &[
  "extensions",
  "node_modules",
  ".git",
  "Cache",
  "cache",
  "logs",
  "CachedData",
  "GPUCache",
  "Code Cache",
  "blob_storage",
  "Crashpad",
  "dist",
  "vendor_imports",
];

pub struct ToolAdapter {
  pub id: &'static str,
  pub label: &'static str,
  pub roots: fn() -> Vec<PathBuf>,
  pub exclude_dir_names: &'static [&'static str],
  pub include_top_dirs: Option<&'static [&'static str]>,
}

fn ext_ok(file_name: &str) -> bool {
  static RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
  let re = RE.get_or_init(|| Regex::new(r"(?i)\.(mdc|md|toml|txt)$").unwrap());
  re.is_match(file_name)
}

pub fn kind_from_path(rel_path: &str, file_name: &str, fallback: &str) -> AssetKind {
  let p = norm_slash(rel_path).to_lowercase();
  let f = file_name.to_lowercase();
  if f == "skill.md"
    || p.contains("/skills/")
    || p.contains("/skills-cursor/")
    || p.contains("/builtin_skills/")
  {
    return "skill".into();
  }
  if p.contains("/agents/") || (f.ends_with(".toml") && p.contains("agent")) {
    return "agent".into();
  }
  if p.contains("/prompts/") || p.contains("/commands/") {
    return "prompt".into();
  }
  if p.contains("/rules/")
    || f.ends_with(".mdc")
    || f == "user_rules.md"
    || f == "claude.md"
    || f == "agents.md"
  {
    return "rule".into();
  }
  if f.ends_with(".toml") {
    return "agent".into();
  }
  fallback.into()
}

fn include_markdownish(_abs: &str, rel_path: &str, file_name: &str) -> bool {
  if !ext_ok(file_name) {
    return false;
  }
  let p = norm_slash(rel_path);
  static SKIP_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
  let skip = SKIP_RE.get_or_init(|| {
    Regex::new(r"(?i)(^|/)(readme|changelog|license|security|support|contributing)\.md$").unwrap()
  });
  if skip.is_match(file_name) {
    static KEEP_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    let keep = KEEP_RE.get_or_init(|| {
      Regex::new(
        r"(?i)(^|/)(rules|skills|skills-cursor|agents|prompts|commands|builtin_skills)(/|$)",
      )
      .unwrap()
    });
    if !keep.is_match(&p) {
      return false;
    }
  }
  true
}

static SKILLS_PATH_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
fn skills_path_re() -> &'static Regex {
  SKILLS_PATH_RE.get_or_init(|| Regex::new(r"(?i)(^|/)skills/").unwrap())
}

pub fn should_include(adapter_id: &str, abs: &str, rel: &str, name: &str) -> bool {
  let p = norm_slash(rel);
  match adapter_id {
    "cursor" => {
      include_markdownish(abs, rel, name)
        && (p.starts_with("rules/")
          || p.starts_with("skills-cursor/")
          || p.starts_with("agents/")
          || skills_path_re().is_match(&p))
    }
    "claude" => {
      if !include_markdownish(abs, rel, name) {
        return false;
      }
      let f = name.to_lowercase();
      f == "claude.md"
        || f == "agents.md"
        || p.contains("/rules/")
        || p.starts_with("rules/")
        || p.contains("/skills/")
        || p.starts_with("skills/")
        || p.contains("/agents/")
        || p.starts_with("agents/")
        || p.contains("/commands/")
        || p.starts_with("commands/")
        || f == "skill.md"
    }
    "codex" => {
      static TOML_RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
      let toml = TOML_RE.get_or_init(|| Regex::new(r"(?i)\.toml$").unwrap());
      if !include_markdownish(abs, rel, name) && !toml.is_match(name) {
        return false;
      }
      p.starts_with("prompts/")
        || p.starts_with("agents/")
        || p.starts_with("skills/")
        || skills_path_re().is_match(&p)
    }
    "trae" => {
      if !include_markdownish(abs, rel, name) {
        return false;
      }
      let f = name.to_lowercase();
      f == "user_rules.md"
        || p.contains("builtin_skills/")
        || p.contains("/rules/")
        || p.contains("/skills/")
        || f == "skill.md"
    }
    "qoder" => {
      if !include_markdownish(abs, rel, name) {
        return false;
      }
      p.contains("/skills/")
        || p.starts_with("skills/")
        || p.contains("/rules/")
        || p.contains("canvas/recipes/")
        || name.eq_ignore_ascii_case("skill.md")
    }
    _ => false,
  }
}

pub fn infer_kind(adapter_id: &str, rel: &str, name: &str) -> AssetKind {
  match adapter_id {
    "cursor" => kind_from_path(rel, name, "rule"),
    "claude" => kind_from_path(rel, name, "other"),
    "codex" => kind_from_path(rel, name, "prompt"),
    "trae" => kind_from_path(rel, name, "rule"),
    "qoder" => {
      if norm_slash(rel).contains("canvas/recipes/") {
        "prompt".into()
      } else {
        kind_from_path(rel, name, "skill")
      }
    }
    _ => "other".into(),
  }
}

pub fn all_adapters() -> Vec<ToolAdapter> {
  vec![
    ToolAdapter {
      id: "cursor",
      label: "Cursor",
      roots: || vec![home(&[".cursor"])],
      exclude_dir_names: &[
        "extensions",
        "node_modules",
        ".git",
        "Cache",
        "cache",
        "logs",
        "CachedData",
        "GPUCache",
        "Code Cache",
        "blob_storage",
        "Crashpad",
        "dist",
        "vendor_imports",
        "projects",
        "ai-tracking",
        "browser-logs",
      ],
      include_top_dirs: Some(&["rules", "skills-cursor", "agents", "skills"]),
    },
    ToolAdapter {
      id: "claude",
      label: "Claude Code",
      roots: || vec![home(&[".claude"])],
      exclude_dir_names: &[
        "extensions",
        "node_modules",
        ".git",
        "Cache",
        "cache",
        "logs",
        "CachedData",
        "GPUCache",
        "Code Cache",
        "blob_storage",
        "Crashpad",
        "dist",
        "vendor_imports",
        "debug",
        "statsig",
        "telemetry",
        "file-history",
        "shell-snapshots",
        "session-env",
        "projects",
        "todos",
        "plans",
        "plugins",
      ],
      include_top_dirs: Some(&[
        "skills",
        "agents",
        "commands",
        "rules",
        ".cursor",
        ".agents",
      ]),
    },
    ToolAdapter {
      id: "codex",
      label: "Codex",
      roots: || vec![home(&[".codex"])],
      exclude_dir_names: &[
        "extensions",
        "node_modules",
        ".git",
        "Cache",
        "cache",
        "logs",
        "CachedData",
        "GPUCache",
        "Code Cache",
        "blob_storage",
        "Crashpad",
        "dist",
        "vendor_imports",
        "tmp",
        "sessions",
        "memories",
      ],
      include_top_dirs: Some(&["prompts", "agents", "skills"]),
    },
    ToolAdapter {
      id: "trae",
      label: "Trae",
      roots: || {
        vec![
          home(&[".trae"]),
          home(&[".trae-cn"]),
          home(&[".trae-aicc"]),
        ]
      },
      exclude_dir_names: COMMON_EXCLUDE,
      include_top_dirs: Some(&["builtin_skills", "rules", "skills"]),
    },
    ToolAdapter {
      id: "qoder",
      label: "Qoder",
      roots: || {
        vec![
          home(&[".qoder"]),
          home(&[".qoder-cn"]),
          home(&[".qodersec"]),
        ]
      },
      exclude_dir_names: COMMON_EXCLUDE,
      include_top_dirs: Some(&["skills", "rules", "canvas"]),
    },
  ]
}

pub fn get_adapter(tool_id: &str) -> Option<ToolAdapter> {
  all_adapters().into_iter().find(|a| a.id == tool_id)
}

pub fn get_allowed_roots() -> Vec<PathBuf> {
  let mut roots = Vec::new();
  for adapter in all_adapters() {
    for r in (adapter.roots)() {
      roots.push(r.canonicalize().unwrap_or(r));
    }
  }
  roots
}

pub fn resolve_root_path(root: &Path) -> String {
  root.canonicalize()
    .unwrap_or_else(|_| root.to_path_buf())
    .to_string_lossy()
    .to_string()
}
