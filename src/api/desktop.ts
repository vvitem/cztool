/**
 * 桌面壳适配层：UI 只依赖本模块。
 * 当前壳为 Tauri；保留 web 以便 `npm run dev:web` 纯前端预览（IPC 不可用）。
 */

export type DesktopRuntime = 'tauri' | 'web'

type Unsubscribe = () => void

function hasTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__
}

export function getDesktopRuntime(): DesktopRuntime {
  if (hasTauri()) return 'tauri'
  return 'web'
}

/** `history:add` → `history_add`；`unlock:get-status` → `unlock_get_status` */
export function toTauriCommand(channel: string): string {
  return channel.replace(/[:.-]/g, '_')
}

async function tauriInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  const cmd = toTauriCommand(channel)
  if (args.length === 0) return invoke<T>(cmd)
  if (args.length === 1) return invoke<T>(cmd, { payload: args[0] })
  return invoke<T>(cmd, { args })
}

export async function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  if (getDesktopRuntime() === 'tauri') {
    return tauriInvoke<T>(channel, ...args)
  }
  throw new Error(`[desktop] invoke(${channel}) 仅支持 Tauri 运行时`)
}

/** 用系统默认浏览器打开链接（Tauri 内 window.open 无效） */
export async function openExternal(url: string): Promise<void> {
  const target = url.trim()
  if (!target) return
  if (getDesktopRuntime() === 'tauri') {
    await tauriInvoke('unlock:open-external', target)
    return
  }
  window.open(target, '_blank')
}

export function send(channel: string, data?: unknown): void {
  if (getDesktopRuntime() === 'tauri') {
    if (data === undefined) void tauriInvoke(channel)
    else void tauriInvoke(channel, data)
    return
  }
  throw new Error(`[desktop] send(${channel}) 仅支持 Tauri 运行时`)
}

/** 顶栏拖动窗口（备用；优先用 data-tauri-drag-region） */
export async function startWindowDrag(): Promise<void> {
  if (getDesktopRuntime() !== 'tauri') return
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  await getCurrentWindow().startDragging()
}

/** 双击顶栏：最大化 / 还原 */
export async function toggleMaximizeWindow(): Promise<void> {
  if (getDesktopRuntime() !== 'tauri') {
    send('maximize-window')
    return
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  const win = getCurrentWindow()
  if (await win.isMaximized()) await win.unmaximize()
  else await win.maximize()
}

export function on(channel: string, listener: (...args: unknown[]) => void): Unsubscribe {
  if (getDesktopRuntime() !== 'tauri') {
    return () => {}
  }
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
