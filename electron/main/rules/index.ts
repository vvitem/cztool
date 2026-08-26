import path from 'node:path'
import fs from 'node:fs/promises'
import { ipcMain, shell } from 'electron'
import { getAllowedRoots } from './adapters'
import { compareAssets } from './compare'
import { readAssetPreview, scanRules, writeAssetContent } from './scan'
import type { RuleAsset, ToolId } from './types'

async function assertAllowedPath(absPath: string) {
  const resolved = path.resolve(absPath)
  let real: string
  try {
    real = await fs.realpath(resolved)
  } catch {
    throw new Error('文件不存在或无法访问')
  }

  const roots = getAllowedRoots()
  const realRoots = await Promise.all(
    roots.map(async (r) => {
      try {
        return await fs.realpath(r)
      } catch {
        return path.resolve(r)
      }
    }),
  )

  const ok = realRoots.some((root) => real === root || real.startsWith(root + path.sep))
  if (!ok) {
    throw new Error('路径不在允许的规则目录内')
  }
  return real
}

export function registerRulesIpc() {
  ipcMain.handle('rules:scan', async (_event, toolIds?: ToolId[]) => {
    return scanRules(toolIds)
  })

  ipcMain.handle('rules:read', async (_event, absPath: string, options?: { full?: boolean }) => {
    const real = await assertAllowedPath(absPath)
    return readAssetPreview(real, options)
  })

  ipcMain.handle('rules:write', async (_event, absPath: string, content: string) => {
    const real = await assertAllowedPath(absPath)
    return writeAssetContent(real, content)
  })

  ipcMain.handle('rules:reveal', async (_event, absPath: string) => {
    const real = await assertAllowedPath(absPath)
    shell.showItemInFolder(real)
    return { success: true }
  })

  ipcMain.handle('rules:open', async (_event, absPath: string) => {
    const real = await assertAllowedPath(absPath)
    const err = await shell.openPath(real)
    if (err) throw new Error(err)
    return { success: true }
  })

  ipcMain.handle('rules:compare', async (_event, assets?: RuleAsset[]) => {
    const list = assets?.length ? assets : (await scanRules()).assets
    return compareAssets(list)
  })
}
