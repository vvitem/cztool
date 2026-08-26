import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'

function deviceIdPath() {
  return path.join(app.getPath('userData'), 'device-id')
}

function readPersistedUuid(): string {
  const file = deviceIdPath()
  try {
    const raw = fs.readFileSync(file, 'utf8').trim()
    if (raw) return raw
  } catch {
    // first run
  }
  const id = uuidv4()
  fs.writeFileSync(file, id, 'utf8')
  return id
}

export function getDeviceId(): string {
  const persisted = readPersistedUuid()
  return crypto.createHash('sha256').update(persisted).digest('hex')
}
