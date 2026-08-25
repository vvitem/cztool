# CZTool 应用更新检查设计

**日期:** 2026-08-26  
**状态:** 已定稿（待实现计划）  
**范围:** 启动/设置检查更新、静默下载、就绪安装；GitHub Releases 发版对接

## 目标

为 CZTool 桌面端提供可靠的「检查 → 下载 → 安装」更新闭环：启动可自动检查（可关），发现新版本后**直接下载**，下载完成后提示立即重启或稍后在退出时安装。

## 已确认决策

| 项 | 选择 |
|---|---|
| 更新源 | GitHub Releases + `electron-updater` |
| 发布仓 | 公开仓 [vvitem/cztool](https://github.com/vvitem/cztool)（与 Coding 源码仓分离） |
| 检查时机 | 启动自动检查 + 设置页可关闭「自动检查」+ 手动「检查更新」 |
| 发现更新后 | 直接静默下载（不打断） |
| 安装时机 | 就绪弹窗：立即重启 / 稍后；稍后则退出应用时安装 |
| 平台 | macOS + Windows |
| UI | 设置页管控；仅「已就绪」弹窗（无下载进度浮层） |
| 代码签名 | 暂无；先发未签名包（接受 mac 限制），后续补签名 |

## 架构

```
设置页 / 启动时机
        │ IPC（白名单）
        ▼
主进程 update 模块（electron-updater）
        │ check / download / quitAndInstall
        ▼
GitHub Releases（vvitem/cztool）
  latest.yml / latest-mac.yml + 安装包
        │ 事件推送
        ▼
渲染进程：设置状态文案 + 「更新已就绪」弹窗
```

### 主进程（`electron/main/`）

- 新增独立模块（如 `update.ts`），职责单一：配置 `autoUpdater`、对外暴露检查/安装、把事件转成 IPC。
- `autoUpdater.autoDownload = true`：检查到更新即下载。
- `autoUpdater.autoInstallOnAppQuit = true`：用户选「稍后」后，退出时安装。
- 仅在 `app.isPackaged === true` 时启用真实检查；开发态短路并返回明确状态。
- 不在客户端打包任何 `GH_TOKEN`（公开仓拉取 Release 无需 Token）。

### Preload

白名单扩展（示例命名，实现时可微调但需保持语义）：

- invoke：`update:get-version`、`update:get-settings`、`update:set-auto-check`、`update:check`、`update:quit-and-install`
- on：`update:status`（checking / available / not-available / downloading / downloaded / error）

### 渲染进程

- **设置页**：当前版本、自动检查开关、手动检查按钮、一行状态文案。
- **全局就绪弹窗**：任一页面可收到 `downloaded` 后弹出一次；「立即重启」调 `quitAndInstall`，「稍后」关闭弹窗。
- 自动检查偏好持久化到本机：主进程读写 `app.getPath('userData')` 下的简单 JSON（如 `update-settings.json`），不新增 `electron-store` 依赖。

### 构建配置（`package.json`）

- 依赖：`electron-updater`
- `build.publish`：

```json
{
  "provider": "github",
  "owner": "vvitem",
  "repo": "cztool"
}
```

- 继续产出 Win nsis + Mac dmg/zip；发布时生成 `latest.yml` / `latest-mac.yml`。

## 交互细则

1. **启动**：若「自动检查」开启，主窗口就绪后延迟约 3–5 秒再 `checkForUpdates`，避免抢启动。
2. **手动检查**：按钮 loading；无更新 toast「已是最新」；失败 toast 错误信息。
3. **自动检查无更新 / 失败**：静默（可写设置页状态，不弹 toast）。
4. **下载中**：设置页状态为「正在下载…」；无浮层进度条。
5. **已就绪**：弹窗展示 `当前版本 → 新版本`；同会话同版本只弹一次。
6. **立即重启**：`quitAndInstall()`。
7. **稍后**：关弹窗；依赖 `autoInstallOnAppQuit`。

## 发版流程

1. 提升 `package.json` 的 `version`。
2. 本机或 CI 使用带 `repo` 写权限的 `GH_TOKEN` 执行 `electron-builder --publish always`（或等价 publish 步骤），产物上传到 [vvitem/cztool](https://github.com/vvitem/cztool) Releases。
3. Token 仅用于发布机，不进入客户端。
4. 源码继续在 Coding 开发；GitHub 仓专用于 Releases 产物上传（可不镜像全部源码）。发版机配置 `GH_TOKEN` 指向 `vvitem/cztool` 即可。

## 错误与边界

| 场景 | 行为 |
|---|---|
| 未打包（dev） | 不请求网络；提示开发环境不可用 |
| 网络失败 / 无 Release | 手动：toast；自动：静默；设置状态可显示失败 |
| 下载失败 | 状态「下载失败」，可再次检查重试 |
| 未签名包 | Win 优先验证通路；mac 尽力，失败时错误文案可读，不崩溃 |
| 重复就绪事件 | 会话内去重，避免连弹 |

## 明确不做（YAGNI）

- 下载进度浮层 / 托盘进度
- 强制更新、最低版本拦截
- 灰度 / 渠道（beta/stable）
- 私有仓 Token 内置
- 本次补齐 Apple / Windows 代码签名与公证（仅预留后续）

## 测试要点

- 打包后的 Win 安装包：旧版 → 发布新版 Release → 启动自动发现并下载 → 就绪弹窗 → 立即重启后版本号变化。
- 「稍后」路径：下载完成后退出应用，再启动应为新版本。
- 关闭自动检查后启动不再请求；手动检查仍可用。
- Dev 模式不误打 GitHub。
