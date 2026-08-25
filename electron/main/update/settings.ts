import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export interface UpdateSettings {
  autoCheck: boolean
}

const DEFAULTS: UpdateSettings = {
  autoCheck: true,
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'update-settings.json')
}

export function readUpdateSettings(): UpdateSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<UpdateSettings>
    return {
      autoCheck: typeof parsed.autoCheck === 'boolean' ? parsed.autoCheck : DEFAULTS.autoCheck,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeUpdateSettings(partial: Partial<UpdateSettings>): UpdateSettings {
  const next = { ...readUpdateSettings(), ...partial }
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}
