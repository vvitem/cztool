import fs from 'node:fs/promises'
import path from 'node:path'
import { getAdapter } from './adapters'
import {
  makeAssetId,
  hashContent,
  normalizeSlug,
  titleFromContent,
  type AssetKind,
  type RuleAsset,
  type ToolId,
} from './types'

export interface SyncOptions {
  sourceAbsPath: string
  sourceToolId: ToolId
  sourceKind: AssetKind
  sourceRelPath: string
  sourceTitle: string
  targetToolIds: ToolId[]
  overwrite?: boolean
}

function targetRelPath(kind: AssetKind, sourceRelPath: string, sourceTitle: string): string {
  const base = path.basename(sourceRelPath)
  const lower = base.toLowerCase()

  if (kind === 'skill' || lower === 'skill.md') {
    const folder = lower === 'skill.md'
      ? path.basename(path.dirname(sourceRelPath))
      : base.replace(/\.(md|mdc)$/i, '')
    return path.join('skills', folder, 'SKILL.md')
  }
  if (kind === 'agent') {
    return path.join('agents', base)
  }
  if (kind === 'prompt') {
    return path.join('prompts', base)
  }
  // rule / other
  if (lower === 'agents.md' || lower === 'claude.md') {
    return base
  }
  if (lower.endsWith('.mdc')) {
    return path.join('rules', base)
  }
  const name = base.replace(/\.(md|txt)$/i, '') || sourceTitle
  return path.join('rules', `${name}.md`)
}

export interface SyncResultItem {
  toolId: ToolId
  absPath: string
  skipped?: boolean
  reason?: string
  asset?: RuleAsset
}

export async function syncAssetToTools(options: SyncOptions): Promise<SyncResultItem[]> {
  const content = await fs.readFile(options.sourceAbsPath, 'utf8')
  const results: SyncResultItem[] = []

  for (const toolId of options.targetToolIds) {
    if (toolId === options.sourceToolId) {
      results.push({ toolId, absPath: options.sourceAbsPath, skipped: true, reason: '源工具跳过' })
      continue
    }
    const adapter = getAdapter(toolId)
    if (!adapter) {
      results.push({ toolId, absPath: '', skipped: true, reason: '未知工具' })
      continue
    }

    const roots = adapter.getRoots().map((r) => path.resolve(r))
    let root = roots[0]
    for (const r of roots) {
      try {
        await fs.access(r)
        root = r
        break
      } catch {
        // next
      }
    }
    if (!root) {
      results.push({ toolId, absPath: '', skipped: true, reason: '目录不存在' })
      continue
    }

    await fs.mkdir(root, { recursive: true })
    const rel = targetRelPath(options.sourceKind, options.sourceRelPath, options.sourceTitle)
    const absPath = path.join(root, rel)

    try {
      await fs.access(absPath)
      if (!options.overwrite) {
        results.push({ toolId, absPath, skipped: true, reason: '目标已存在' })
        continue
      }
    } catch {
      // not exists — ok
    }

    await fs.mkdir(path.dirname(absPath), { recursive: true })
    await fs.writeFile(absPath, content, 'utf8')
    const st = await fs.stat(absPath)
    const fileName = path.basename(absPath)
    const asset: RuleAsset = {
      id: makeAssetId(toolId, absPath),
      toolId,
      kind: options.sourceKind,
      title: titleFromContent(fileName, rel, content),
      slug: normalizeSlug(fileName, rel),
      absPath,
      relPath: rel,
      rootPath: root,
      size: st.size,
      mtime: st.mtimeMs,
      contentHash: hashContent(content),
    }
    results.push({ toolId, absPath, asset })
  }

  return results
}
