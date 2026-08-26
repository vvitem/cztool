# Tauri Migration (feat/tauri-migration)

本分支将 CZTool 从 Electron 迁到 [Tauri 2](https://github.com/tauri-apps/tauri)。**Phase 4 已完成：Electron 壳已移除。**

## 当前进度

- [x] 分支 `feat/tauri-migration`
- [x] Phase 0：脚手架 + `src/api/desktop.ts` + 渲染层适配
- [x] Phase 1：解锁 / 历史 SQLite / 机器信息 / 抖音·QQ HTTP / 开机启动 / 单实例 / 窗控
- [x] Phase 2：规则中心 Rust FS
- [x] Phase 3：`tauri-plugin-updater` + 签名密钥 + Release workflow
- [x] Phase 4：移除 Electron；版本 **30.0.0** 标明壳更换

## 本地命令

```bash
# 桌面端（默认）
CZTOOL_UNLOCK_SKIP=1 npm run dev

# 仅前端（无 IPC）
npm run dev:web

# 打包（安装包；需签名密钥）
export TAURI_SIGNING_PRIVATE_KEY_PATH="$PWD/src-tauri/.keys/cztool.key"
npm run build:tauri
```

> 说明：`npm run build` 仅构建前端（给 pre-push / CI 冒烟）；真正打桌面包用 `npm run build:tauri`。

## 发布

- Workflow：`.github/workflows/release-tauri.yml`（push `v*` tag）
- 更新清单：`latest.json`（旧 Electron `latest.yml` 客户端无法热更，需重装一次）
- Secrets：`TAURI_SIGNING_PRIVATE_KEY`、`CZTOOL_RELEASE_TOKEN`

## 约定

- UI 只走 `src/api/desktop.ts`
- 命令名：`history:add` → `history_add`；单参 `{ payload }`，多参 `{ args }`
