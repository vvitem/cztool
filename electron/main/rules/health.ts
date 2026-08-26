import type { RuleAsset, ToolId, ToolSummary } from './types'

export type HealthIssueType = 'oversized' | 'drift' | 'duplicate' | 'missing-entry'

export interface HealthIssue {
  id: string
  type: HealthIssueType
  severity: 'warn' | 'info'
  title: string
  message: string
  assetIds: string[]
  slug?: string
}

export interface HealthReport {
  scannedAt: number
  issueCount: number
  byType: Record<HealthIssueType, number>
  issues: HealthIssue[]
}

const OVERSIZE_BYTES = 30 * 1024

function emptyByType(): Record<HealthIssueType, number> {
  return { oversized: 0, drift: 0, duplicate: 0, 'missing-entry': 0 }
}

/** 基于扫描结果的轻量健康度分析（不二次读盘） */
export function analyzeHealth(tools: ToolSummary[], assets: RuleAsset[]): HealthReport {
  const issues: HealthIssue[] = []

  for (const asset of assets) {
    if (asset.size > OVERSIZE_BYTES) {
      issues.push({
        id: `oversized:${asset.id}`,
        type: 'oversized',
        severity: 'info',
        title: `过大：${asset.title}`,
        message: `${Math.round(asset.size / 1024)} KB，建议拆分或精简（阈值 30KB）`,
        assetIds: [asset.id],
        slug: asset.slug,
      })
    }
  }

  const bySlug = new Map<string, RuleAsset[]>()
  for (const asset of assets) {
    const list = bySlug.get(asset.slug) || []
    list.push(asset)
    bySlug.set(asset.slug, list)
  }

  for (const [slug, list] of bySlug) {
    const toolIds = [...new Set(list.map((a) => a.toolId))]
    if (toolIds.length < 2) continue
    const hashes = list.map((a) => a.contentHash).filter(Boolean) as string[]
    if (hashes.length < 2) continue
    const unique = new Set(hashes)
    if (unique.size > 1) {
      issues.push({
        id: `drift:${slug}`,
        type: 'drift',
        severity: 'warn',
        title: `内容漂移：${list[0]?.title || slug}`,
        message: `在 ${toolIds.join(' / ')} 中同名但内容不一致`,
        assetIds: list.map((a) => a.id),
        slug,
      })
    }
  }

  const byHash = new Map<string, RuleAsset[]>()
  for (const asset of assets) {
    if (!asset.contentHash) continue
    const list = byHash.get(asset.contentHash) || []
    list.push(asset)
    byHash.set(asset.contentHash, list)
  }
  for (const [hash, list] of byHash) {
    if (list.length < 2) continue
    const paths = new Set(list.map((a) => a.absPath))
    if (paths.size < 2) continue
    issues.push({
      id: `dup:${hash}`,
      type: 'duplicate',
      severity: 'info',
      title: `疑似重复：${list[0]?.title || hash}`,
      message: `${list.length} 处内容哈希相同`,
      assetIds: list.map((a) => a.id),
      slug: list[0]?.slug,
    })
  }

  const ENTRY_HINTS: Partial<Record<ToolId, { names: string[]; label: string }>> = {
    claude: { names: ['claude.md', 'agents.md'], label: 'CLAUDE.md / AGENTS.md' },
    cursor: { names: ['agents.md'], label: 'AGENTS.md（可选）' },
    codex: { names: ['agents.md'], label: 'AGENTS.md（可选）' },
  }

  for (const tool of tools) {
    if (!tool.detected) continue
    const hint = ENTRY_HINTS[tool.toolId]
    if (!hint) continue
    const toolAssets = assets.filter((a) => a.toolId === tool.toolId)
    const hasEntry = toolAssets.some((a) => {
      const base = a.relPath.replace(/\\/g, '/').split('/').pop()?.toLowerCase() || ''
      return hint.names.includes(base)
    })
    if (!hasEntry && tool.toolId === 'claude') {
      issues.push({
        id: `missing:${tool.toolId}`,
        type: 'missing-entry',
        severity: 'info',
        title: `缺少入口：${tool.label}`,
        message: `已检测到目录，但未找到 ${hint.label}`,
        assetIds: [],
      })
    }
  }

  const byType = emptyByType()
  for (const issue of issues) byType[issue.type] += 1

  issues.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'warn' ? -1 : 1
    return a.title.localeCompare(b.title)
  })

  return {
    scannedAt: Date.now(),
    issueCount: issues.length,
    byType,
    issues,
  }
}
