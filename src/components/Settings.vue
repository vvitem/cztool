<template>
  <div class="settings">
    <div class="settings-content">
      <div class="setting-item">
        <div class="setting-copy">
          <div class="setting-label">开机启动</div>
        </div>
        <n-switch v-model:value="autoLaunch" @update:value="handleAutoLaunchChange" />
      </div>

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
        <n-switch v-model:value="autoCheck" @update:value="handleAutoCheckChange" />
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
import { NSwitch } from 'naive-ui'
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
    const isEnabled = await window.ipcRenderer.invoke('settings:get-auto-launch')
    autoLaunch.value = isEnabled
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

const handleAutoLaunchChange = async (value: boolean) => {
  try {
    await window.ipcRenderer.invoke('settings:set-auto-launch', value)
    await getAutoLaunchStatus()
  } catch (error) {
    console.error('Failed to set auto launch:', error)
    await getAutoLaunchStatus()
  }
}

const handleAutoCheckChange = async (value: boolean) => {
  try {
    const s = await window.ipcRenderer.invoke('update:set-auto-check', value)
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
    await window.ipcRenderer.invoke('update:check')
  } catch (error: any) {
    checking.value = false
    ElMessage.error(error?.message || '检查失败')
  }
}

onMounted(async () => {
  await getAutoLaunchStatus()
  await loadUpdateSettings()
  offStatus = window.ipcRenderer.on('update:status', (status: UpdateStatus) => {
    const manualToast = checking.value
    applyStatus(status, manualToast)
    if (
      status.type === 'not-available' ||
      status.type === 'error' ||
      status.type === 'dev-skip' ||
      status.type === 'downloaded'
    ) {
      checking.value = false
    }
  }) as unknown as () => void
})

onBeforeUnmount(() => {
  offStatus?.()
})
</script>

<style>
.settings {
  padding: 20px;
  color: #333;
}

.settings h2 {
  color: #333;
  margin-bottom: 20px;
}

.settings-content {
  margin-top: 20px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.2);
  gap: 16px;
}

.setting-copy {
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-size: 14px;
  color: #333;
}

.setting-desc {
  margin-top: 4px;
  font-size: 12px;
  color: #888;
  line-height: 1.4;
}
</style>
