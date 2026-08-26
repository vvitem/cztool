<template>
  <UnlockGate v-if="locked" @unlocked="onUnlocked" />
  <div v-show="!locked" class="app">
    <el-container class="main">
      <el-aside :width="sidebarWidth + 'px'" class="sidebar">
        <div
          class="sidebar-top drag"
          data-tauri-drag-region
          @dblclick="toggleMaximizeWindow"
        >
          <WindowControls v-if="isMac" position="sidebar" />
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
        <div v-if="machineInfo" class="sidebar-footer no_drag">
          <div class="machine-head">
            <div class="machine-mark" :class="'os-' + machineInfo.platform">
              <el-icon><Monitor /></el-icon>
            </div>
            <div class="machine-head-text">
              <div class="machine-label">本机</div>
              <div class="machine-host" :title="machineInfo.hostname">{{ machineInfo.hostname }}</div>
            </div>
          </div>

          <div class="machine-chips">
            <span class="machine-chip">{{ machineInfo.platformLabel }}</span>
            <span class="machine-chip">{{ machineInfo.arch }}</span>
            <span class="machine-chip">{{ machineInfo.cpuCores }} 核</span>
          </div>

          <div class="machine-stats">
            <div class="machine-stat" :title="machineInfo.cpuModel || 'CPU'">
              <el-icon class="stat-icon"><Cpu /></el-icon>
              <span class="stat-text">{{ shortCpuModel }}</span>
            </div>
            <div class="machine-stat" :title="machineInfo.username">
              <el-icon class="stat-icon"><User /></el-icon>
              <span class="stat-text">{{ machineInfo.username }}</span>
            </div>
          </div>

          <div class="machine-meters">
            <div class="machine-meter">
              <div class="meter-head">
                <span class="meter-label">内存</span>
                <span class="meter-percent" :class="memTone">{{ memPercent }}%</span>
              </div>
              <div class="meter-track">
                <div class="meter-fill" :class="memTone" :style="{ width: memPercent + '%' }" />
              </div>
              <div class="meter-text">
                <span>{{ formatBytes(machineInfo.usedMem) }}</span>
                <span class="meter-sep">/</span>
                <span>{{ formatBytes(machineInfo.totalMem) }}</span>
              </div>
            </div>

            <div v-if="machineInfo.disk" class="machine-meter">
              <div class="meter-head">
                <span class="meter-label" :title="machineInfo.disk.mount">磁盘</span>
                <span class="meter-percent" :class="diskTone">{{ diskPercent }}%</span>
              </div>
              <div class="meter-track">
                <div class="meter-fill" :class="diskTone" :style="{ width: diskPercent + '%' }" />
              </div>
              <div class="meter-text">
                <span>{{ formatBytes(machineInfo.disk.used) }}</span>
                <span class="meter-sep">/</span>
                <span>{{ formatBytes(machineInfo.disk.total) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div
          class="resize-handle"
          :class="{ resizing: isResizing }"
          @mousedown="startResize"
        />
      </el-aside>

      <el-main class="main_content">
        <div
          class="main_content_top drag"
          data-tauri-drag-region
          @dblclick="toggleMaximizeWindow"
        >
          <div class="page-title no_drag">{{ activeItem.title }}</div>
          <WindowControls v-if="!isMac" position="title" />
        </div>
        <div class="main_content_content">
          <keep-alive>
            <component :is="activeItem.component" :key="activeItem.id" />
          </keep-alive>
        </div>
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, type Component } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Grid, Clock, Setting, Monitor, Cpu, User, Collection } from '@element-plus/icons-vue'
import ToolBox from './components/ToolBox.vue'
import History from './components/History.vue'
import Settings from './components/Settings.vue'
import RulesCenter from './components/RulesCenter.vue'
import UnlockGate from './components/UnlockGate.vue'
import WindowControls from './components/WindowControls.vue'
import { invoke, on, toggleMaximizeWindow } from './api/desktop'

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

interface MachineInfo {
  hostname: string
  username: string
  platform: string
  platformLabel: string
  arch: string
  release: string
  cpuModel: string
  cpuCores: number
  totalMem: number
  freeMem: number
  usedMem: number
  disk: {
    mount: string
    total: number
    used: number
    free: number
  } | null
}

const sidebarWidth = ref(SIDEBAR.DEFAULT_WIDTH)
const isResizing = ref(false)
const startX = ref(0)
const startWidth = ref(0)
const machineInfo = ref<MachineInfo | null>(null)
let machineInfoTimer: ReturnType<typeof setInterval> | null = null

const toolList = ref<NavItem[]>([
  { id: 1, title: '工具箱', icon: Grid, active: true, component: ToolBox },
  { id: 2, title: '规则中心', icon: Collection, active: false, component: RulesCenter },
  { id: 3, title: '历史记录', icon: Clock, active: false, component: History },
  { id: 4, title: '设置', icon: Setting, active: false, component: Settings },
])

const activeItem = ref<NavItem>(toolList.value[0])
const locked = ref(true)

const isMac = computed(() => {
  if (machineInfo.value?.platform === 'darwin') return true
  if (machineInfo.value?.platform === 'win32' || machineInfo.value?.platform === 'linux') return false
  return /Mac|Darwin/i.test(navigator.userAgent || '')
})

const memPercent = computed(() => {
  if (!machineInfo.value?.totalMem) return 0
  return Math.min(100, Math.round((machineInfo.value.usedMem / machineInfo.value.totalMem) * 100))
})

const diskPercent = computed(() => {
  const disk = machineInfo.value?.disk
  if (!disk?.total) return 0
  return Math.min(100, Math.round((disk.used / disk.total) * 100))
})

const usageTone = (percent: number) => {
  if (percent >= 85) return 'danger'
  if (percent >= 70) return 'warn'
  return 'ok'
}

const memTone = computed(() => usageTone(memPercent.value))
const diskTone = computed(() => usageTone(diskPercent.value))

const shortCpuModel = computed(() => {
  const model = machineInfo.value?.cpuModel || 'CPU'
  return model
    .replace(/\(R\)|\(TM\)|CPU|@.*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || 'CPU'
})

const formatBytes = (bytes: number) => {
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 100) return `${gb.toFixed(0)} GB`
  return `${gb.toFixed(1)} GB`
}

const loadMachineInfo = async () => {
  try {
    machineInfo.value = await invoke('system:machine-info')
  } catch (error) {
    console.error('Failed to load machine info:', error)
  }
}

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

let promptedVersion: string | null = null
let offUpdateStatus: (() => void) | undefined

const startAppServices = () => {
  loadMachineInfo()
  machineInfoTimer = setInterval(loadMachineInfo, 15000)
  offUpdateStatus = on('update:status', handleUpdateStatus) as unknown as () => void
}

const onUnlocked = () => {
  locked.value = false
  startAppServices()
}

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
    await invoke('update:quit-and-install')
  } catch {
    // 稍后 / 关闭：依赖 autoInstallOnAppQuit
  }
}

onMounted(async () => {
  try {
    const status = await invoke<{ locked?: boolean }>('unlock:get-status')
    locked.value = !!status?.locked
  } catch (err) {
    console.error('[unlock] get-status failed', err)
    locked.value = true
  }
  if (!locked.value) {
    startAppServices()
  }
})

onBeforeUnmount(() => {
  if (machineInfoTimer) {
    clearInterval(machineInfoTimer)
    machineInfoTimer = null
  }
  offUpdateStatus?.()
})
</script>

<style>
.app {
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
}

.main { height: 100%; overflow: hidden; background: transparent; }

.sidebar {
  position: relative;
  height: 100%;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--cz-bg-elevated);
  border-right: 1px solid var(--cz-border);
  backdrop-filter: blur(10px);
}

.sidebar,
.sidebar * {
  scrollbar-width: none;
}

.sidebar::-webkit-scrollbar,
.sidebar *::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
  display: none;
}

.sidebar-top {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  border-bottom: 1px solid var(--cz-border);
  box-sizing: border-box;
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
  min-height: 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
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

.sidebar-footer {
  flex-shrink: 0;
  margin: 0 12px 12px;
  padding: 12px;
  border-radius: var(--cz-radius-card);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 251, 255, 0.96)),
    var(--cz-surface);
  border: 1px solid var(--cz-border);
  box-shadow: var(--cz-shadow-sm);
}

.machine-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.machine-mark {
  width: 36px;
  height: 36px;
  border-radius: var(--cz-radius-tile);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;
  color: var(--cz-primary-hover);
  background: var(--cz-primary-soft);
}

.machine-mark.os-darwin {
  color: #0284c7;
  background: rgba(14, 165, 233, 0.12);
}

.machine-mark.os-win32 {
  color: #2563eb;
  background: rgba(59, 130, 246, 0.12);
}

.machine-mark.os-linux {
  color: #d97706;
  background: var(--cz-warning-soft);
}

.machine-head-text {
  min-width: 0;
  flex: 1;
}

.machine-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--cz-text-tertiary);
  line-height: 1.2;
  margin-bottom: 2px;
}

.machine-host {
  font-size: 13px;
  font-weight: 650;
  color: var(--cz-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.25;
}

.machine-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}

.machine-chip {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 550;
  color: var(--cz-text-secondary);
  background: var(--cz-surface-tertiary);
  border: 1px solid var(--cz-border);
}

.machine-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.machine-stat {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 6px 8px;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.08);
}

.stat-icon {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--cz-primary);
}

.stat-text {
  min-width: 0;
  font-size: 11px;
  color: var(--cz-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.machine-meters {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 2px;
}

.machine-meter + .machine-meter {
  padding-top: 8px;
  border-top: 1px dashed var(--cz-border);
}

.meter-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.meter-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--cz-text-secondary);
}

.meter-percent {
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.meter-percent.ok { color: var(--cz-primary); }
.meter-percent.warn { color: #d97706; }
.meter-percent.danger { color: #dc2626; }

.meter-track {
  height: 6px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.22);
  overflow: hidden;
}

.meter-fill {
  height: 100%;
  border-radius: 999px;
  transition: width var(--cz-transition), background-color var(--cz-transition);
}

.meter-fill.ok {
  background: linear-gradient(90deg, #60a5fa, var(--cz-primary));
}

.meter-fill.warn {
  background: linear-gradient(90deg, #fbbf24, #d97706);
}

.meter-fill.danger {
  background: linear-gradient(90deg, #f87171, #dc2626);
}

.meter-text {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--cz-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.meter-sep {
  opacity: 0.55;
}

@media (prefers-reduced-motion: reduce) {
  .meter-fill {
    transition: none;
  }
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
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 0 20px;
  background: var(--cz-bg-elevated);
  border-bottom: 1px solid var(--cz-border);
  box-sizing: border-box;
}

.page-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--cz-text-primary);
}

.main_content_content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.drag {
  -webkit-app-region: drag;
  app-region: drag;
}
.no_drag {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}
</style>
