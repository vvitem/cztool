import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

export type ToolId = 'cursor' | 'claude' | 'codex' | 'trae' | 'qoder' | 'workspace'
export type AssetKind = 'rule' | 'skill' | 'agent' | 'prompt' | 'other'

export interface RuleAsset {
  id: string
  toolId: ToolId
  kind: AssetKind
  title: string
  slug: string
  absPath: string
  relPath: string
  rootPath: string
  size: number
  mtime: number
  contentHash?: string
}

export interface ToolSummary {
  toolId: ToolId
  label: string
  roots: string[]
  presentRoots: string[]
  detected: boolean
  counts: Record<AssetKind, number>
  total: number
}

export interface ScanResult {
  tools: ToolSummary[]
  assets: RuleAsset[]
  scannedAt: number
}

export interface CompareGroup {
  slug: string
  title: string
  toolIds: ToolId[]
  assets: RuleAsset[]
  sameContent: boolean
  matchType: 'identical' | 'same-name' | 'single'
}

export interface ToolAdapter {
  id: ToolId
  label: string
  /** Absolute root directories to scan */
  getRoots: () => string[]
  /** Directory names to skip entirely */
  excludeDirNames: string[]
  /**
   * If set, only descend into these top-level directory names under each root
   * (plus allow files directly under root that pass shouldInclude).
   */
  includeTopDirs?: string[]
  /** Whether a file path should be collected */
  shouldInclude: (absPath: string, relPath: string, fileName: string) => boolean
  /** Infer asset kind from relative path */
  inferKind: (relPath: string, fileName: string) => AssetKind
}

export function home(...parts: string[]) {
  return path.join(os.homedir(), ...parts)
}

export function makeAssetId(toolId: string, absPath: string) {
  return crypto.createHash('sha1').update(`${toolId}:${absPath}`).digest('hex').slice(0, 16)
}

export function hashContent(buf: Buffer | string) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16)
}

export function normalizeSlug(fileName: string, relPath: string): string {
  const base = path.basename(fileName)
  let name = base
  if (/^skill\.md$/i.test(base)) {
    name = path.basename(path.dirname(relPath))
  } else {
    name = base.replace(/\.(mdc|md|toml|txt)$/i, '')
  }
  return name
    .toLowerCase()
    .replace(/\(r\)|\(tm\)/gi, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'untitled'
}

export function titleFromContent(fileName: string, relPath: string, head: string): string {
  const fm = head.match(/^---\s*\n([\s\S]*?)\n---/)
  if (fm) {
    const nameMatch = fm[1].match(/^(?:name|title)\s*:\s*["']?(.+?)["']?\s*$/mi)
    if (nameMatch?.[1]) return nameMatch[1].trim()
  }
  const heading = head.match(/^#\s+(.+)$/m)
  if (heading?.[1]) return heading[1].trim()
  if (/^skill\.md$/i.test(fileName)) {
    return path.basename(path.dirname(relPath))
  }
  return fileName.replace(/\.(mdc|md|toml|txt)$/i, '')
}

export const KIND_LABELS: Record<AssetKind, string> = {
  rule: '规则',
  skill: '技能',
  agent: 'Agent',
  prompt: '提示词',
  other: '其他',
}

export const TOOL_LABELS: Record<ToolId, string> = {
  cursor: 'Cursor',
  claude: 'Claude Code',
  codex: 'Codex',
  trae: 'Trae',
  qoder: 'Qoder',
  workspace: '当前项目',
}
