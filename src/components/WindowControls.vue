<template>
  <div
    class="window-controls no_drag"
    :class="[isMac ? 'is-mac' : 'is-win', `pos-${position}`]"
  >
    <template v-if="isMac">
      <button type="button" class="traffic close" title="关闭" @click="emitClose" />
      <button type="button" class="traffic min" title="最小化" @click="emitMinimize" />
      <button type="button" class="traffic max" title="全屏" @click="emitMaximize" />
    </template>
    <template v-else>
      <el-button class="window-btn" text @click="emitMinimize">
        <el-icon><Minus /></el-icon>
      </el-button>
      <el-button class="window-btn" text @click="emitMaximize">
        <el-icon><FullScreen /></el-icon>
      </el-button>
      <el-button class="window-btn close-btn" text @click="emitClose">
        <el-icon><Close /></el-icon>
      </el-button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Minus, FullScreen, Close } from '@element-plus/icons-vue'
import { invoke, send } from '../api/desktop'

withDefaults(defineProps<{
  /** sidebar = 侧栏顶栏；title = 内容顶栏；overlay = 解锁页等 */
  position?: 'sidebar' | 'title' | 'overlay'
}>(), {
  position: 'title',
})

const platform = ref<'darwin' | 'win32' | 'linux' | 'unknown'>('unknown')

const isMac = computed(() => {
  if (platform.value === 'darwin') return true
  if (platform.value === 'win32' || platform.value === 'linux') return false
  return /Mac|Darwin/i.test(navigator.userAgent || '')
})

onMounted(async () => {
  try {
    const info = await invoke<{ platform?: string }>('system:machine-info')
    if (info?.platform === 'darwin' || info?.platform === 'win32' || info?.platform === 'linux') {
      platform.value = info.platform
    }
  } catch {
    // fallback to UA
  }
})

const emitMinimize = () => send('minimize-window')
const emitMaximize = () => send('maximize-window')
const emitClose = () => send('close-window')
</script>

<style scoped>
.window-controls {
  display: flex;
  align-items: center;
  -webkit-app-region: no-drag;
}

.window-controls.is-win {
  height: 56px;
  align-items: stretch;
}

.window-controls.is-win.pos-overlay {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 10001;
}

.window-controls.is-mac {
  gap: 8px;
  height: auto;
  padding: 0 4px;
}

.window-controls.is-mac.pos-overlay {
  position: fixed;
  top: 14px;
  left: 14px;
  z-index: 10001;
}

.traffic {
  width: 12px;
  height: 12px;
  border: 0;
  border-radius: 50%;
  padding: 0;
  cursor: pointer;
  opacity: 0.9;
}

.traffic:hover {
  opacity: 1;
  filter: brightness(0.92);
}

.traffic.close {
  background: #ff5f57;
}

.traffic.min {
  background: #febc2e;
}

.traffic.max {
  background: #28c840;
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

.no_drag {
  -webkit-app-region: no-drag;
}
</style>
