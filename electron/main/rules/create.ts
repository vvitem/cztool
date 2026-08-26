import fs from 'node:fs/promises'
import path from 'node:path'
import { getAdapter } from './adapters'
import { getTemplateContent, templateFileName, type TemplateId } from './templates'
import {
  makeAssetId,
  hashContent,
  normalizeSlug,
  titleFromContent,
  type AssetKind,
  type RuleAsset,
  type ToolId,
} from './types'

export interface CreateRuleOptions {
  toolId: ToolId
  template: TemplateId
  slug?: string
  /** 覆盖推断的 kind；默认由模板决定 */
  kind?: AssetKind
}

function kindForTemplate(template: TemplateId): AssetKind {
  if (template === 'skill') return 'skill'
  if (template === 'mdc') return 'rule'
  return 'rule'
}

export async function createRuleAsset(options: CreateRuleOptions): Promise<RuleAsset> {
  const adapter = getAdapter(options.toolId)
  if (!adapter) throw new Error('未知工具')

  const roots = adapter.getRoots().map((r) => path.resolve(r))
  let root = roots[0]
  for (const r of roots) {
    try {
      await fs.access(r)
      root = r
      break
    } catch {
      // try next
    }
  }
  if (!root) throw new Error('未找到工具配置目录')

  try {
    await fs.mkdir(root, { recursive: true })
  } catch {
    // ignore
  }

  const slug = options.slug?.trim() || 'untitled'
  const { relDir, fileName } = templateFileName(options.template, slug)
  const dir = relDir ? path.join(root, relDir) : root
  await fs.mkdir(dir, { recursive: true })

  const absPath = path.join(dir, fileName)
  let exists = false
  try {
    await fs.access(absPath)
    exists = true
  } catch {
    exists = false
  }
  if (exists) {
    throw new Error(`文件已存在：${path.relative(root, absPath)}`)
  }

  const content = getTemplateContent(options.template, slug)
  await fs.writeFile(absPath, content, 'utf8')
  const st = await fs.stat(absPath)
  const relPath = path.relative(root, absPath)
  const kind = options.kind || kindForTemplate(options.template)

  return {
    id: makeAssetId(options.toolId, absPath),
    toolId: options.toolId,
    kind,
    title: titleFromContent(fileName, relPath, content),
    slug: normalizeSlug(fileName, relPath),
    absPath,
    relPath,
    rootPath: root,
    size: st.size,
    mtime: st.mtimeMs,
    contentHash: hashContent(content),
  }
}
