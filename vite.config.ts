import fs from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import pkg from './package.json'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  fs.rmSync('dist-electron', { recursive: true, force: true })

  const env = loadEnv(mode, process.cwd(), '')
  const unlockApiUrl = process.env.CZTOOL_UNLOCK_API_URL
    || process.env.VITE_UNLOCK_API_URL
    || env.CZTOOL_UNLOCK_API_URL
    || env.VITE_UNLOCK_API_URL
    || ''

  const isServe = command === 'serve'
  const isBuild = command === 'build'
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG

  return {
    plugins: [
      vue(),
      electron({
        main: {
          // Shortcut of `build.lib.entry`
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
                  'better-sqlite3'
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
        // Electron-builder configuration
        renderer: {},
      }),
    ],
    server: process.env.VSCODE_DEBUG && (() => {
      const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL)
      return {
        host: url.hostname,
        port: +url.port,
      }
    })(),
    clearScreen: false,
  }
})
