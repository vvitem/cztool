import type { CompareGroup, RuleAsset, ToolId } from './types'

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
