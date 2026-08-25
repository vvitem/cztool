<template>
  <div class="countdown-dialog">
    <el-form 
      :model="form" 
      label-width="100px" 
      class="countdown-form"
      label-position="top"
    >
      <el-form-item label="时间设置" class="time-setting">
        <div class="time-picker-wrapper">
          <el-time-picker
            v-model="timeValue"
            format="HH:mm:ss"
            placeholder="选择倒计时长"
            :default-value="defaultTime"
            @change="handleTimeChange"
            size="large"
          />
        </div>
      </el-form-item>
      
      <el-form-item label="触发类型">
        <el-select 
          v-model="form.actionType" 
          placeholder="选择触发类型"
          class="action-select"
          size="large"
        >
          <el-option label="关机" value="shutdown">
            <span class="option-label">
              <i class="el-icon-switch-button"></i>
              关机
            </span>
          </el-option>
          <el-option label="通知" value="notification">
            <span class="option-label">
              <i class="el-icon-bell"></i>
              通知
            </span>
          </el-option>
          <el-option label="打开URL" value="url">
            <span class="option-label">
              <i class="el-icon-link"></i>
              打开URL
            </span>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item v-if="form.actionType === 'url'" label="URL地址">
        <el-input 
          v-model="form.url" 
          placeholder="请输入要访问的URL"
          class="url-input"
          size="large"
        >
          <template #prefix>
            <i class="el-icon-link"></i>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item v-if="form.actionType === 'notification'" label="通知内容">
        <el-input 
          v-model="form.notificationText" 
          placeholder="请输入通知内容"
          type="textarea"
          :rows="3"
          class="notification-input"
          size="large"
        />
      </el-form-item>

      <el-form-item class="action-buttons">
        <el-button 
          type="primary" 
          @click="startCountdown"
          :disabled="isCountdownActive"
          class="start-button"
          round
          size="large"
        >
          开始倒计时
        </el-button>
      </el-form-item>
    </el-form>

    <transition name="fade">
      <div v-if="isCountdownActive" class="countdown-overlay">
        <div class="countdown-content">
          <div class="countdown-status">倒计时进行中</div>
          <div class="countdown-time">{{ displayTime }}</div>
          <el-button type="danger" size="small" @click="cancelCountdown">
            取消
          </el-button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'

const emit = defineEmits(['close'])
const ipcRenderer = window?.ipcRenderer

const form = ref({
  hours: 0,
  minutes: 0,
  seconds: 0,
  actionType: 'notification',
  url: '',
  notificationText: ''
})

const isCountdownActive = ref(false)
const remainingSeconds = ref(0)
let countdownInterval: NodeJS.Timer | null = null

const timeValue = ref(null)
const defaultTime = new Date(2000, 0, 1, 0, 0, 0)

const displayTime = computed(() => {
  const hours = Math.floor(remainingSeconds.value / 3600)
  const minutes = Math.floor((remainingSeconds.value % 3600) / 60)
  const seconds = remainingSeconds.value % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
})

const handleTimeChange = (val) => {
  if (val) {
    form.value.hours = val.getHours()
    form.value.minutes = val.getMinutes()
    form.value.seconds = val.getSeconds()
  } else {
    form.value.hours = 0
    form.value.minutes = 0
    form.value.seconds = 0
  }
}

watch([() => form.value.hours, () => form.value.minutes, () => form.value.seconds], () => {
  timeValue.value = new Date(2000, 0, 1, form.value.hours, form.value.minutes, form.value.seconds)
})

const startCountdown = () => {
  const totalSeconds = form.value.hours * 3600 + form.value.minutes * 60 + form.value.seconds
  if (totalSeconds === 0) {
    ElMessage.warning('请设置倒计时时间')
    return
  }

  if (form.value.actionType === 'url' && !form.value.url) {
    ElMessage.warning('请输入URL地址')
    return
  }

  if (form.value.actionType === 'notification' && !form.value.notificationText) {
    ElMessage.warning('请输入通知内容')
    return
  }

  remainingSeconds.value = totalSeconds
  isCountdownActive.value = true

  countdownInterval = setInterval(() => {
    if (remainingSeconds.value > 0) {
      remainingSeconds.value--
    } else {
      executeAction()
      cancelCountdown()
    }
  }, 1000)
}

const executeAction = async () => {
  try {
    switch (form.value.actionType) {
      case 'shutdown':
        const shutdownResult = await ipcRenderer.invoke('system:shutdown')
        if (!shutdownResult.success) {
          ElMessage.error(`关机失败: ${shutdownResult.error}`)
        }
        break
      case 'notification':
        const notificationResult = await ipcRenderer.invoke('system:notification', {
          title: '倒计时提醒',
          body: form.value.notificationText
        })
        if (!notificationResult.success) {
          ElMessage.error(`通知发送失败: ${notificationResult.error}`)
        }
        break
      case 'url':
        window.open(form.value.url, '_blank')
        break
    }
  } catch (error) {
    ElMessage.error(`操作执行失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const cancelCountdown = () => {
  if (countdownInterval) {
    clearInterval(Number(countdownInterval))
    countdownInterval = null
  }
  isCountdownActive.value = false
  remainingSeconds.value = 0
}

// 组件销毁时清理定时器
onBeforeUnmount(() => {
  if (countdownInterval) {
    clearInterval(Number(countdownInterval))
  }
})
</script>

<style scoped>
.countdown-dialog {
  padding: 24px;
}

.section-title {
  font-size: 1.5em;
  font-weight: 600;
  color: #409EFF;
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 2px solid #ebeef5;
  text-align: center;
}

.countdown-form {
  width: 100%;
}

.time-setting {
  margin-bottom: 32px;
}

.time-picker-wrapper {
  display: flex;
  justify-content: center;
  width: 100%;
}

.action-select {
  width: 100%;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-label i {
  font-size: 16px;
}

.url-input, .notification-input {
  width: 100%;
}

.action-buttons {
  margin-top: 32px;
  display: flex;
  justify-content: center;
}

.start-button {
  min-width: 160px;
  height: 44px;
  font-size: 16px;
}

.countdown-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.95);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.countdown-content {
  text-align: center;
  padding: 16px;
}

.countdown-status {
  color: #606266;
  font-size: 14px;
  margin-bottom: 8px;
}

.countdown-time {
  font-family: monospace;
  font-size: 24px;
  font-weight: 500;
  color: #409EFF;
  margin-bottom: 12px;
}

/* 动画效果 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .countdown-dialog {
    padding: 16px;
  }

  :deep(.el-time-picker) {
    width: 100%;
  }
}

/* 覆盖 Element Plus 的默认样式 */
:deep(.el-form-item__label) {
  font-weight: 500;
  padding-bottom: 8px;
}

:deep(.el-input-number) {
  width: 140px;
}

:deep(.el-input-number__decrease),
:deep(.el-input-number__increase) {
  border-radius: 0;
}

:deep(.el-select) {
  width: 100%;
}

:deep(.el-form--label-top .el-form-item__label) {
  text-align: center;
}

:deep(.el-form-item) {
  margin-bottom: 24px;
}

:deep(.el-form-item:last-child) {
  margin-bottom: 0;
}
</style>
