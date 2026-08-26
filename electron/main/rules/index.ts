import path from 'node:path'
import fs from 'node:fs/promises'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { getAllowedRoots } from './adapters'
import { compareAssets } from './compare'
import { createRuleAsset } from './create'
import { analyzeHealth } from './health'
import { getProjectAllowedRoots, getProjectRoot, scanProject, setProjectRoot } from './projectScan'
import { readAssetPreview, scanRules, writeAssetContent } from './scan'
import { syncAssetToTools } from './sync'
import type { AssetKind, RuleAsset, ToolId } from './types'
import type { TemplateId } from './templates'

async function assertAllowedPath(absPath: string) {
  const resolved = path.resolve(absPath)
  let real: string
  try {
    real = await fs.realpath(resolved)
  } catch {
    // 新建前的父目录校验：允许落到已允许根下
    real = resolved
    const parent = path.dirname(resolved)
    try {
      real = path.join(await fs.realpath(parent), path.basename(resolved))
    } catch {
      throw new Error('文件不存在或无法访问')
    }
  }

  const roots = [...getAllowedRoots(), ...getProjectAllowedRoots()]
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

  ipcMain.handle('rules:health', async (_event, payload?: { tools?: any[]; assets?: RuleAsset[] }) => {
    const data = payload?.assets?.length
      ? { tools: payload.tools || [], assets: payload.assets }
      : await scanRules()
    return analyzeHealth(data.tools as any, data.assets)
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

  ipcMain.handle(
    'rules:create',
    async (
      _event,
      options: { toolId: ToolId; template: TemplateId; slug?: string; kind?: AssetKind },
    ) => {
      return createRuleAsset(options)
    },
  )

  ipcMain.handle(
    'rules:sync',
    async (
      _event,
      options: {
        sourceAbsPath: string
        sourceToolId: ToolId
        sourceKind: AssetKind
        sourceRelPath: string
        sourceTitle: string
        targetToolIds: ToolId[]
        overwrite?: boolean
      },
    ) => {
      await assertAllowedPath(options.sourceAbsPath)
      return syncAssetToTools(options)
    },
  )

  ipcMain.handle('rules:get-project', () => ({
    projectRoot: getProjectRoot(),
  }))

  ipcMain.handle('rules:clear-project', () => {
    setProjectRoot(null)
    return { projectRoot: null }
  })

  ipcMain.handle('rules:pick-project', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win ?? undefined, {
      title: '选择项目目录',
      properties: ['openDirectory'],
    })
    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true, projectRoot: getProjectRoot() }
    }
    const root = setProjectRoot(result.filePaths[0])
    const scan = await scanProject(root!)
    return { canceled: false, projectRoot: root, ...scan }
  })

  ipcMain.handle('rules:scan-project', async (_event, rootPath?: string) => {
    const root = rootPath || getProjectRoot()
    if (!root) throw new Error('尚未选择项目目录')
    return scanProject(root)
  })
}
