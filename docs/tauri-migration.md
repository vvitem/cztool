# Tauri Migration (feat/tauri-migration)

本分支将 CZTool 从 Electron 迁到 [Tauri 2](https://github.com/tauri-apps/tauri)。`main` 继续维护 Electron 热修。

## 当前进度

- [x] 分支 `feat/tauri-migration`
- [x] Phase 0：脚手架 + `src/api/desktop.ts` + 渲染层适配
- [x] Phase 1：解锁 / 历史 SQLite / 机器信息 / 抖音·QQ HTTP / 开机启动 / 单实例 / 窗控
- [x] Phase 2：规则中心 Rust FS（扫描 / 读写 / create·sync / 选项目 / reveal·open / health·compare）
- [x] Phase 3：`tauri-plugin-updater` + 签名密钥 + Release workflow
- [ ] Phase 4：移除 Electron

### Phase 1 命令

`unlock_*`、`history_*`、`system_machine_info`、`douyin_parse`、`fetch_qq_nickname`、`settings_*_auto_launch`、窗控。

首次启动会尝试从 Electron 旧目录拷贝 `data.db` / `device-id` / `unlock-session.json`。

### Phase 2 命令

`rules_scan`、`rules_health`、`rules_read`、`rules_write`、`rules_reveal`、`rules_open`、`rules_compare`、`rules_create`、`rules_sync`、`rules_get_project`、`rules_clear_project`、`rules_pick_project`、`rules_scan_project`。

### Phase 3 更新

- 命令：`update_get_version`、`update_get_settings`、`update_set_auto_check`、`update_check`、`update_quit_and_install`
- 事件：`update:status`（checking / available / downloading / downloaded / not-available / error / dev-skip）
- 更新源：`https://github.com/vvitem/cztool/releases/latest/download/latest.json`（**不是** Electron 的 `latest.yml`）
- 签名：公钥写在 `src-tauri/tauri.conf.json`；私钥本机 `src-tauri/.keys/cztool.key`（已 gitignore），CI 用 Secret `TAURI_SIGNING_PRIVATE_KEY`
- Workflow：`.github/workflows/release-tauri.yml`（push `v*` tag）

**破坏性说明**：已安装的 Electron 客户端无法热更到 Tauri；需用户手动装一次 Tauri 包。

## 本地命令

```bash
# Electron（main / 热修）
npm run dev

# Tauri
CZTOOL_UNLOCK_SKIP=1 npm run dev:tauri

# 本机打带签名的更新产物
export TAURI_SIGNING_PRIVATE_KEY_PATH="$PWD/src-tauri/.keys/cztool.key"
npm run build:tauri
```

## 约定

- UI 禁止直接使用 `window.ipcRenderer`，统一走 `src/api/desktop.ts`
- Tauri 命令名：`history:add` → `history_add`；单参 `{ payload }`，多参 `{ args }`
- 定期 `git merge main` 同步热修
