# Tauri Migration (feat/tauri-migration)

本分支将 CZTool 从 Electron 迁到 [Tauri 2](https://github.com/tauri-apps/tauri)。`main` 继续维护 Electron 热修。

## 当前进度（Phase 0）

- [x] 分支 `feat/tauri-migration`
- [x] `src-tauri/` 脚手架（窗体 1400×800、无边框）
- [x] [`src/api/desktop.ts`](../src/api/desktop.ts) 适配层（Electron / Tauri 自动探测）
- [x] 渲染进程 IPC 调用已切到 `invoke` / `send` / `on`
- [x] npm scripts：`dev:web` / `dev:tauri` / `build:web` / `build:tauri`
- [ ] Phase 1：解锁 / 历史 SQLite / 系统信息 / HTTP
- [ ] Phase 2：规则中心 Rust FS
- [ ] Phase 3：自动更新与签名发布
- [ ] Phase 4：移除 Electron

## 本地命令

```bash
# 仍可用 Electron（默认）
npm run dev
npm run build

# 仅前端（给 Tauri 用）
npm run dev:web
npm run build:web

# Tauri 壳（Phase 0 仅有窗控等基础 command）
npm run dev:tauri
```

## 约定

- UI 禁止直接使用 `window.ipcRenderer`，统一走 `src/api/desktop.ts`
- Tauri 命令名：`history:add` → `history_add`
- 定期 `git merge main` 同步热修
