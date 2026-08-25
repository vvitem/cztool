import { BrowserWindow, app, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { readUpdateSettings, writeUpdateSettings } from './settings'

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
    sendStatus({ type: 'error', message: err?.message || String(err) })
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
    const message = error?.message || '检查更新失败'
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
