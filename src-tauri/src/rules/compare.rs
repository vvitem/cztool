use std::collections::HashMap;

use super::types::{CompareGroup, RuleAsset};

pub fn compare_assets(assets: Vec<RuleAsset>) -> Vec<CompareGroup> {
  let mut by_slug: HashMap<String, Vec<RuleAsset>> = HashMap::new();
  for asset in assets {
    by_slug.entry(asset.slug.clone()).or_default().push(asset);
  }

  let mut groups: Vec<CompareGroup> = Vec::new();

  for (slug, list) in by_slug {
    let tool_ids: Vec<String> = list
      .iter()
      .map(|a| a.tool_id.clone())
      .collect::<std::collections::HashSet<_>>()
      .into_iter()
      .collect();
    let hashes: Vec<&str> = list
      .iter()
      .filter_map(|a| a.content_hash.as_deref())
      .collect();
    let unique_hashes: std::collections::HashSet<_> = hashes.iter().copied().collect();
    let same_content = hashes.len() >= 2 && unique_hashes.len() == 1;

    let match_type = if tool_ids.len() > 1 {
      if same_content {
        "identical"
      } else {
        "same-name"
      }
    } else if list.len() > 1 && same_content {
      "identical"
    } else if list.len() > 1 {
      "same-name"
    } else {
      "single"
    };

    groups.push(CompareGroup {
      title: list.first().map(|a| a.title.clone()).unwrap_or_else(|| slug.clone()),
      slug,
      tool_ids,
      assets: list,
      same_content,
      match_type: match_type.to_string(),
    });
  }

  groups.sort_by(|a, b| {
    if b.tool_ids.len() != a.tool_ids.len() {
      return b.tool_ids.len().cmp(&a.tool_ids.len());
    }
    if a.match_type != b.match_type {
      let order = |t: &str| match t {
        "identical" => 0,
        "same-name" => 1,
        _ => 2,
      };
      return order(&a.match_type).cmp(&order(&b.match_type));
    }
    a.slug.cmp(&b.slug)
  });

  groups
}
