<template>
  <div class="app">
    <el-container class="main">
      <el-aside width="50px" class="main_menu drag">
        <div class="main_menu_bottom">
          <a style="margin: 10px auto" class="no_drag main_menu_bottom_item" href="#">
            <i class="el-icon-setting main_menu_icon" style="cursor: pointer;"></i>
          </a>
        </div>
      </el-aside>
      <el-aside :width="mainToolWidth + 'px'" class="main_tool">
        <div class="main_tool_top drag">
          <div class="tool-header">
            <span class="tool-title">{{ activeItem.title }}</span>
          </div>
        </div>
        <div class="main_tool_content">
          <el-scrollbar>
            <div class="tool-list">
              <div
                v-for="item in toolList"
                :key="item.id"
                class="tool-item"
                :class="{ 'active': item.active }"
                @click="handleItemClick(item)"
              >
                <span class="tool-item-icon">{{ item.icon }}</span>
                <span class="tool-item-title">{{ item.title }}</span>
              </div>
            </div>
          </el-scrollbar>
        </div>
        <div 
          class="resize-handle" 
          @mousedown="startResize"
          :class="{ 'resizing': isResizing }"
        ></div>
      </el-aside>
      <el-main class="main_content">
        <div class="main_content_top drag">
          <div class="window-controls">
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
        <div class="main_content_content" style="height: calc(100% - 50px);">
          <component :is="activeItem.component" />
        </div>
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Minus, FullScreen, Close } from '@element-plus/icons-vue'
import ToolBox from './components/ToolBox.vue'
import Favorites from './components/Favorites.vue'
import History from './components/History.vue'
import Settings from './components/Settings.vue'

// 配置常量
const TOOL_CONFIG = {
  MIN_WIDTH: 200,
  MAX_WIDTH: 400,
  DEFAULT_WIDTH: 100
}

interface ToolItem {
  id: number
  title: string
  icon: string
  active: boolean
  component: any
}

const mainToolWidth = ref(TOOL_CONFIG.DEFAULT_WIDTH)
const isResizing = ref(false)
const startX = ref(0)
const startWidth = ref(0)

// 列表数据
const toolList = ref<ToolItem[]>([
  { id: 1, title: '工具箱', icon: '🛠️', active: true, component: ToolBox },
  // { id: 2, title: '收藏夹', icon: '⭐', active: false, component: Favorites },
  { id: 3, title: '历史记录', icon: '📅', active: false, component: History },
  { id: 4, title: '设置', icon: '⚙️', active: false, component: Settings },
])

const activeItem = ref<ToolItem>(toolList.value[0])

const handleItemClick = (item: ToolItem) => {
  toolList.value.forEach(i => i.active = false)
  item.active = true
  activeItem.value = item
}

const startResize = (e: MouseEvent) => {
  isResizing.value = true
  startX.value = e.clientX
  startWidth.value = mainToolWidth.value
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', stopResize)
}

const handleMouseMove = (e: MouseEvent) => {
  if (!isResizing.value) return
  const offset = e.clientX - startX.value
  let newWidth = startWidth.value + offset
  newWidth = Math.max(TOOL_CONFIG.MIN_WIDTH, Math.min(TOOL_CONFIG.MAX_WIDTH, newWidth))
  mainToolWidth.value = newWidth
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', stopResize)
}

const handleMinimize = () => {
  window?.ipcRenderer.send('minimize-window')
}

const handleMaximize = () => {
  window?.ipcRenderer.send('maximize-window')
}

const handleClose = () => {
  window?.ipcRenderer.send('close-window')
}

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
</script>

<style>
.app {
  height: 100vh;
  overflow: hidden;
}

.main {
  height: 100%;
  overflow: hidden;
}

.main_menu {
  background: #2e2e2e;
  height: 100%;
  width: 50px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.main_menu_bottom {
  height: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 10px;
}

.main_menu_bottom_item:hover {
  background: transparent !important;
  border: 0px;
}

.main_menu_icon {
  color: #b0aeae;
  width: 20px;
  height: 20px;
}

.main_menu_icon:hover {
  color: white;
}

.main_tool {
  position: relative;
  height: 100%;
  min-width: 200px;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-lighter);
  border-left: 1px solid var(--el-border-color-lighter);
  box-shadow: 0 1px 3px rgba(27, 25, 25, 0.05);
}

.main_tool_top {
  height: 50px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  display: flex;
  align-items: center;
  padding: 0 16px;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.main_tool_content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  width: 100%;
  background: var(--el-bg-color-container);
}

.tool-list {
  padding: 4px;
  width: 100%;
  box-sizing: border-box;
}

.tool-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 6px;
  margin-bottom: 4px;
  width: 100%;
  box-sizing: border-box;
  color: var(--el-text-color-primary);
  background: transparent;
  transition: all 0.2s ease;
}

.tool-item:hover {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.tool-item.active {
  background: var(--el-color-primary);
  color: white;
}

.tool-item-icon {
  flex-shrink: 0;
  width: 20px;
  margin-right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.9;
}

.tool-item-title {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
}

.resize-handle {
  position: absolute;
  right: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
  background: transparent;
  z-index: 100;
  transition: background 0.2s ease;
}

.resize-handle:hover,
.resize-handle.resizing {
  background: var(--el-brand-color-hover);
}

.main_content {
  height: 100%;
  flex: 1;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.main_content_top {
  height: 50px;
  width: 100%;
  position: relative;
  display: flex;
  align-items: center;
  background-color: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
  -webkit-app-region: drag;
}

.window-controls {
  display: flex;
  position: fixed;
  top: 0;
  right: 0;
  height: 50px;
  -webkit-app-region: no-drag;
  z-index: 2000;
}

.window-btn {
  width: 40px;
  height: 100%;
  padding: 0;
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0;
  transition: all 0.2s ease;
  background: transparent;
  border: none;
  color: var(--el-text-color-primary);
}

.window-btn:hover {
  background-color: var(--el-color-info-light-8);
}

.close-btn:hover {
  background-color: #f56c6c;
  color: white;
}

.el-icon {
  font-size: 16px;
}

.main_content_content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* 隐藏所有滚动条 */
.main_tool_content::-webkit-scrollbar {
  display: none;
}

.drag {
  -webkit-app-region: drag;
}

.no_drag {
  -webkit-app-region: no-drag;
}

.main_menu_bottom_item {
  background: transparent !important;
  border: 0px;
}
</style>