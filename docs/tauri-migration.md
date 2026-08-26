# Tauri Migration (feat/tauri-migration)

本分支将 CZTool 从 Electron 迁到 [Tauri 2](https://github.com/tauri-apps/tauri)。`main` 继续维护 Electron 热修。

## 当前进度

- [x] 分支 `feat/tauri-migration`
- [x] Phase 0：脚手架 + `src/api/desktop.ts` + 渲染层适配
- [x] Phase 1：解锁 / 历史 SQLite / 机器信息 / 抖音·QQ HTTP / 开机启动 / 单实例 / 窗控
- [ ] Phase 2：规则中心 Rust FS
- [ ] Phase 3：自动更新与签名发布
- [ ] Phase 4：移除 Electron

### Phase 1 已实现的 Tauri 命令

`unlock_*`、`history_*`、`system_machine_info`、`douyin_parse`、`fetch_qq_nickname`、`settings_*_auto_launch`、窗控；`update_*` 暂为占位（Phase 3）。

首次启动会尝试从 Electron 旧目录拷贝 `data.db` / `device-id` / `unlock-session.json`。

## 本地命令

```bash
# Electron（功能完整，含规则中心）
npm run dev

# Tauri（Phase 1：解锁/历史/工具箱 HTTP；规则中心尚未接通）
CZTOOL_UNLOCK_SKIP=1 npm run dev:tauri
```

## 约定

- UI 禁止直接使用 `window.ipcRenderer`，统一走 `src/api/desktop.ts`
- Tauri 命令名：`history:add` → `history_add`
- 定期 `git merge main` 同步热修
