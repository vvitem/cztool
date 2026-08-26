export type ToolId = 'cursor' | 'claude' | 'codex' | 'trae' | 'qoder'
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

export interface CompareGroup {
  slug: string
  title: string
  toolIds: ToolId[]
  assets: RuleAsset[]
  sameContent: boolean
  matchType: 'identical' | 'same-name' | 'single'
}

/** 纯函数对照，在渲染进程本地计算，避免把 Vue Proxy 经 IPC 克隆 */
export function compareAssets(assets: RuleAsset[]): CompareGroup[] {
  const bySlug = new Map<string, RuleAsset[]>()

  for (const asset of assets) {
    const list = bySlug.get(asset.slug) || []
    list.push(asset)
    bySlug.set(asset.slug, list)
  }

  const groups: CompareGroup[] = []

  for (const [slug, list] of bySlug) {
    const toolIds = [...new Set(list.map((a) => a.toolId))] as ToolId[]
    const hashes = list.map((a) => a.contentHash).filter(Boolean) as string[]
    const uniqueHashes = new Set(hashes)
    const sameContent = hashes.length >= 2 && uniqueHashes.size === 1

    let matchType: CompareGroup['matchType'] = 'single'
    if (toolIds.length > 1) {
      matchType = sameContent ? 'identical' : 'same-name'
    } else if (list.length > 1 && sameContent) {
      matchType = 'identical'
    } else if (list.length > 1) {
      matchType = 'same-name'
    }

    groups.push({
      slug,
      title: list[0]?.title || slug,
      toolIds,
      assets: list,
      sameContent,
      matchType,
    })
  }

  groups.sort((a, b) => {
    if (b.toolIds.length !== a.toolIds.length) return b.toolIds.length - a.toolIds.length
    if (a.matchType !== b.matchType) {
      const order = { identical: 0, 'same-name': 1, single: 2 }
      return order[a.matchType] - order[b.matchType]
    }
    return a.slug.localeCompare(b.slug)
  })

  return groups
}
