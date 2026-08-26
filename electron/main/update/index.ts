import { BrowserWindow, app, ipcMain } from 'electron'
// electron-updater 是 CommonJS，ESM 下需从 default 解构，不能直接 named import
import electronUpdater from 'electron-updater'
import { readUpdateSettings, writeUpdateSettings } from './settings'

const { autoUpdater } = electronUpdater

export type UpdateStatus =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available'; version: string }
  | { type: 'downloading'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }
  | { type: 'dev-skip'; message: string }

type GetWindow = () => BrowserWindow | null

let getWindow: GetWindow = () => null
let started = false
let lastDownloadedVersion: string | null = null

function sendStatus(status: UpdateStatus) {
  const win = getWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('update:status', status)
  }
}

/** electron-updater 错误常夹带 HTML/Atom 全文，界面只展示短句 */
function sanitizeUpdateError(raw: unknown): string {
  const text = String((raw as any)?.message || raw || '检查更新失败')
    .replace(/\s+/g, ' ')
    .trim()

  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network|fetch failed|net::/i.test(text)) {
    return '网络异常，请稍后重试'
  }
  if (/401|403|Unauthorized|Bad credentials|private/i.test(text)) {
    return '无法访问更新源（仓库权限或 Token 无效）'
  }
  if (/Unable to find latest version|Cannot parse releases feed|latest\.yml|404/i.test(text)) {
    return '暂未找到可用更新，请稍后再试'
  }
  if (/code signature|not signed|notariz/i.test(text)) {
    return '更新包校验失败'
  }

  const firstLine = text.split(/[\n\r]/)[0] || text
  if (firstLine.length <= 80) return firstLine
  return `${firstLine.slice(0, 80)}…`
}

function configureUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    sendStatus({ type: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    sendStatus({ type: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', (info) => {
    sendStatus({ type: 'not-available', version: info.version })
  })

  autoUpdater.on('download-progress', (p) => {
    sendStatus({ type: 'downloading', percent: Math.round(p.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    lastDownloadedVersion = info.version
    sendStatus({ type: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (err) => {
    console.error('[update]', err)
    sendStatus({ type: 'error', message: sanitizeUpdateError(err) })
  })
}

async function checkForUpdates(manual: boolean) {
  if (!app.isPackaged) {
    const status: UpdateStatus = {
      type: 'dev-skip',
      message: '开发环境不可用，请使用打包后的应用检查更新',
    }
    sendStatus(status)
    return { ok: false, ...status, manual }
  }

  try {
    const result = await autoUpdater.checkForUpdates()
    return { ok: true, manual, version: result?.updateInfo?.version }
  } catch (error: any) {
    console.error('[update]', error)
    const message = sanitizeUpdateError(error)
    sendStatus({ type: 'error', message })
    return { ok: false, manual, message }
  }
}

export function registerUpdateIpc(getMainWindow: GetWindow) {
  getWindow = getMainWindow
  if (!started) {
    configureUpdater()
    started = true
  }

  ipcMain.handle('update:get-version', () => app.getVersion())

  ipcMain.handle('update:get-settings', () => readUpdateSettings())

  ipcMain.handle('update:set-auto-check', (_e, autoCheck: boolean) => {
    return writeUpdateSettings({ autoCheck: Boolean(autoCheck) })
  })

  ipcMain.handle('update:check', async () => checkForUpdates(true))

  ipcMain.handle('update:quit-and-install', () => {
    autoUpdater.quitAndInstall(false, true)
    return { success: true }
  })
}

export function scheduleAutoUpdateCheck(delayMs = 4000) {
  const { autoCheck } = readUpdateSettings()
  if (!autoCheck) return
  setTimeout(() => {
    void checkForUpdates(false)
  }, delayMs)
}

export function getLastDownloadedVersion() {
  return lastDownloadedVersion
}
