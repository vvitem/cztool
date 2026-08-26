import { app, ipcMain, shell } from 'electron'
import { scheduleAutoUpdateCheck } from '../update'
import { getDeviceId } from './device'
import { clearSession, isSessionValid, readSession, writeSession } from './session'
import { refreshSession, verifyCode } from './api'

type OnUnlocked = () => void

let updateCheckScheduled = false
let onUnlocked: OnUnlocked | null = null

function shouldSkipUnlock(): boolean {
  return !app.isPackaged && process.env.CZTOOL_UNLOCK_SKIP === '1'
}

function scheduleUpdateCheckOnce() {
  if (updateCheckScheduled) return
  updateCheckScheduled = true
  scheduleAutoUpdateCheck(4000)
}

function notifyUnlocked() {
  scheduleUpdateCheckOnce()
  onUnlocked?.()
}

async function buildStatus() {
  const deviceId = getDeviceId()

  if (shouldSkipUnlock()) {
    notifyUnlocked()
    return { locked: false, deviceId, skipped: true }
  }

  const session = readSession()
  if (isSessionValid(session)) {
    notifyUnlocked()
    return {
      locked: false,
      deviceId,
      expiresAt: session!.expiresAt,
    }
  }

  if (session?.token) {
    const refreshed = await refreshSession(deviceId, session.token)
    if ('ok' in refreshed && refreshed.ok && refreshed.token && refreshed.expiresAt) {
      writeSession({
        deviceId,
        token: refreshed.token,
        expiresAt: refreshed.expiresAt,
        boundCode: session.boundCode,
      })
      notifyUnlocked()
      return {
        locked: false,
        deviceId,
        expiresAt: refreshed.expiresAt,
      }
    }
  }

  return { locked: true, deviceId }
}

export function registerUnlockIpc(options?: { onUnlocked?: OnUnlocked }) {
  onUnlocked = options?.onUnlocked ?? null

  ipcMain.handle('unlock:get-status', async () => buildStatus())

  ipcMain.handle('unlock:get-device-id', () => getDeviceId())

  ipcMain.handle('unlock:verify', async (_event, code: string) => {
    if (shouldSkipUnlock()) {
      notifyUnlocked()
      return { ok: true, skipped: true }
    }

    const trimmed = String(code || '').trim()
    if (!trimmed) {
      return { ok: false, message: '请输入验证码' }
    }

    const deviceId = getDeviceId()
    const result = await verifyCode(trimmed, deviceId)

    if (!('ok' in result) || !result.ok || !result.token || !result.expiresAt) {
      return {
        ok: false,
        message: 'message' in result ? result.message : '验证失败',
      }
    }

    writeSession({
      deviceId,
      token: result.token,
      expiresAt: result.expiresAt,
      boundCode: trimmed.toUpperCase(),
    })
    notifyUnlocked()

    return {
      ok: true,
      expiresAt: result.expiresAt,
    }
  })

  ipcMain.handle('unlock:clear', () => {
    clearSession()
    return { ok: true }
  })

  ipcMain.handle('unlock:open-external', async (_event, url: string) => {
    const target = String(url || '').trim()
    if (!/^https:\/\//i.test(target)) {
      throw new Error('仅允许打开 https 链接')
    }
    await shell.openExternal(target)
    return { ok: true }
  })
}

export function isAppUnlocked(): boolean {
  if (shouldSkipUnlock()) return true
  return isSessionValid(readSession())
}
