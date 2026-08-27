<template>
  <div v-if="gate === 'checking'" class="boot-splash" data-tauri-drag-region />
  <UnlockGate v-else-if="gate === 'locked'" @unlocked="onUnlocked" />
  <div v-show="gate === 'open'" class="app">
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
        <div v-if="machineInfo || weather" class="sidebar-footer no_drag">
          <button
            v-if="weather"
            type="button"
            class="weather-block"
            :title="weatherHint"
            @click="loadWeather"
          >
            <div class="weather-mark">
              <el-icon><Sunny /></el-icon>
            </div>
            <div class="weather-text">
              <div class="weather-place">{{ weatherPlace }}</div>
              <div class="weather-line">
                <span class="weather-temp">{{ weatherTemp }}°</span>
                <span class="weather-summary">{{ weather.summary }}</span>
              </div>
              <div v-if="weatherMeta" class="weather-meta">{{ weatherMeta }}</div>
            </div>
          </button>

          <template v-if="machineInfo">
            <div class="machine-head">
              <div class="machine-mark" :class="'os-' + machineInfo.platform">
                <svg
                  v-if="machineInfo.platform === 'darwin'"
                  class="os-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
                  />
                </svg>
                <svg
                  v-else-if="machineInfo.platform === 'win32'"
                  class="os-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M3 5.5 10.5 4.4v7.1H3V5.5zm8.5-.9L21 3v8.5h-9.5V4.6zM3 13.5h7.5v7.1L3 19.5v-6zm8.5 0H21V21l-9.5-1.4v-6.1z"
                  />
                </svg>
                <svg
                  v-else
                  class="os-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M12.5 2c-.4 0-.8.1-1.1.3-.5.3-.8.8-.8 1.4v.4c-2.3.5-4 2.5-4 4.9v1.1c-.6.2-1 .8-1 1.4v1.6c0 .7.4 1.2 1 1.4l.4 4.2c.1 1.3 1.2 2.3 2.5 2.3h5c1.3 0 2.4-1 2.5-2.3l.4-4.2c.6-.2 1-.7 1-1.4v-1.6c0-.6-.4-1.2-1-1.4V8.9c0-2.2-1.5-4.1-3.5-4.8v-.5c0-.6-.3-1.1-.8-1.4-.3-.2-.7-.3-1.1-.2zm0 2.2c.1 0 .2 0 .2.1v.6h-.5V4.3c0-.1.1-.1.3-.1zM9.6 9.1h4.8c1.2 0 2.1 1 2.1 2.1v.9H7.5v-.9c0-1.1.9-2.1 2.1-2.1zm.9 9.1c-.5 0-.9-.3-1-.8l-.3-3.3h5.6l-.3 3.3c-.1.5-.5.8-1 .8h-3z"
                  />
                </svg>
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
          </template>
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
import { Grid, Clock, Setting, Cpu, User, Collection, Sunny } from '@element-plus/icons-vue'
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

interface WeatherInfo {
  city: string
  region?: string
  country?: string
  temperature: number
  apparent?: number | null
  humidity?: number | null
  windSpeed?: number | null
  summary: string
}

const sidebarWidth = ref(SIDEBAR.DEFAULT_WIDTH)
const isResizing = ref(false)
const startX = ref(0)
const startWidth = ref(0)
const machineInfo = ref<MachineInfo | null>(null)
const weather = ref<WeatherInfo | null>(null)
let machineInfoTimer: ReturnType<typeof setInterval> | null = null
let weatherTimer: ReturnType<typeof setInterval> | null = null

const toolList = ref<NavItem[]>([
  { id: 1, title: '工具箱', icon: Grid, active: true, component: ToolBox },
  { id: 2, title: '规则中心', icon: Collection, active: false, component: RulesCenter },
  { id: 3, title: '历史记录', icon: Clock, active: false, component: History },
  { id: 4, title: '设置', icon: Setting, active: false, component: Settings },
])

const activeItem = ref<NavItem>(toolList.value[0])
/** 先 checking，避免已解锁时闪现解锁页 */
const gate = ref<'checking' | 'locked' | 'open'>('checking')

const isMac = computed(() => {
  if (machineInfo.value?.platform === 'darwin') return true
  if (machineInfo.value?.platform === 'win32' || machineInfo.value?.platform === 'linux') return false
  return /Mac|Darwin/i.test(navigator.userAgent || '')
})

const shortCpuModel = computed(() => {
  const model = machineInfo.value?.cpuModel || 'CPU'
  return model
    .replace(/\(R\)|\(TM\)|CPU|@.*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || 'CPU'
})

const weatherPlace = computed(() => {
  const w = weather.value
  if (!w) return ''
  if (w.region && w.region !== w.city) return `${w.city} · ${w.region}`
  return w.city || '当前位置'
})

const weatherTemp = computed(() => {
  const t = weather.value?.temperature
  if (t == null || Number.isNaN(t)) return '--'
  return String(Math.round(t))
})

const weatherMeta = computed(() => {
  const w = weather.value
  if (!w) return ''
  const parts: string[] = []
  if (w.apparent != null) parts.push(`体感 ${Math.round(w.apparent)}°`)
  if (w.humidity != null) parts.push(`湿度 ${Math.round(w.humidity)}%`)
  return parts.join(' · ')
})

const weatherHint = computed(() => {
  const w = weather.value
  if (!w) return '点击刷新天气'
  const wind = w.windSpeed != null ? `风速 ${Math.round(w.windSpeed)} km/h` : ''
  return [weatherPlace.value, w.summary, wind, 'Open-Meteo · 点击刷新'].filter(Boolean).join(' · ')
})

const loadWeather = async () => {
  try {
    weather.value = await invoke('weather:current')
  } catch (error) {
    console.error('Failed to load weather:', error)
  }
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
  loadWeather()
  machineInfoTimer = setInterval(loadMachineInfo, 15000)
  weatherTimer = setInterval(loadWeather, 15 * 60 * 1000)
  offUpdateStatus = on('update:status', handleUpdateStatus) as unknown as () => void
}

const onUnlocked = () => {
  gate.value = 'open'
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
    gate.value = status?.locked ? 'locked' : 'open'
  } catch (err) {
    console.error('[unlock] get-status failed', err)
    gate.value = 'locked'
  }
  if (gate.value === 'open') {
    startAppServices()
  }
})

onBeforeUnmount(() => {
  if (machineInfoTimer) {
    clearInterval(machineInfoTimer)
    machineInfoTimer = null
  }
  if (weatherTimer) {
    clearInterval(weatherTimer)
    weatherTimer = null
  }
  offUpdateStatus?.()
})
</script>

<style>
.boot-splash {
  position: fixed;
  inset: 0;
  z-index: 10000;
  border-radius: 12px;
  background:
    linear-gradient(180deg, #e8f1fb 0%, var(--cz-bg, #f3f7fc) 42%, #eef4fb 100%);
}

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

.weather-block {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin: 0 0 12px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.weather-block:hover .weather-place {
  color: var(--cz-primary);
}

.weather-mark {
  width: 36px;
  height: 36px;
  border-radius: var(--cz-radius-tile);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;
  color: #d97706;
  background: var(--cz-warning-soft);
}

.weather-text {
  min-width: 0;
  flex: 1;
}

.weather-place {
  font-size: 12px;
  font-weight: 650;
  color: var(--cz-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.25;
}

.weather-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-top: 1px;
}

.weather-temp {
  font-size: 18px;
  font-weight: 700;
  color: var(--cz-text-primary);
  line-height: 1.1;
}

.weather-summary {
  font-size: 12px;
  color: var(--cz-text-secondary);
}

.weather-meta {
  margin-top: 2px;
  font-size: 10px;
  color: var(--cz-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.os-icon {
  width: 18px;
  height: 18px;
  display: block;
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
