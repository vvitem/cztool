/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  // Electron preload 暴露；Tauri 运行时不存在，改走 src/api/desktop.ts
  ipcRenderer?: import('electron').IpcRenderer
}
