# CZTool UI Beautify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 CZTool 重建为双栏「清爽工具台」：贯通 `--cz-*` token、Soft Tile 工具卡、弹窗/历史/设置视觉对齐，且不改业务与 IPC。

**Architecture:** 先在 `src/style.css` 补齐 token 与 Element 覆盖；再重写 `App.vue` 为真双栏壳；随后把 `ToolBox` 换成 Soft Tile；最后对齐 History / Settings / 弹窗外观。本仓库无单元测试，每步用 `npm run dev` 目视验收 + 可选 `npx vue-tsc --noEmit`。

**Tech Stack:** Electron + Vue 3 + Vite + TypeScript + Element Plus（设置页现有 Naive `NSwitch` 改为 `el-switch` 以统一）

**Spec:** `docs/superpowers/specs/2026-08-25-ui-beautify-design.md`

---

## File map

| File | Responsibility |
|---|---|
| `src/style.css` | 全局 token、背景、Element 覆盖、`prefers-reduced-motion` |
| `src/App.vue` | 双栏壳：侧栏品牌+导航、主区顶栏+内容、拖拽调宽、窗口按钮 |
| `src/components/ToolBox.vue` | Soft Tile 网格、Element 图标、弹窗圆角覆盖 |
| `src/components/History.vue` | 列表容器/表头/标签/分页贴 token（业务逻辑不动） |
| `src/components/Settings.vue` | 表面卡片 + `el-switch` 替换 Naive |
| `src/components/dialogs/*Dialog.vue` | 仅必要时微调根容器 padding；优先靠全局 dialog 覆盖 |

不新建组件库文件；不启用 Favorites。

---

### Task 1: 全局 token 与 Element 覆盖

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: 扩展 `src/style.css`**

在现有 `:root` 上补全缺失变量，并追加 Element 映射与 reduced-motion。保留已有 `--cz-*` 值，追加如下内容到文件末尾（若某变量已存在则不要重复定义）：

```css
:root {
  /* 已有 token 保留；补充以下（若尚未定义） */
  --cz-radius-tile: 12px;
  --cz-radius-card: 16px;
  --el-color-primary: var(--cz-primary);
  --el-color-primary-light-3: #93c5fd;
  --el-color-primary-light-5: #bfdbfe;
  --el-color-primary-light-7: #dbeafe;
  --el-color-primary-light-8: #eff6ff;
  --el-color-primary-light-9: var(--cz-primary-soft);
  --el-color-primary-dark-2: var(--cz-primary-hover);
  --el-bg-color: transparent;
  --el-bg-color-page: transparent;
  --el-bg-color-overlay: var(--cz-surface);
  --el-text-color-primary: var(--cz-text-primary);
  --el-text-color-regular: var(--cz-text-secondary);
  --el-text-color-secondary: var(--cz-text-tertiary);
  --el-border-color: var(--cz-border);
  --el-border-color-light: var(--cz-border);
  --el-border-color-lighter: var(--cz-border);
  --el-border-radius-base: 10px;
  --el-border-radius-small: 8px;
  --el-box-shadow: var(--cz-shadow-sm);
  --el-box-shadow-light: var(--cz-shadow-sm);
}

.el-button--primary {
  --el-button-bg-color: var(--cz-primary);
  --el-button-border-color: var(--cz-primary);
  --el-button-hover-bg-color: var(--cz-primary-hover);
  --el-button-hover-border-color: var(--cz-primary-hover);
}

.el-dialog {
  border-radius: var(--cz-radius-card) !important;
  box-shadow: var(--cz-shadow-md) !important;
  border: 1px solid var(--cz-border);
  overflow: hidden;
}

.el-dialog__header {
  padding: 16px 20px !important;
  margin-right: 0 !important;
  border-bottom: 1px solid var(--cz-border);
}

.el-dialog__title {
  font-size: 15px !important;
  font-weight: 600 !important;
  color: var(--cz-text-primary) !important;
}

.el-dialog__body {
  padding: 16px 20px !important;
  color: var(--cz-text-primary);
}

.el-tag {
  border-radius: 999px;
}

.el-pagination {
  --el-pagination-button-bg-color: var(--cz-surface);
  justify-content: flex-end;
  padding: 12px 0;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

确保 `html, body` 仍使用既有浅蓝渐变背景（已存在则不动）。

- [ ] **Step 2: 目视确认全局背景**

Run: `npm run dev`  
Expected: 窗口背景为浅蓝灰渐变，不是纯白/深灰；Element 主色按钮接近 `#3b82f6`。

- [ ] **Step 3: Commit**

```bash
git add src/style.css
git commit -m "$(cat <<'EOF'
style: 贯通 cz token 与 Element 覆盖

为清爽工具台统一主色、对话框圆角与 reduced-motion。
EOF
)"
```

---

### Task 2: 重建双栏壳（App.vue）

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: 替换 `App.vue` 模板与脚本**

用下面结构整体替换当前三栏实现（去掉 `main_menu`、去掉未使用的 `Favorites` 导入）：

```vue
<template>
  <div class="app">
    <el-container class="main">
      <el-aside :width="sidebarWidth + 'px'" class="sidebar">
        <div class="sidebar-top drag">
          <div class="brand no_drag">
            <div class="brand-mark">CZ</div>
            <div class="brand-text">
              <div class="brand-name">CZTool</div>
              <div class="brand-sub">本机工具箱</div>
            </div>
          </div>
        </div>
        <div class="sidebar-nav no_drag">
          <button
            v-for="item in toolList"
            :key="item.id"
            type="button"
            class="nav-item"
            :class="{ active: item.active }"
            @click="handleItemClick(item)"
          >
            <el-icon class="nav-icon"><component :is="item.icon" /></el-icon>
            <span class="nav-title">{{ item.title }}</span>
          </button>
        </div>
        <div
          class="resize-handle"
          :class="{ resizing: isResizing }"
          @mousedown="startResize"
        />
      </el-aside>

      <el-main class="main_content">
        <div class="main_content_top drag">
          <div class="page-title no_drag">{{ activeItem.title }}</div>
          <div class="window-controls no_drag">
            <el-button class="window-btn" text @click="handleMinimize">
              <el-icon><Minus /></el-icon>
            </el-button>
            <el-button class="window-btn" text @click="handleMaximize">
              <el-icon><FullScreen /></el-icon>
            </el-button>
            <el-button class="window-btn close-btn" text @click="handleClose">
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
        </div>
        <div class="main_content_content">
          <component :is="activeItem.component" />
        </div>
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, type Component } from 'vue'
import { Minus, FullScreen, Close, Grid, Clock, Setting } from '@element-plus/icons-vue'
import ToolBox from './components/ToolBox.vue'
import History from './components/History.vue'
import Settings from './components/Settings.vue'

const SIDEBAR = {
  MIN_WIDTH: 200,
  MAX_WIDTH: 320,
  DEFAULT_WIDTH: 220,
}

interface NavItem {
  id: number
  title: string
  icon: Component
  active: boolean
  component: Component
}

const sidebarWidth = ref(SIDEBAR.DEFAULT_WIDTH)
const isResizing = ref(false)
const startX = ref(0)
const startWidth = ref(0)

const toolList = ref<NavItem[]>([
  { id: 1, title: '工具箱', icon: Grid, active: true, component: ToolBox },
  { id: 3, title: '历史记录', icon: Clock, active: false, component: History },
  { id: 4, title: '设置', icon: Setting, active: false, component: Settings },
])

const activeItem = ref<NavItem>(toolList.value[0])

const handleItemClick = (item: NavItem) => {
  toolList.value.forEach((i) => { i.active = false })
  item.active = true
  activeItem.value = item
}

const startResize = (e: MouseEvent) => {
  isResizing.value = true
  startX.value = e.clientX
  startWidth.value = sidebarWidth.value
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', stopResize)
}

const handleMouseMove = (e: MouseEvent) => {
  if (!isResizing.value) return
  const offset = e.clientX - startX.value
  let next = startWidth.value + offset
  next = Math.max(SIDEBAR.MIN_WIDTH, Math.min(SIDEBAR.MAX_WIDTH, next))
  sidebarWidth.value = next
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', stopResize)
}

const handleMinimize = () => { window?.ipcRenderer.send('minimize-window') }
const handleMaximize = () => { window?.ipcRenderer.send('maximize-window') }
const handleClose = () => { window?.ipcRenderer.send('close-window') }
</script>
```

- [ ] **Step 2: 替换 `App.vue` 的 `<style>`（非 scoped，保持与现结构一致）**

```css
.app { height: 100vh; overflow: hidden; }

.main { height: 100%; overflow: hidden; background: transparent; }

.sidebar {
  position: relative;
  height: 100%;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--cz-bg-elevated);
  border-right: 1px solid var(--cz-border);
  backdrop-filter: blur(10px);
}

.sidebar-top {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  border-bottom: 1px solid var(--cz-border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-mark {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--cz-primary), var(--cz-primary-hover));
}

.brand-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--cz-text-primary);
  line-height: 1.2;
}

.brand-sub {
  font-size: 11px;
  color: var(--cz-text-tertiary);
}

.sidebar-nav {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border: 0;
  background: transparent;
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  color: var(--cz-text-secondary);
  font-size: 14px;
  text-align: left;
  transition: background-color var(--cz-transition), color var(--cz-transition);
}

.nav-item:hover {
  background: var(--cz-primary-soft);
  color: var(--cz-primary);
}

.nav-item.active {
  background: var(--cz-primary);
  color: #fff;
}

.nav-icon { font-size: 16px; }

.nav-title {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.resize-handle {
  position: absolute;
  top: 0;
  right: -3px;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
  z-index: 100;
  background: transparent;
  transition: background-color var(--cz-transition);
}

.resize-handle:hover,
.resize-handle.resizing {
  background: rgba(59, 130, 246, 0.35);
}

.main_content {
  height: 100%;
  flex: 1;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
}

.main_content_top {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 0 20px;
  background: var(--cz-bg-elevated);
  border-bottom: 1px solid var(--cz-border);
}

.page-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--cz-text-primary);
}

.window-controls {
  display: flex;
  height: 50px;
  align-items: stretch;
}

.window-btn {
  width: 40px;
  height: 100%;
  margin: 0;
  padding: 0;
  border-radius: 0;
  color: var(--cz-text-primary);
}

.window-btn:hover {
  background-color: rgba(148, 163, 184, 0.2);
}

.close-btn:hover {
  background-color: #f56c6c;
  color: #fff;
}

.main_content_content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.drag { -webkit-app-region: drag; }
.no_drag { -webkit-app-region: no-drag; }
```

- [ ] **Step 3: 验收壳层**

Run: `npm run dev`  
Expected:
1. 无左侧深色 50px 窄栏  
2. 左侧有 CZ 品牌 + 三项导航  
3. 拖拽侧栏右缘宽度约在 200–320  
4. 窗口按钮仍可最小化/最大化/关闭  
5. 切换导航仍能打开工具箱/历史/设置  

- [ ] **Step 4: Commit**

```bash
git add src/App.vue
git commit -m "$(cat <<'EOF'
feat(ui): 重建双栏清爽壳层

移除深色窄栏，侧栏承载品牌与导航，主区保留拖拽顶栏与窗口控制。
EOF
)"
```

---

### Task 3: Soft Tile 工具箱

**Files:**
- Modify: `src/components/ToolBox.vue`

- [ ] **Step 1: 更新模板卡片结构与图标导入**

将工具卡模板改为：

```vue
<div
  v-for="tool in tools"
  :key="tool.id"
  class="tool-item"
  :class="[`tone-${tool.tone}`, { disabled: tool.type === 'more' }]"
  @click="handleToolClick(tool)"
>
  <div class="tool-icon">
    <el-icon><component :is="tool.icon" /></el-icon>
  </div>
  <div class="tool-name">{{ tool.name }}</div>
  <div class="tool-description">{{ tool.description }}</div>
</div>
```

在 `<script setup>` 增加图标导入，并改 `Tool` 类型与数据：

```ts
import {
  Search,
  VideoCamera,
  Upload,
  Link,
  Timer,
  MoreFilled,
} from '@element-plus/icons-vue'
import type { Component } from 'vue'

interface Tool {
  id: string
  name: string
  icon: Component
  type: string
  description?: string
  tone: 'blue' | 'cyan' | 'green' | 'indigo' | 'amber' | 'slate'
}

const tools = ref<Tool[]>([
  { id: 'qq', name: 'QQ号查询', icon: Search, type: 'qq', description: '快速查询QQ号信息', tone: 'blue' },
  { id: 'douyin', name: '抖音去水印', icon: VideoCamera, type: 'douyin', description: '无水印视频下载', tone: 'cyan' },
  { id: 'fileShare', name: '文件分享', icon: Upload, type: 'fileShare', description: '文件和文本分享', tone: 'green' },
  { id: 'urlShorten', name: '短链生成', icon: Link, type: 'shortlink', description: '生成短链接', tone: 'indigo' },
  { id: 'countdown', name: '倒计时工具', icon: Timer, type: 'countdown', description: '设置倒计时执行指定操作', tone: 'amber' },
  { id: 'share', name: '更多功能', icon: MoreFilled, type: 'more', description: '更多工具', tone: 'slate' },
])
```

保留 `currentDialog` / `showDialog` / `closeDialog` / `handleToolClick` 逻辑不变。

- [ ] **Step 2: 替换 scoped 样式为 Soft Tile**

```css
.tool-box {
  height: 100%;
  padding: 20px;
  overflow: auto;
  background: transparent;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
}

.tool-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 16px;
  border-radius: var(--cz-radius-card);
  cursor: pointer;
  background: var(--cz-surface);
  border: 1px solid var(--cz-border);
  box-shadow: var(--cz-shadow-sm);
  transition: transform var(--cz-transition), border-color var(--cz-transition), box-shadow var(--cz-transition);
}

.tool-item:hover {
  transform: translateY(-2px);
  border-color: var(--cz-border-strong);
}

.tool-item.disabled {
  opacity: 0.55;
}

.tool-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--cz-radius-tile);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.tone-blue .tool-icon { background: var(--cz-primary-soft); color: var(--cz-primary-hover); }
.tone-cyan .tool-icon { background: rgba(14, 165, 233, 0.12); color: #0284c7; }
.tone-green .tool-icon { background: var(--cz-success-soft); color: #16a34a; }
.tone-indigo .tool-icon { background: rgba(99, 102, 241, 0.12); color: #4f46e5; }
.tone-amber .tool-icon { background: var(--cz-warning-soft); color: #d97706; }
.tone-slate .tool-icon { background: rgba(148, 163, 184, 0.18); color: #64748b; }

.tool-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--cz-text-primary);
}

.tool-description {
  font-size: 12px;
  line-height: 1.4;
  color: var(--cz-text-tertiary);
}

:deep(.el-dialog) {
  border-radius: var(--cz-radius-card);
}

:deep(.el-dialog__header) {
  margin: 0;
  text-align: left;
}

:deep(.el-dialog__body) {
  padding: 16px 20px;
}
```

- [ ] **Step 3: 验收工具箱**

Run: `npm run dev` → 打开工具箱  
Expected:
1. 卡片为左对齐 Soft Tile，不是居中 Emoji  
2. 「更多功能」明显变淡  
3. 点击 QQ/抖音/短链/分享/倒计时仍能打开原弹窗  
4. 缩窄窗口时网格列数减少且无严重横向溢出  

- [ ] **Step 4: Commit**

```bash
git add src/components/ToolBox.vue
git commit -m "$(cat <<'EOF'
feat(ui): 工具箱改为 Soft Tile 图标卡

用 Element 图标与柔色砖替换 emoji，保留原有弹窗打开逻辑。
EOF
)"
```

---

### Task 4: 历史页视觉对齐

**Files:**
- Modify: `src/components/History.vue`（模板外层 class / scoped 样式；**不要**改 `getHistoryList`、解析函数、IPC）

- [ ] **Step 1: 调整容器与表头样式**

将根容器与表格相关内联 `header-cell-style` 改为更贴 token 的值：

```vue
:header-cell-style="{
  background: 'var(--cz-surface-secondary)',
  color: 'var(--cz-text-secondary)',
  fontWeight: '600',
  borderBottom: '1px solid var(--cz-border)'
}"
```

在 `<style scoped>` 中确保（新增或覆盖）：

```css
.history-container {
  height: 100%;
  padding: 16px 20px;
  background: transparent;
  box-sizing: border-box;
}

.history-content {
  height: 100%;
  background: var(--cz-surface);
  border: 1px solid var(--cz-border);
  border-radius: var(--cz-radius-card);
  box-shadow: var(--cz-shadow-sm);
  padding: 8px 12px 0;
  box-sizing: border-box;
  overflow: hidden;
}

:deep(.el-table) {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: var(--cz-surface-secondary);
  --el-table-row-hover-bg-color: var(--cz-primary-soft);
  --el-table-border-color: var(--cz-border);
}

:deep(.el-tag) {
  border-radius: 999px;
}

:deep(.el-pagination) {
  padding: 12px 4px 16px;
}
```

若表格 `height="calc(100vh - 120px)"` 导致双栏下溢出，改为：

```vue
height="100%"
```

并让 `.history-content` 使用 `display:flex; flex-direction:column;`，表格外包一层 `flex:1; min-height:0;`（仅布局，不改数据）。

- [ ] **Step 2: 验收历史**

Run: `npm run dev` → 切到历史记录  
Expected: 白底圆角面板、软标签、行 hover 浅蓝；列表/分页/详情弹窗仍可用；清除记录仍成功。

- [ ] **Step 3: Commit**

```bash
git add src/components/History.vue
git commit -m "$(cat <<'EOF'
style(ui): 历史页对齐清爽工具台

表面卡片、表头与 hover 使用 cz token，业务逻辑不变。
EOF
)"
```

---

### Task 5: 设置页统一到 Element

**Files:**
- Modify: `src/components/Settings.vue`

- [ ] **Step 1: 用 `el-switch` 替换 Naive，并套表面样式**

完整替换为：

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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const autoLaunch = ref(false)

const getAutoLaunchStatus = async () => {
  try {
    const isEnabled = await window.ipcRenderer.invoke('settings:get-auto-launch')
    autoLaunch.value = isEnabled
  } catch (error) {
    console.error('Failed to get auto launch status:', error)
  }
}

onMounted(() => {
  getAutoLaunchStatus()
})

const handleAutoLaunchChange = async (value: string | number | boolean) => {
  try {
    await window.ipcRenderer.invoke('settings:set-auto-launch', Boolean(value))
    await getAutoLaunchStatus()
  } catch (error) {
    console.error('Failed to set auto launch:', error)
    await getAutoLaunchStatus()
  }
}
</script>

<style scoped>
.settings {
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
}

.settings-panel {
  max-width: 560px;
  background: var(--cz-surface);
  border: 1px solid var(--cz-border);
  border-radius: var(--cz-radius-card);
  box-shadow: var(--cz-shadow-sm);
  padding: 8px 16px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
}

.setting-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--cz-text-primary);
}

.setting-desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--cz-text-tertiary);
}
</style>
```

注意：IPC channel 名必须保持 `settings:get-auto-launch` / `settings:set-auto-launch`。

- [ ] **Step 2: 验收设置**

Run: `npm run dev` → 设置  
Expected: 白底圆角面板 + Element 开关；切换后状态能写回（与改前行为一致）。

- [ ] **Step 3: Commit**

```bash
git add src/components/Settings.vue
git commit -m "$(cat <<'EOF'
refactor(ui): 设置页改用 Element Switch 并对齐样式

去掉 Naive 开关依赖该页，视觉并入清爽工具台。
EOF
)"
```

---

### Task 6: 弹窗细节扫尾 + 全站验收

**Files:**
- Modify (按需): `src/components/dialogs/*.vue` 根节点多余硬编码背景/边距  
- Verify: 全站

- [ ] **Step 1: 快速扫 dialog 根样式**

对每个 dialog，若根节点有硬编码 `background:#fff` / 过大 `padding` / 与全局冲突的边框，改为：

```css
.xxx-dialog {
  color: var(--cz-text-primary);
}
```

**不要**改请求、解析、`history:add` 组装逻辑。

- [ ] **Step 2: 全站验收清单**

Run: `npm run dev`

对照 spec 验收：

1. 双栏浅色壳，无深色窄栏  
2. Soft Tile 工具卡（非 Emoji 主视觉）  
3. 历史 / 设置 / 弹窗同一色板与圆角  
4. QQ / 抖音 / 短链 / 分享 / 倒计时流程可走通  
5. 缩窄窗口网格可收缩  
6. （可选）系统开启「减少动态效果」后无明显强位移动画  

可选类型检查：

```bash
npx vue-tsc --noEmit
```

Expected: 无因本次改动引入的新增类型错误（若仓库原本已有错误，只修本次文件相关）。

- [ ] **Step 3: 最终 Commit（若有 dialog 改动）**

```bash
git add src/components/dialogs
git commit -m "$(cat <<'EOF'
style(ui): 弹窗外观贴合全局 token

仅调整容器视觉，业务与 IPC 不变。
EOF
)"
```

若无文件变更则跳过 commit。

---

## Spec coverage self-check

| Spec 要求 | Task |
|---|---|
| 双栏壳 / 去深色窄栏 | Task 2 |
| `--cz-*` 贯通 + Element 覆盖 | Task 1 |
| Soft Tile + Element 图标 | Task 3 |
| 弹窗圆角白底 | Task 1 + 3 + 6 |
| 历史软标签 / hover | Task 4 |
| 设置对齐 | Task 5 |
| reduced-motion / focus | Task 1（已有 `:focus-visible`） |
| 不做深色/新库/改 IPC/启用收藏夹 | 全任务约束 |

## Placeholder / consistency notes

- 侧栏状态名统一为 `sidebarWidth` / `SIDEBAR`（不再用 `mainToolWidth` / `TOOL_CONFIG`）。
- 导航图标组件类型统一为 `Component`。
- Soft Tile `tone` 枚举固定六色，与 Task 3 样式类一一对应。
