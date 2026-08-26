import path from 'node:path'
import { home, type AssetKind, type ToolAdapter, type ToolId } from './types'

const COMMON_EXCLUDE = [
  'extensions',
  'node_modules',
  '.git',
  'Cache',
  'cache',
  'logs',
  'CachedData',
  'GPUCache',
  'Code Cache',
  'blob_storage',
  'Crashpad',
  'dist',
  'vendor_imports',
]

function extOk(fileName: string) {
  return /\.(mdc|md|toml|txt)$/i.test(fileName)
}

function kindFromPath(relPath: string, fileName: string, fallback: AssetKind = 'other'): AssetKind {
  const p = relPath.replace(/\\/g, '/').toLowerCase()
  const f = fileName.toLowerCase()
  if (f === 'skill.md' || p.includes('/skills/') || p.includes('/skills-cursor/') || p.includes('/builtin_skills/')) {
    return 'skill'
  }
  if (p.includes('/agents/') || f.endsWith('.toml') && p.includes('agent')) {
    return 'agent'
  }
  if (p.includes('/prompts/') || p.includes('/commands/')) {
    return 'prompt'
  }
  if (
    p.includes('/rules/')
    || f.endsWith('.mdc')
    || f === 'user_rules.md'
    || f === 'claude.md'
    || f === 'agents.md'
  ) {
    return 'rule'
  }
  if (f.endsWith('.toml')) return 'agent'
  return fallback
}

function includeMarkdownish(_abs: string, relPath: string, fileName: string) {
  if (!extOk(fileName)) return false
  const p = relPath.replace(/\\/g, '/')
  // skip obvious package docs
  if (/(^|\/)(readme|changelog|license|security|support|contributing)\.md$/i.test(fileName)) {
    // keep if under rules/skills/agents/prompts
    if (!/(^|\/)(rules|skills|skills-cursor|agents|prompts|commands|builtin_skills)(\/|$)/i.test(p)) {
      return false
    }
  }
  return true
}

export const adapters: ToolAdapter[] = [
  {
    id: 'cursor',
    label: 'Cursor',
    getRoots: () => [home('.cursor')],
    excludeDirNames: [...COMMON_EXCLUDE, 'projects', 'ai-tracking', 'browser-logs'],
    includeTopDirs: ['rules', 'skills-cursor', 'agents', 'skills'],
    shouldInclude: (abs, rel, name) => {
      const p = rel.replace(/\\/g, '/')
      if (!includeMarkdownish(abs, rel, name)) return false
      return (
        p.startsWith('rules/')
        || p.startsWith('skills-cursor/')
        || p.startsWith('agents/')
        || /(^|\/)skills\//i.test(p)
      )
    },
    inferKind: (rel, name) => kindFromPath(rel, name, 'rule'),
  },
  {
    id: 'claude',
    label: 'Claude Code',
    getRoots: () => [home('.claude')],
    excludeDirNames: [...COMMON_EXCLUDE, 'debug', 'statsig', 'telemetry', 'file-history', 'shell-snapshots', 'session-env', 'projects', 'todos', 'plans', 'plugins'],
    includeTopDirs: ['skills', 'agents', 'commands', 'rules', '.cursor', '.agents'],
    shouldInclude: (abs, rel, name) => {
      if (!includeMarkdownish(abs, rel, name)) return false
      const p = rel.replace(/\\/g, '/')
      const f = name.toLowerCase()
      if (f === 'claude.md' || f === 'agents.md') return true
      return (
        p.includes('/rules/')
        || p.startsWith('rules/')
        || p.includes('/skills/')
        || p.startsWith('skills/')
        || p.includes('/agents/')
        || p.startsWith('agents/')
        || p.includes('/commands/')
        || p.startsWith('commands/')
        || f === 'skill.md'
      )
    },
    inferKind: (rel, name) => kindFromPath(rel, name, 'other'),
  },
  {
    id: 'codex',
    label: 'Codex',
    getRoots: () => [home('.codex')],
    excludeDirNames: [...COMMON_EXCLUDE, 'tmp', 'sessions', 'memories'],
    includeTopDirs: ['prompts', 'agents', 'skills'],
    shouldInclude: (abs, rel, name) => {
      if (!includeMarkdownish(abs, rel, name) && !/\.toml$/i.test(name)) return false
      const p = rel.replace(/\\/g, '/')
      return (
        p.startsWith('prompts/')
        || p.startsWith('agents/')
        || p.startsWith('skills/')
        || /(^|\/)skills\//i.test(p)
      )
    },
    inferKind: (rel, name) => kindFromPath(rel, name, 'prompt'),
  },
  {
    id: 'trae',
    label: 'Trae',
    getRoots: () => [home('.trae'), home('.trae-cn'), home('.trae-aicc')],
    excludeDirNames: [...COMMON_EXCLUDE],
    includeTopDirs: ['builtin_skills', 'rules', 'skills'],
    shouldInclude: (abs, rel, name) => {
      if (!includeMarkdownish(abs, rel, name)) return false
      const p = rel.replace(/\\/g, '/')
      const f = name.toLowerCase()
      return (
        f === 'user_rules.md'
        || p.includes('builtin_skills/')
        || p.includes('/rules/')
        || p.includes('/skills/')
        || f === 'skill.md'
      )
    },
    inferKind: (rel, name) => kindFromPath(rel, name, 'rule'),
  },
  {
    id: 'qoder',
    label: 'Qoder',
    getRoots: () => [home('.qoder'), home('.qoder-cn'), home('.qodersec')],
    excludeDirNames: [...COMMON_EXCLUDE],
    includeTopDirs: ['skills', 'rules', 'canvas'],
    shouldInclude: (abs, rel, name) => {
      if (!includeMarkdownish(abs, rel, name)) return false
      const p = rel.replace(/\\/g, '/')
      return (
        p.includes('/skills/')
        || p.startsWith('skills/')
        || p.includes('/rules/')
        || p.includes('canvas/recipes/')
        || name.toLowerCase() === 'skill.md'
      )
    },
    inferKind: (rel, name) => {
      if (rel.replace(/\\/g, '/').includes('canvas/recipes/')) return 'prompt'
      return kindFromPath(rel, name, 'skill')
    },
  },
]

export function getAdapter(toolId: ToolId) {
  return adapters.find((a) => a.id === toolId)
}

export function getAllowedRoots(): string[] {
  const roots: string[] = []
  for (const a of adapters) {
    for (const r of a.getRoots()) {
      roots.push(path.resolve(r))
    }
  }
  return roots
}
