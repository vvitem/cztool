import fs from 'node:fs/promises'
import path from 'node:path'
import {
  makeAssetId,
  hashContent,
  normalizeSlug,
  titleFromContent,
  type AssetKind,
  type RuleAsset,
  type ScanResult,
  type ToolSummary,
} from './types'

const HASH_BYTES = 64 * 1024
const MAX_DEPTH = 6

const EXCLUDE = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'Cache',
  'cache',
  'vendor',
  '.next',
  'coverage',
])

const TOOL_DOT_DIRS = new Set(['.cursor', '.claude', '.codex', '.trae', '.trae-cn', '.qoder', '.qoder-cn'])

let projectRoot: string | null = null

export function getProjectRoot() {
  return projectRoot
}

export function setProjectRoot(root: string | null) {
  projectRoot = root ? path.resolve(root) : null
  return projectRoot
}

export function getProjectAllowedRoots(): string[] {
  return projectRoot ? [projectRoot] : []
}

async function pathExists(p: string) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

function inferProjectKind(relPath: string, fileName: string): AssetKind {
  const p = relPath.replace(/\\/g, '/').toLowerCase()
  const f = fileName.toLowerCase()
  if (f === 'skill.md' || p.includes('/skills/')) return 'skill'
  if (p.includes('/agents/')) return 'agent'
  if (p.includes('/prompts/') || p.includes('/commands/')) return 'prompt'
  if (
    f === 'agents.md'
    || f === 'claude.md'
    || f === '.cursorrules'
    || f.endsWith('.mdc')
    || p.includes('/rules/')
  ) {
    return 'rule'
  }
  return 'other'
}

function inferToolId(relPath: string): RuleAsset['toolId'] {
  const p = relPath.replace(/\\/g, '/').toLowerCase()
  if (p.startsWith('.cursor/') || p.includes('/.cursor/')) return 'cursor'
  if (p.startsWith('.claude/') || p.includes('/.claude/')) return 'claude'
  if (p.startsWith('.codex/') || p.includes('/.codex/')) return 'codex'
  if (p.includes('.trae')) return 'trae'
  if (p.includes('.qoder')) return 'qoder'
  return 'workspace'
}

function shouldCollect(relPath: string, fileName: string) {
  const p = relPath.replace(/\\/g, '/')
  const f = fileName.toLowerCase()
  if (['agents.md', 'claude.md', '.cursorrules'].includes(f) && !p.includes('/')) return true
  if (/(^|\/)\.cursor\/rules\//i.test(p) && /\.(md|mdc)$/i.test(f)) return true
  if (/(^|\/)\.claude\/(skills|agents|commands|rules)\//i.test(p) && /\.(md|mdc|toml)$/i.test(f)) return true
  if (/(^|\/)\.codex\/(prompts|agents|skills)\//i.test(p)) return true
  if (f === 'skill.md') return true
  return false
}

async function buildAsset(rootPath: string, absPath: string): Promise<RuleAsset | null> {
  try {
    const st = await fs.stat(absPath)
    if (!st.isFile()) return null
    const relPath = path.relative(rootPath, absPath)
    const fileName = path.basename(absPath)
    const toolId = inferToolId(relPath)
    const kind = inferProjectKind(relPath, fileName)

    let head = ''
    let contentHash: string | undefined
    try {
      const fh = await fs.open(absPath, 'r')
      try {
        const buf = Buffer.alloc(Math.min(HASH_BYTES, st.size))
        const { bytesRead } = await fh.read(buf, 0, buf.length, 0)
        const slice = buf.subarray(0, bytesRead)
        contentHash = hashContent(slice)
        head = slice.toString('utf8')
      } finally {
        await fh.close()
      }
    } catch {
      // ignore
    }

    return {
      id: makeAssetId(`project:${toolId}`, absPath),
      toolId,
      kind,
      title: titleFromContent(fileName, relPath, head),
      slug: normalizeSlug(fileName, relPath),
      absPath,
      relPath,
      rootPath,
      size: st.size,
      mtime: st.mtimeMs,
      contentHash,
    }
  } catch {
    return null
  }
}

async function walk(root: string, dir: string, depth: number, out: string[]) {
  if (depth > MAX_DEPTH) return
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (EXCLUDE.has(entry.name)) continue
      if (entry.name.startsWith('.') && !TOOL_DOT_DIRS.has(entry.name)) continue
      await walk(root, abs, depth + 1, out)
    } else if (entry.isFile()) {
      out.push(abs)
    }
  }
}

export async function scanProject(rootPath: string): Promise<ScanResult> {
  const root = path.resolve(rootPath)
  if (!(await pathExists(root))) {
    throw new Error('项目目录不存在')
  }
  setProjectRoot(root)

  const files: string[] = []
  await walk(root, root, 0, files)

  const assets: RuleAsset[] = []
  const seen = new Set<string>()

  for (const abs of files) {
    const rel = path.relative(root, abs)
    const name = path.basename(abs)
    if (!shouldCollect(rel, name)) continue
    const asset = await buildAsset(root, abs)
    if (asset && !seen.has(asset.absPath)) {
      seen.add(asset.absPath)
      assets.push(asset)
    }
  }

  for (const name of ['AGENTS.md', 'CLAUDE.md', '.cursorrules', 'agents.md', 'claude.md']) {
    const abs = path.join(root, name)
    if (!(await pathExists(abs)) || seen.has(abs)) continue
    const asset = await buildAsset(root, abs)
    if (asset) {
      seen.add(abs)
      assets.push(asset)
    }
  }

  assets.sort((a, b) => b.mtime - a.mtime)

  const counts = { rule: 0, skill: 0, agent: 0, prompt: 0, other: 0 }
  for (const a of assets) counts[a.kind] += 1

  const tools: ToolSummary[] = [
    {
      toolId: 'workspace',
      label: path.basename(root) || '当前项目',
      roots: [root],
      presentRoots: [root],
      detected: true,
      counts,
      total: assets.length,
    },
  ]

  return {
    tools,
    assets,
    scannedAt: Date.now(),
  }
}
