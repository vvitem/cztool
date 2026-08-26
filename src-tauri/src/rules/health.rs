use std::collections::{HashMap, HashSet};

use super::types::{now_ms, HealthIssue, HealthReport, RuleAsset, ToolSummary};

const OVERSIZE_BYTES: u64 = 30 * 1024;

fn empty_by_type() -> HashMap<String, u32> {
  let mut m = HashMap::new();
  for k in ["oversized", "drift", "duplicate", "missing-entry"] {
    m.insert(k.to_string(), 0);
  }
  m
}

pub fn analyze_health(tools: Vec<ToolSummary>, assets: Vec<RuleAsset>) -> HealthReport {
  let mut issues: Vec<HealthIssue> = Vec::new();

  for asset in &assets {
    if asset.size > OVERSIZE_BYTES {
      issues.push(HealthIssue {
        id: format!("oversized:{}", asset.id),
        issue_type: "oversized".into(),
        severity: "info".into(),
        title: format!("过大：{}", asset.title),
        message: format!(
          "{} KB，建议拆分或精简（阈值 30KB）",
          (asset.size as f64 / 1024.0).round()
        ),
        asset_ids: vec![asset.id.clone()],
        slug: Some(asset.slug.clone()),
      });
    }
  }

  let mut by_slug: HashMap<String, Vec<&RuleAsset>> = HashMap::new();
  for asset in &assets {
    by_slug.entry(asset.slug.clone()).or_default().push(asset);
  }

  for (slug, list) in &by_slug {
    let tool_ids: HashSet<_> = list.iter().map(|a| a.tool_id.as_str()).collect();
    if tool_ids.len() < 2 {
      continue;
    }
    let hashes: Vec<&str> = list
      .iter()
      .filter_map(|a| a.content_hash.as_deref())
      .collect();
    if hashes.len() < 2 {
      continue;
    }
    let unique: HashSet<_> = hashes.iter().copied().collect();
    if unique.len() > 1 {
      let tool_list: Vec<String> = tool_ids.into_iter().map(String::from).collect();
      issues.push(HealthIssue {
        id: format!("drift:{slug}"),
        issue_type: "drift".into(),
        severity: "warn".into(),
        title: format!("内容漂移：{}", list.first().map(|a| a.title.as_str()).unwrap_or(slug)),
        message: format!("在 {} 中同名但内容不一致", tool_list.join(" / ")),
        asset_ids: list.iter().map(|a| a.id.clone()).collect(),
        slug: Some(slug.clone()),
      });
    }
  }

  let mut by_hash: HashMap<String, Vec<&RuleAsset>> = HashMap::new();
  for asset in &assets {
    if let Some(h) = &asset.content_hash {
      by_hash.entry(h.clone()).or_default().push(asset);
    }
  }
  for (hash, list) in &by_hash {
    if list.len() < 2 {
      continue;
    }
    let paths: HashSet<_> = list.iter().map(|a| a.abs_path.as_str()).collect();
    if paths.len() < 2 {
      continue;
    }
    issues.push(HealthIssue {
      id: format!("dup:{hash}"),
      issue_type: "duplicate".into(),
      severity: "info".into(),
      title: format!(
        "疑似重复：{}",
        list.first().map(|a| a.title.as_str()).unwrap_or(hash)
      ),
      message: format!("{} 处内容哈希相同", list.len()),
      asset_ids: list.iter().map(|a| a.id.clone()).collect(),
      slug: list.first().map(|a| a.slug.clone()),
    });
  }

  let entry_hints: HashMap<&str, (&[&str], &str)> = [
    ("claude", (&["claude.md", "agents.md"][..], "CLAUDE.md / AGENTS.md")),
    ("cursor", (&["agents.md"][..], "AGENTS.md（可选）")),
    ("codex", (&["agents.md"][..], "AGENTS.md（可选）")),
  ]
  .into_iter()
  .collect();

  for tool in &tools {
    if !tool.detected {
      continue;
    }
    let Some((names, label)) = entry_hints.get(tool.tool_id.as_str()) else {
      continue;
    };
    let tool_assets: Vec<_> = assets.iter().filter(|a| a.tool_id == tool.tool_id).collect();
    let has_entry = tool_assets.iter().any(|a| {
      let base = a
        .rel_path
        .replace('\\', "/")
        .split('/')
        .next_back()
        .unwrap_or("")
        .to_lowercase();
      names.iter().any(|n| *n == base)
    });
    if !has_entry && tool.tool_id == "claude" {
      issues.push(HealthIssue {
        id: format!("missing:{}", tool.tool_id),
        issue_type: "missing-entry".into(),
        severity: "info".into(),
        title: format!("缺少入口：{}", tool.label),
        message: format!("已检测到目录，但未找到 {label}"),
        asset_ids: vec![],
        slug: None,
      });
    }
  }

  let mut by_type = empty_by_type();
  for issue in &issues {
    *by_type.entry(issue.issue_type.clone()).or_insert(0) += 1;
  }

  issues.sort_by(|a, b| {
    if a.severity != b.severity {
      return if a.severity == "warn" {
        std::cmp::Ordering::Less
      } else {
        std::cmp::Ordering::Greater
      };
    }
    a.title.cmp(&b.title)
  });

  HealthReport {
    scanned_at: now_ms(),
    issue_count: issues.len() as u32,
    by_type,
    issues,
  }
}
