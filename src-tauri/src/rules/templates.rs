// Template ids: "agents" | "skill" | "mdc"

pub fn get_template_content(template: &str, slug: &str) -> String {
  if template == "agents" {
    return r"# AGENTS.md

## 项目约定

- 用简体中文回复用户（除非对方要求其他语言）
- 只改任务相关文件，不做无关重构
- 提交前确认构建/类型检查通过

## 技术栈

（填写本仓库主要技术栈）

## 禁止事项

- 不要提交密钥或 `.env`
- 不要擅自 force push main
"
    .to_string();
  }

  if template == "skill" {
    let name = if slug.is_empty() { "my-skill" } else { slug };
    return format!(
      r#"---
name: {name}
description: 一句话说明何时使用此技能
---

# {name}

## 何时使用

- …

## 步骤

1. …
2. …

## 注意

- …
"#
    );
  }

  let name = if slug.is_empty() { "project-rule" } else { slug };
  format!(
    r#"---
description: {name}
globs:
alwaysApply: false
---

# {name}

## 约定

- …

## 示例

```
（好的写法）
```
"#
  )
}

pub fn template_file_name(template: &str, slug: &str) -> (String, String) {
  let safe = {
    let s = slug.to_lowercase();
    let re = regex::Regex::new(r"[^a-z0-9\u{4e00}-\u{9fff}-]+").unwrap();
    let mut out = re.replace_all(&s, "-").to_string();
    while out.contains("--") {
      out = out.replace("--", "-");
    }
    out.trim_matches('-').to_string()
  };
  let safe = if safe.is_empty() {
    "untitled".to_string()
  } else {
    safe
  };

  if template == "agents" {
    return (String::new(), "AGENTS.md".into());
  }
  if template == "skill" {
    return (format!("skills/{safe}"), "SKILL.md".into());
  }
  ("rules".into(), format!("{safe}.mdc"))
}
