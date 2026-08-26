import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import pkg from './package.json'

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
  // electron（默认）| web（Tauri 前端 / 纯浏览器预览）
  const desktop = process.env.CZTOOL_DESKTOP || 'electron'
  const useElectron = desktop === 'electron'

  if (useElectron) {
    fs.rmSync('dist-electron', { recursive: true, force: true })
  }

  // loadEnv merges process.env over .env files — stale shell VITE_* (e.g. old
  // workers.dev) would otherwise win and break unlock on CN networks.
  // Read .env* ourselves; only CZTOOL_UNLOCK_API_URL is an explicit CI override.
  const unlockApiUrl = (
    process.env.CZTOOL_UNLOCK_API_URL
    || readEnvFileValue(mode, 'VITE_UNLOCK_API_URL')
    || readEnvFileValue(mode, 'CZTOOL_UNLOCK_API_URL')
    || ''
  ).trim().replace(/\/$/, '')

  const isServe = command === 'serve'
  const isBuild = command === 'build'
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG

  if (isBuild && !unlockApiUrl) {
    throw new Error(
      '[build] VITE_UNLOCK_API_URL is empty — set it in .env before packaging',
    )
  }
  if (isBuild) {
    console.log(`[build] desktop=${desktop} unlock API → ${unlockApiUrl}`)
  }

  const plugins: any[] = [vue()]

  if (useElectron) {
    plugins.push(
      electron({
        main: {
          entry: 'electron/main/index.ts',
          onstart({ startup }) {
            if (process.env.VSCODE_DEBUG) {
              console.log(/* For `.vscode/.debug.script.mjs` */'[startup] Electron App')
            } else {
              startup()
            }
          },
          vite: {
            define: {
              'process.env.VITE_UNLOCK_API_URL': JSON.stringify(unlockApiUrl),
              'process.env.CZTOOL_UNLOCK_API_URL': JSON.stringify(unlockApiUrl),
            },
            build: {
              sourcemap,
              minify: isBuild,
              outDir: 'dist-electron/main',
              rollupOptions: {
                external: [
                  ...Object.keys('dependencies' in pkg ? pkg.dependencies : {}),
                  'better-sqlite3',
                ],
              },
            },
          },
        },
        preload: {
          input: 'electron/preload/index.ts',
          vite: {
            build: {
              sourcemap: sourcemap ? 'inline' : undefined,
              minify: isBuild,
              outDir: 'dist-electron/preload',
              rollupOptions: {
                external: [
                  'electron',
                  ...Object.keys('dependencies' in pkg ? pkg.dependencies : {}),
                ],
              },
            },
          },
        },
        renderer: {},
      }),
    )
  }

  return {
    plugins,
    // Tauri 固定 1420，避免与 Electron / 其它 Vite（常占 5173）冲突
    clearScreen: false,
    server: !useElectron
      ? {
          host: 'localhost',
          port: 1420,
          strictPort: true,
        }
      : process.env.VSCODE_DEBUG
        ? (() => {
            const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL)
            return {
              host: url.hostname,
              port: +url.port,
            }
          })()
        : undefined,
    envPrefix: ['VITE_', 'TAURI_'],
  }
})
