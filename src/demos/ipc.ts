// Electron demo only — Tauri / 纯 Web 无 preload，不可访问 ipcRenderer
const ipc = (window as any).ipcRenderer
if (ipc?.on) {
  ipc.on('main-process-message', (_event: unknown, ...args: unknown[]) => {
    console.log('[Receive Main-process message]:', ...args)
  })
}
