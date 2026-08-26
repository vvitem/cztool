export type TemplateId = 'agents' | 'skill' | 'mdc'

export function getTemplateContent(template: TemplateId, slug: string): string {
  if (template === 'agents') {
    return `# AGENTS.md

## 项目约定

- 用简体中文回复用户（除非对方要求其他语言）
- 只改任务相关文件，不做无关重构
- 提交前确认构建/类型检查通过

## 技术栈

（填写本仓库主要技术栈）

## 禁止事项

- 不要提交密钥或 \`.env\`
- 不要擅自 force push main
`
  }

  if (template === 'skill') {
    const name = slug || 'my-skill'
    return `---
name: ${name}
description: 一句话说明何时使用此技能
---

# ${name}

## 何时使用

- …

## 步骤

1. …
2. …

## 注意

- …
`
  }

  // mdc — Cursor rule
  const name = slug || 'project-rule'
  return `---
description: ${name}
globs:
alwaysApply: false
---

# ${name}

## 约定

- …

## 示例

\`\`\`
（好的写法）
\`\`\`
`
}

export function templateFileName(template: TemplateId, slug: string): { relDir: string; fileName: string } {
  const safe = (slug || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled'

  if (template === 'agents') {
    return { relDir: '', fileName: 'AGENTS.md' }
  }
  if (template === 'skill') {
    return { relDir: `skills/${safe}`, fileName: 'SKILL.md' }
  }
  return { relDir: 'rules', fileName: `${safe}.mdc` }
}
