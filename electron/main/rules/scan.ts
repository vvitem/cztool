import fs from 'node:fs/promises'
import path from 'node:path'
import { adapters } from './adapters'
import {
  makeAssetId,
  hashContent,
  normalizeSlug,
  titleFromContent,
  type AssetKind,
  type RuleAsset,
  type ScanResult,
  type ToolId,
  type ToolSummary,
} from './types'

const HASH_BYTES = 64 * 1024
const MAX_WALK_DEPTH = 8

async function pathExists(p: string) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function walkDir(
  root: string,
  dir: string,
  excludeDirNames: Set<string>,
  includeTopDirs: string[] | undefined,
  depth: number,
  out: string[],
) {
  if (depth > MAX_WALK_DEPTH) return
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (excludeDirNames.has(entry.name)) continue
      if (depth === 0 && includeTopDirs?.length && !includeTopDirs.includes(entry.name)) {
        continue
      }
      if (entry.name.startsWith('.') && entry.name !== '.cursor' && entry.name !== '.agents') {
        continue
      }
      await walkDir(root, abs, excludeDirNames, includeTopDirs, depth + 1, out)
    } else if (entry.isFile()) {
      out.push(abs)
    }
  }
}

async function buildAsset(
  toolId: ToolId,
  rootPath: string,
  absPath: string,
  kind: AssetKind,
): Promise<RuleAsset | null> {
  try {
    const st = await fs.stat(absPath)
    if (!st.isFile()) return null
    const relPath = path.relative(rootPath, absPath)
    const fileName = path.basename(absPath)

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
      // ignore read errors for hash
    }

    return {
      id: makeAssetId(toolId, absPath),
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

function emptyCounts(): Record<AssetKind, number> {
  return { rule: 0, skill: 0, agent: 0, prompt: 0, other: 0 }
}

export async function scanRules(toolIds?: ToolId[]): Promise<ScanResult> {
  const selected = toolIds?.length
    ? adapters.filter((a) => toolIds.includes(a.id))
    : adapters

  const assets: RuleAsset[] = []
  const tools: ToolSummary[] = []

  for (const adapter of selected) {
    const roots = adapter.getRoots().map((r) => path.resolve(r))
    const presentRoots: string[] = []
    const exclude = new Set(adapter.excludeDirNames)
    const toolAssets: RuleAsset[] = []

    for (const root of roots) {
      if (!(await pathExists(root))) continue
      presentRoots.push(root)
      const files: string[] = []
      await walkDir(root, root, exclude, adapter.includeTopDirs, 0, files)

      for (const abs of files) {
        const rel = path.relative(root, abs)
        const name = path.basename(abs)
        if (!adapter.shouldInclude(abs, rel, name)) continue
        const kind = adapter.inferKind(rel, name)
        const asset = await buildAsset(adapter.id, root, abs, kind)
        if (asset) toolAssets.push(asset)
      }
    }

    const counts = emptyCounts()
    for (const a of toolAssets) counts[a.kind] += 1

    tools.push({
      toolId: adapter.id,
      label: adapter.label,
      roots,
      presentRoots,
      detected: presentRoots.length > 0,
      counts,
      total: toolAssets.length,
    })
    assets.push(...toolAssets)
  }

  assets.sort((a, b) => b.mtime - a.mtime)

  return {
    tools,
    assets,
    scannedAt: Date.now(),
  }
}

export async function readAssetPreview(absPath: string, options?: { full?: boolean; maxBytes?: number }) {
  const resolved = path.resolve(absPath)
  const st = await fs.stat(resolved)
  const maxBytes = options?.full
    ? Math.min(st.size, 2 * 1024 * 1024)
    : (options?.maxBytes ?? 256 * 1024)
  const size = Math.min(st.size, maxBytes)
  const fh = await fs.open(resolved, 'r')
  try {
    const buf = Buffer.alloc(size)
    const { bytesRead } = await fh.read(buf, 0, size, 0)
    const text = buf.subarray(0, bytesRead).toString('utf8')
    return {
      absPath: resolved,
      truncated: st.size > maxBytes,
      size: st.size,
      content: text,
    }
  } finally {
    await fh.close()
  }
}

export async function writeAssetContent(absPath: string, content: string) {
  const resolved = path.resolve(absPath)
  if (typeof content !== 'string') {
    throw new Error('内容必须是文本')
  }
  if (Buffer.byteLength(content, 'utf8') > 2 * 1024 * 1024) {
    throw new Error('文件过大，无法在应用内保存（上限 2MB）')
  }
  await fs.writeFile(resolved, content, 'utf8')
  const st = await fs.stat(resolved)
  return {
    absPath: resolved,
    size: st.size,
    mtime: st.mtimeMs,
  }
}
