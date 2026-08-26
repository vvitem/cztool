import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { getDeviceId } from './device'

export interface UnlockSession {
  deviceId: string
  token: string
  expiresAt: number
  boundCode?: string
}

function sessionPath() {
  return path.join(app.getPath('userData'), 'unlock-session.json')
}

export function readSession(): UnlockSession | null {
  try {
    const raw = fs.readFileSync(sessionPath(), 'utf8')
    const parsed = JSON.parse(raw) as UnlockSession
    if (
      typeof parsed.deviceId === 'string'
      && typeof parsed.token === 'string'
      && typeof parsed.expiresAt === 'number'
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function writeSession(session: UnlockSession) {
  fs.writeFileSync(sessionPath(), JSON.stringify(session, null, 2), 'utf8')
}

export function clearSession() {
  try {
    fs.unlinkSync(sessionPath())
  } catch {
    // ignore
  }
}

export function isSessionValid(session: UnlockSession | null): boolean {
  if (!session) return false
  if (session.deviceId !== getDeviceId()) return false
  return session.expiresAt > Date.now()
}
