# App Update Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 CZTool 接入 GitHub Releases 自动更新：启动可自动检查（可关）、发现即静默下载、就绪弹窗立即重启或退出安装。

**Architecture:** 主进程新增 `electron/main/update/`（设置持久化 + `electron-updater` IPC）；preload 白名单放开 `update:*`；设置页增加「关于与更新」区块；`App.vue` 监听 `downloaded` 弹一次就绪对话框。发布指向公开仓 `vvitem/cztool`，客户端不内置 Token。

**Tech Stack:** Electron + electron-updater + Vue 3 + Element Plus + TypeScript

**Spec:** `docs/superpowers/specs/2026-08-26-app-update-design.md`

**Working tree:** 在仓库根目录改 `src/`、`electron/`、`package.json`。若在 `.worktrees/ui-beautify` 实现，使用相同相对路径；设置页沿用 Soft Tile（`el-switch` + `--cz-*`）。本仓库无单元测试，每步用 `npx vue-tsc --noEmit`（若已有）或 `npm run dev` 目视验收；完整更新通路需打包后测。

---

## File map

| File | Responsibility |
|---|---|
| `package.json` | 加 `electron-updater`；`build.publish` → GitHub `vvitem/cztool` |
| `electron/main/update/settings.ts` | 读写 `userData/update-settings.json`（`autoCheck`） |
| `electron/main/update/index.ts` | 配置 `autoUpdater`、IPC、向渲染进程推送状态 |
| `electron/main/index.ts` | `registerUpdateIpc(getMainWindow)`；窗口就绪后调度自动检查 |
| `electron/preload/index.ts` | invoke/on 白名单加入 `update:*` |
| `src/components/Settings.vue` | 版本号、自动检查开关、手动检查、状态文案 |
| `src/App.vue` | 订阅 `update:status`；`downloaded` 时弹「立即重启 / 稍后」 |

不新增 `electron-store`；不做进度浮层；不签名。

---

### Task 1: 依赖与 publish 配置

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装依赖**

```bash
cd /Users/item/cztool   # 或对应 worktree 根目录
npm install electron-updater
```

Expected: `package.json` → `dependencies` 出现 `electron-updater`。

- [ ] **Step 2: 写入 publish**

在 `package.json` 的 `"build"` 对象内增加（与现有 `directories` / `mac` / `win` 并列）：

```json
"publish": [
  {
    "provider": "github",
    "owner": "vvitem",
    "repo": "cztool"
  }
]
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore: 接入 electron-updater 与 GitHub 发布配置

EOF
)"
```

---

### Task 2: 更新设置持久化

**Files:**
- Create: `electron/main/update/settings.ts`

- [ ] **Step 1: 创建设置读写模块**

```ts
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export interface UpdateSettings {
  autoCheck: boolean
}

const DEFAULTS: UpdateSettings = {
  autoCheck: true,
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'update-settings.json')
}

export function readUpdateSettings(): UpdateSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<UpdateSettings>
    return {
      autoCheck: typeof parsed.autoCheck === 'boolean' ? parsed.autoCheck : DEFAULTS.autoCheck,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeUpdateSettings(partial: Partial<UpdateSettings>): UpdateSettings {
  const next = { ...readUpdateSettings(), ...partial }
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}
```

- [ ] **Step 2: 确认目录会被主进程引用**

无需单独跑；下一任务 import 即可。

- [ ] **Step 3: Commit**

```bash
git add electron/main/update/settings.ts
git commit -m "$(cat <<'EOF'
feat(update): 本机持久化自动检查开关

EOF
)"
```

---

### Task 3: 主进程 update 模块 + IPC

**Files:**
- Create: `electron/main/update/index.ts`
- Modify: `electron/main/index.ts`（注册 + 启动调度）

- [ ] **Step 1: 实现 `electron/main/update/index.ts`**

```ts
import { BrowserWindow, app, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { readUpdateSettings, writeUpdateSettings } from './settings'

export type UpdateStatus =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available'; version: string }
  | { type: 'downloading'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }
  | { type: 'dev-skip'; message: string }

type GetWindow = () => BrowserWindow | null

let getWindow: GetWindow = () => null
let started = false
let lastDownloadedVersion: string | null = null

function sendStatus(status: UpdateStatus) {
  const win = getWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('update:status', status)
  }
}

function configureUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  // 公开仓无需 token；勿设置 GH_TOKEN 进客户端

  autoUpdater.on('checking-for-update', () => {
    sendStatus({ type: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    sendStatus({ type: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', (info) => {
    sendStatus({ type: 'not-available', version: info.version })
  })

  autoUpdater.on('download-progress', (p) => {
    sendStatus({ type: 'downloading', percent: Math.round(p.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    lastDownloadedVersion = info.version
    sendStatus({ type: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (err) => {
    sendStatus({ type: 'error', message: err?.message || String(err) })
  })
}

async function checkForUpdates(manual: boolean) {
  if (!app.isPackaged) {
    const status: UpdateStatus = {
      type: 'dev-skip',
      message: '开发环境不可用，请使用打包后的应用检查更新',
    }
    sendStatus(status)
    return { ok: false, ...status, manual }
  }

  try {
    const result = await autoUpdater.checkForUpdates()
    return { ok: true, manual, version: result?.updateInfo?.version }
  } catch (error: any) {
    const message = error?.message || '检查更新失败'
    sendStatus({ type: 'error', message })
    return { ok: false, manual, message }
  }
}

export function registerUpdateIpc(getMainWindow: GetWindow) {
  getWindow = getMainWindow
  if (!started) {
    configureUpdater()
    started = true
  }

  ipcMain.handle('update:get-version', () => app.getVersion())

  ipcMain.handle('update:get-settings', () => readUpdateSettings())

  ipcMain.handle('update:set-auto-check', (_e, autoCheck: boolean) => {
    return writeUpdateSettings({ autoCheck: Boolean(autoCheck) })
  })

  ipcMain.handle('update:check', async () => checkForUpdates(true))

  ipcMain.handle('update:quit-and-install', () => {
    autoUpdater.quitAndInstall(false, true)
    return { success: true }
  })
}

/** 窗口显示后调用：若开启自动检查则延迟执行 */
export function scheduleAutoUpdateCheck(delayMs = 4000) {
  const { autoCheck } = readUpdateSettings()
  if (!autoCheck) return
  setTimeout(() => {
    void checkForUpdates(false)
  }, delayMs)
}

export function getLastDownloadedVersion() {
  return lastDownloadedVersion
}
```

- [ ] **Step 2: 在 `electron/main/index.ts` 注册**

在文件顶部 import 区增加：

```ts
import { registerUpdateIpc, scheduleAutoUpdateCheck } from './update'
```

在现有 `registerRulesIpc()`（若无 rules 模块则放在其它 `ipcMain.handle` 注册附近）旁增加：

```ts
registerUpdateIpc(() => win)
```

在 `createWindow` 内、窗口 `ready-to-show` 或 `loadURL`/`loadFile` 成功之后调用一次（若已有 `ready-to-show` 监听，放进该回调末尾）：

```ts
scheduleAutoUpdateCheck(4000)
```

若当前用 `win.once('ready-to-show', ...)`，在 show 之后调度；否则在 `createWindow` 末尾调度亦可。

- [ ] **Step 3: 启动应用确认主进程无报错**

```bash
env -u ELECTRON_RUN_AS_NODE npm run dev
```

Expected: 应用能开；控制台无 `Cannot find module './update'`。

- [ ] **Step 4: Commit**

```bash
git add electron/main/update/index.ts electron/main/index.ts
git commit -m "$(cat <<'EOF'
feat(update): 主进程 electron-updater 与 IPC

EOF
)"
```

---

### Task 4: Preload 白名单

**Files:**
- Modify: `electron/preload/index.ts`

- [ ] **Step 1: 扩展 `on` / `once` / `invoke` 白名单**

在 `on` 与 `once` 的 `validChannels` 数组中加入：

```ts
'update:status',
```

在 `invoke` 的 `validChannels` 数组中加入：

```ts
'update:get-version',
'update:get-settings',
'update:set-auto-check',
'update:check',
'update:quit-and-install',
```

- [ ] **Step 2: 改善 `on` 返回取消订阅（推荐，避免泄漏）**

将 `on` 实现改为（保持其它 channel 逻辑不变）：

```ts
on: (channel: string, func: Function) => {
  const validChannels = [
    'input-dialog-response',
    'minimize-window',
    'maximize-window',
    'close-window',
    'update:status',
  ];
  if (validChannels.includes(channel)) {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: any[]) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  }
  return () => {};
},
```

`once` 的 validChannels 同样加入 `'update:status'`。

- [ ] **Step 3: 重启 Electron 使 preload 生效**，再 Commit

```bash
git add electron/preload/index.ts
git commit -m "$(cat <<'EOF'
feat(update): preload 放行更新 IPC 通道

EOF
)"
```

---

### Task 5: 设置页「关于与更新」

**Files:**
- Modify: `src/components/Settings.vue`

- [ ] **Step 1: 替换/扩展模板与脚本**

在现有「开机启动」区块下增加「关于与更新」。完整参考（Soft Tile 风格；若主仓仍是 Naive，把 `el-switch` 换成现有开关组件，逻辑不变）：

```vue
<template>
  <div class="settings">
    <div class="settings-panel">
      <div class="setting-item">
        <div class="setting-copy">
          <div class="setting-label">开机启动</div>
          <div class="setting-desc">登录系统后自动打开 CZTool</div>
        </div>
        <el-switch v-model="autoLaunch" @change="handleAutoLaunchChange" />
      </div>

      <div class="setting-divider" />

      <div class="setting-item">
        <div class="setting-copy">
          <div class="setting-label">当前版本</div>
          <div class="setting-desc">{{ appVersion || '—' }}</div>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-copy">
          <div class="setting-label">启动时自动检查更新</div>
          <div class="setting-desc">有新版本时后台下载，就绪后再提示</div>
        </div>
        <el-switch v-model="autoCheck" @change="handleAutoCheckChange" />
      </div>

      <div class="setting-item">
        <div class="setting-copy">
          <div class="setting-label">检查更新</div>
          <div class="setting-desc">{{ statusText }}</div>
        </div>
        <el-button size="small" type="primary" :loading="checking" @click="handleCheckUpdate">
          检查更新
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'

type UpdateStatus =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available'; version: string }
  | { type: 'downloading'; percent: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }
  | { type: 'dev-skip'; message: string }

const autoLaunch = ref(false)
const autoCheck = ref(true)
const appVersion = ref('')
const statusText = ref('尚未检查')
const checking = ref(false)
let offStatus: (() => void) | undefined

const getAutoLaunchStatus = async () => {
  try {
    autoLaunch.value = await window.ipcRenderer.invoke('settings:get-auto-launch')
  } catch (error) {
    console.error('Failed to get auto launch status:', error)
  }
}

const loadUpdateSettings = async () => {
  try {
    appVersion.value = await window.ipcRenderer.invoke('update:get-version')
    const s = await window.ipcRenderer.invoke('update:get-settings')
    autoCheck.value = !!s?.autoCheck
  } catch (error) {
    console.error(error)
  }
}

const handleAutoLaunchChange = async (value: string | number | boolean) => {
  try {
    await window.ipcRenderer.invoke('settings:set-auto-launch', Boolean(value))
    await getAutoLaunchStatus()
  } catch (error) {
    console.error(error)
    await getAutoLaunchStatus()
  }
}

const handleAutoCheckChange = async (value: string | number | boolean) => {
  try {
    const s = await window.ipcRenderer.invoke('update:set-auto-check', Boolean(value))
    autoCheck.value = !!s?.autoCheck
  } catch (error) {
    ElMessage.error('保存失败')
    await loadUpdateSettings()
  }
}

const applyStatus = (status: UpdateStatus, fromManual = false) => {
  switch (status.type) {
    case 'checking':
      statusText.value = '正在检查…'
      break
    case 'available':
      statusText.value = `发现 ${status.version}，开始下载…`
      break
    case 'downloading':
      statusText.value = `正在下载… ${status.percent}%`
      break
    case 'downloaded':
      statusText.value = `已就绪：${status.version}`
      checking.value = false
      break
    case 'not-available':
      statusText.value = '已是最新'
      checking.value = false
      if (fromManual) ElMessage.success('已是最新版本')
      break
    case 'dev-skip':
      statusText.value = status.message
      checking.value = false
      if (fromManual) ElMessage.info(status.message)
      break
    case 'error':
      statusText.value = `失败：${status.message}`
      checking.value = false
      if (fromManual) ElMessage.error(status.message)
      break
  }
}

const handleCheckUpdate = async () => {
  checking.value = true
  statusText.value = '正在检查…'
  try {
    const result = await window.ipcRenderer.invoke('update:check')
    if (result?.type === 'dev-skip' || result?.manual) {
      // 状态主要以 update:status 事件为准；dev-skip 时 invoke 也可能带回信息
    }
  } catch (error: any) {
    checking.value = false
    ElMessage.error(error?.message || '检查失败')
  }
}

onMounted(async () => {
  await getAutoLaunchStatus()
  await loadUpdateSettings()
  offStatus = window.ipcRenderer.on('update:status', (status: UpdateStatus) => {
    // 手动检查中：not-available / error / dev-skip 要 toast
    const manualToast = checking.value
    applyStatus(status, manualToast)
    if (status.type === 'not-available' || status.type === 'error' || status.type === 'dev-skip' || status.type === 'downloaded') {
      checking.value = false
    }
  }) as unknown as () => void
})

onBeforeUnmount(() => {
  offStatus?.()
})
</script>
```

在现有 scoped 样式中追加：

```css
.setting-divider {
  height: 1px;
  background: var(--cz-border);
  margin: 4px 0;
}
```

若主仓 Settings 尚无 Soft Tile class，保留原有 class 名，只保证上述绑定与 IPC 正确。

- [ ] **Step 2: Dev 验收**

1. 打开设置，应看到版本号（如 `28.1.0`）。  
2. 切换「启动时自动检查」后重启应用，开关状态保持。  
3. 点「检查更新」→ 应出现「开发环境不可用…」类提示（未打包）。

- [ ] **Step 3: Commit**

```bash
git add src/components/Settings.vue
git commit -m "$(cat <<'EOF'
feat(update): 设置页增加版本与检查更新

EOF
)"
```

---

### Task 6: 全局「更新已就绪」弹窗

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: 在 `App.vue` script 增加就绪处理**

在现有 `import` 中确保有：

```ts
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessageBox } from 'element-plus'
```

在 `<script setup>` 内增加（勿删现有逻辑）：

```ts
let promptedVersion: string | null = null
let offUpdateStatus: (() => void) | undefined

const handleUpdateStatus = async (status: { type: string; version?: string; message?: string }) => {
  if (status.type !== 'downloaded' || !status.version) return
  if (promptedVersion === status.version) return
  promptedVersion = status.version

  try {
    await ElMessageBox.confirm(
      `当前可安装新版本 ${status.version}。可立即重启安装，或稍后在退出应用时自动安装。`,
      '更新已就绪',
      {
        confirmButtonText: '立即重启',
        cancelButtonText: '稍后',
        type: 'info',
        distinguishCancelAndClose: true,
      },
    )
    await window.ipcRenderer.invoke('update:quit-and-install')
  } catch {
    // 稍后 / 关闭：依赖 autoInstallOnAppQuit
  }
}

onMounted(() => {
  offUpdateStatus = window.ipcRenderer.on('update:status', handleUpdateStatus) as unknown as () => void
})

onBeforeUnmount(() => {
  offUpdateStatus?.()
})
```

若 `App.vue` 已有 `onMounted`，合并进同一钩子，不要写两个 `onMounted` 覆盖。

- [ ] **Step 2: Dev 下无法真实弹出 downloaded**（无包）。用临时自测（可选）：在主进程 `registerUpdateIpc` 末尾加调试 IPC 仅本地验证后删除：

```ts
// DEBUG ONLY — 验证完删除
ipcMain.handle('update:debug-downloaded', () => {
  sendStatus({ type: 'downloaded', version: '99.0.0' })
})
```

渲染进程临时在控制台：`await window.ipcRenderer.invoke('update:debug-downloaded')`（需临时放行 preload）。确认弹窗出现后**删掉 debug handler 与白名单**再继续。

- [ ] **Step 3: Commit**

```bash
git add src/App.vue electron/main/update/index.ts electron/preload/index.ts
git commit -m "$(cat <<'EOF'
feat(update): 更新就绪弹窗与立即重启

EOF
)"
```

---

### Task 7: 发版说明（文档，短）

**Files:**
- Modify: `docs/superpowers/specs/2026-08-26-app-update-design.md`（仅在文末追加「实现备注」）**或** 不改 spec，在本 plan 验收即可。

推荐：在仓库根 `docs/superpowers/plans/` 不再另写长文；实现者按下列命令发版验证。

- [ ] **Step 1: 发版机准备**

```bash
export GH_TOKEN=ghp_xxx   # 对 vvitem/cztool 有 repo 写权限；勿提交
# 升版本后：
npm run build
npx electron-builder --publish always
```

Expected: [vvitem/cztool Releases](https://github.com/vvitem/cztool/releases) 出现对应 tag，含 `latest.yml`（Win）与/或 `latest-mac.yml`。

- [ ] **Step 2: 安装旧包 → 发新版 → 验证自动更新（Win 优先）**

清单：

- [ ] 自动检查开：启动数秒后开始下载（无打断）
- [ ] 就绪弹窗：立即重启 → 版本号变新
- [ ] 稍后 → 退出再开为新版本
- [ ] 自动检查关：启动不请求；手动检查仍可用
- [ ] Dev：`npm run dev` 点检查 → 开发环境提示，不打 GitHub

- [ ] **Step 3: 若本 task 无代码变更则跳过 commit**；若补了 README/注释再提交。

---

## Spec coverage checklist

| Spec 项 | Task |
|---|---|
| GitHub + electron-updater | 1, 3 |
| 公开仓 vvitem/cztool、无客户端 Token | 1, 3 |
| 启动自动检查 + 可关 + 手动检查 | 2, 3, 5 |
| 发现即静默下载 | 3（`autoDownload`） |
| 就绪弹窗立即重启 / 稍后退出装 | 3, 6 |
| mac + win publish | 1, 7 |
| 设置页 UI + 无进度浮层 | 5 |
| 未签名可接受 | 7 验收说明 |
| Dev 短路 | 3, 5 |

## Self-review notes

- 无 TBD/TODO 占位。  
- 状态类型在 Task 3/5/6 命名一致：`checking | available | not-available | downloading | downloaded | error | dev-skip`。  
- Preload `on` 返回 unsubscribe，与 Settings/App 卸载一致。  
- Debug IPC 必须在 Task 6 提交前删除。
