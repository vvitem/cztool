<template>
  <div
    class="window-controls no_drag"
    :class="[isMac ? 'is-mac' : 'is-win', `pos-${position}`]"
    @dblclick.stop
    @mousedown.stop
  >
    <template v-if="isMac">
      <button type="button" class="traffic close" title="关闭" aria-label="关闭" @click="emitClose">
        <svg class="traffic-glyph" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M3.2 3.2l5.6 5.6M8.8 3.2L3.2 8.8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.35"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <button type="button" class="traffic min" title="最小化" aria-label="最小化" @click="emitMinimize">
        <svg class="traffic-glyph" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.4 6h7.2" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" />
        </svg>
      </button>
      <button
        type="button"
        class="traffic max"
        :title="maximized ? '还原' : '最大化'"
        :aria-label="maximized ? '还原' : '最大化'"
        @click="emitMaximize"
      >
        <svg v-if="!maximized" class="traffic-glyph" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M4.1 7.9L2.6 9.4M2.6 7.2v2.2H4.8M7.9 4.1L9.4 2.6M7.2 2.6h2.2V4.8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <svg v-else class="traffic-glyph" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M7.4 2.6H9.4V4.6M4.6 9.4H2.6V7.4M9.4 2.6L7 5M2.6 9.4L5 7"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </template>
    <template v-else>
      <button type="button" class="win-btn" title="最小化" aria-label="最小化" @click="emitMinimize">
        <svg class="win-icon" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M1 6h10" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        </svg>
      </button>
      <button
        type="button"
        class="win-btn"
        :title="maximized ? '还原' : '最大化'"
        :aria-label="maximized ? '还原' : '最大化'"
        @click="emitMaximize"
      >
        <svg v-if="!maximized" class="win-icon" viewBox="0 0 12 12" aria-hidden="true">
          <rect
            x="1.5"
            y="1.5"
            width="9"
            height="9"
            rx="0.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
          />
        </svg>
        <svg v-else class="win-icon" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M3.5 3.5h6v6h-6zM2.2 4.8V2.2h7.6v7.6H7.4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button type="button" class="win-btn win-close" title="关闭" aria-label="关闭" @click="emitClose">
        <svg class="win-icon" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M2.2 2.2l7.6 7.6M9.8 2.2L2.2 9.8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { invoke, send, getDesktopRuntime } from '../api/desktop'

withDefaults(defineProps<{
  /** sidebar = 侧栏顶栏；title = 内容顶栏；overlay = 解锁页等 */
  position?: 'sidebar' | 'title' | 'overlay'
}>(), {
  position: 'title',
})

const platform = ref<'darwin' | 'win32' | 'linux' | 'unknown'>('unknown')
const maximized = ref(false)
let unlistenResize: (() => void) | undefined

const isMac = computed(() => {
  if (platform.value === 'darwin') return true
  if (platform.value === 'win32' || platform.value === 'linux') return false
  return /Mac|Darwin/i.test(navigator.userAgent || '')
})

const refreshMaximized = async () => {
  if (getDesktopRuntime() !== 'tauri') return
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    maximized.value = await getCurrentWindow().isMaximized()
  } catch {
    // ignore
  }
}

onMounted(async () => {
  try {
    const info = await invoke<{ platform?: string }>('system:machine-info')
    if (info?.platform === 'darwin' || info?.platform === 'win32' || info?.platform === 'linux') {
      platform.value = info.platform
    }
  } catch {
    // fallback to UA
  }

  if (getDesktopRuntime() === 'tauri') {
    await refreshMaximized()
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      unlistenResize = await getCurrentWindow().onResized(() => {
        void refreshMaximized()
      })
    } catch {
      // ignore
    }
  }
})

onBeforeUnmount(() => {
  unlistenResize?.()
})

const emitMinimize = () => send('minimize-window')
const emitMaximize = () => {
  send('maximize-window')
  // 状态可能稍后才变，短暂后再读一次
  window.setTimeout(() => {
    void refreshMaximized()
  }, 80)
}
const emitClose = () => send('close-window')
</script>

<style scoped>
.window-controls {
  display: flex;
  align-items: center;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.window-controls.is-win {
  height: 56px;
  align-items: stretch;
  flex-shrink: 0;
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
  position: relative;
  width: 12px;
  height: 12px;
  border: 0;
  border-radius: 50%;
  padding: 0;
  cursor: default;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.18);
  transition: filter 0.12s ease;
}

.traffic:hover {
  filter: brightness(0.96);
}

.traffic:active {
  filter: brightness(0.88);
}

.traffic.close {
  background: #ff5f57;
  color: #4d0000;
}

.traffic.min {
  background: #febc2e;
  color: #995700;
}

.traffic.max {
  background: #28c840;
  color: #006500;
}

.traffic-glyph {
  width: 8px;
  height: 8px;
  display: block;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.08s ease;
}

/* 原生行为：悬停整组时三个按钮都显示标识 */
.window-controls.is-mac:hover .traffic-glyph,
.window-controls.is-mac:focus-within .traffic-glyph {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .traffic,
  .traffic-glyph {
    transition: none;
  }
}

.win-btn {
  box-sizing: border-box;
  width: 46px;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--cz-text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-app-region: no-drag;
  app-region: no-drag;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.win-btn:hover {
  background-color: rgba(148, 163, 184, 0.22);
  color: var(--cz-text-primary);
}

.win-btn:active {
  background-color: rgba(148, 163, 184, 0.34);
}

.win-close:hover {
  background-color: #e81123;
  color: #fff;
}

.win-close:active {
  background-color: #c50f1f;
  color: #fff;
}

.win-icon {
  width: 12px;
  height: 12px;
  display: block;
  pointer-events: none;
  flex-shrink: 0;
}

.no_drag {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}
</style>
