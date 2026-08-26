/**
 * 桌面壳适配层：UI 只依赖本模块，不直接碰 Electron / Tauri。
 * - Electron：走 preload 暴露的 window.ipcRenderer
 * - Tauri：channel 名 `a:b` 映射为命令 `a_b`，经 @tauri-apps/api invoke/listen
 */

export type DesktopRuntime = 'electron' | 'tauri' | 'web'

type Unsubscribe = () => void

function hasElectronIpc(): boolean {
  return typeof window !== 'undefined' && !!(window as any).ipcRenderer?.invoke
}

function hasTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__
}

export function getDesktopRuntime(): DesktopRuntime {
  if (hasElectronIpc()) return 'electron'
  if (hasTauri()) return 'tauri'
  return 'web'
}

/** `history:add` → `history_add` */
export function toTauriCommand(channel: string): string {
  return channel.replace(/:/g, '_')
}

async function tauriInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  const cmd = toTauriCommand(channel)
  if (args.length === 0) return invoke<T>(cmd)
  if (args.length === 1) return invoke<T>(cmd, { payload: args[0] })
  return invoke<T>(cmd, { args })
}

export async function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  const runtime = getDesktopRuntime()
  if (runtime === 'electron') {
    return (window as any).ipcRenderer.invoke(channel, ...args) as Promise<T>
  }
  if (runtime === 'tauri') {
    return tauriInvoke<T>(channel, ...args)
  }
  throw new Error(`[desktop] invoke(${channel}) 仅支持 Electron / Tauri 运行时`)
}

export function send(channel: string, data?: unknown): void {
  const runtime = getDesktopRuntime()
  if (runtime === 'electron') {
    ;(window as any).ipcRenderer.send(channel, data)
    return
  }
  if (runtime === 'tauri') {
    // 窗控等无返回值命令：fire-and-forget
    void tauriInvoke(channel, data)
    return
  }
  throw new Error(`[desktop] send(${channel}) 仅支持 Electron / Tauri 运行时`)
}

export function on(channel: string, listener: (...args: unknown[]) => void): Unsubscribe {
  const runtime = getDesktopRuntime()
  if (runtime === 'electron') {
    const off = (window as any).ipcRenderer.on(channel, listener)
    return typeof off === 'function' ? off : () => {}
  }
  if (runtime === 'tauri') {
    let disposed = false
    let unlisten: Unsubscribe | null = null
    void import('@tauri-apps/api/event').then(({ listen }) => {
      if (disposed) return
      void listen(channel, (event) => {
        listener(event.payload)
      }).then((fn) => {
        if (disposed) fn()
        else unlisten = fn
      })
    })
    return () => {
      disposed = true
      unlisten?.()
      unlisten = null
    }
  }
  return () => {}
}
