import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/** Read a key from .env* files only (ignores polluted process.env / shell exports). */
function readEnvFileValue(mode: string, key: string): string {
  const files = [
    `.env.${mode}.local`,
    `.env.local`,
    `.env.${mode}`,
    `.env`,
  ]
  for (const file of files) {
    const full = path.join(process.cwd(), file)
    if (!fs.existsSync(full)) continue
    const text = fs.readFileSync(full, 'utf8')
    const re = new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`, 'm')
    const match = text.match(re)
    if (!match) continue
    return match[1].trim().replace(/^['"]|['"]$/g, '')
  }
  return ''
}

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const unlockApiUrl = (
    process.env.CZTOOL_UNLOCK_API_URL
    || readEnvFileValue(mode, 'VITE_UNLOCK_API_URL')
    || readEnvFileValue(mode, 'CZTOOL_UNLOCK_API_URL')
    || ''
  ).trim().replace(/\/$/, '')

  const isBuild = command === 'build'

  if (isBuild && !unlockApiUrl) {
    throw new Error(
      '[build] VITE_UNLOCK_API_URL is empty — set it in .env before packaging',
    )
  }
  if (isBuild) {
    console.log(`[build] unlock API → ${unlockApiUrl}`)
  }

  return {
    plugins: [vue()],
    clearScreen: false,
    // Tauri 固定 1420，避免与其它 Vite 默认 5173 冲突
    server: {
      host: 'localhost',
      port: 1420,
      strictPort: true,
    },
    envPrefix: ['VITE_', 'TAURI_'],
    define: {
      'import.meta.env.VITE_UNLOCK_API_URL': JSON.stringify(unlockApiUrl),
    },
  }
})
