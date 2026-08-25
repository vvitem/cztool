<script setup lang="ts">
import { computed } from 'vue'
import type { HistoryRecord } from '../../types'
import { ElMessage } from 'element-plus'
import { Link, CopyDocument, Clock } from '@element-plus/icons-vue'

const props = defineProps<{
  record: HistoryRecord
}>()

// 解析内容
const content = computed(() => {
  try {
    const data = JSON.parse(props.record.content)
    return {
      shortUrl: data.shortUrl || '',
      originalUrl: data.originalUrl || '',
      createdAt: data.createdAt || props.record.operationTime
    }
  } catch (e) {
    return {
      shortUrl: '',
      originalUrl: '',
      createdAt: props.record.operationTime
    }
  }
})

// 格式化日期
const formatDate = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

// 打开链接
const openLink = (url: string) => {
  window.open(url)
}

// 复制到剪贴板
const copyToClipboard = (text: string) => {
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success('复制成功')
  } catch (err) {
    ElMessage.error('复制失败')
  }
}

// 获取状态类型
const getStatusType = (status: string) => {
  switch (status) {
    case 'success':
      return 'success'
    case 'error':
      return 'danger'
    default:
      return 'info'
  }
}

// 获取状态效果
const getStatusEffect = (status: string) => {
  return status === 'success' ? 'light' : 'dark'
}

// 获取状态文本
const getStatusText = (status: string) => {
  switch (status) {
    case 'success':
      return '成功'
    case 'error':
      return '失败'
    default:
      return '未知'
  }
}
</script>

<template>
  <div class="shortlink-detail">
    <div class="shortlink-header">
      <div class="header-left">
        <el-tag type="warning" effect="dark" class="module-tag">
          <el-icon><Link /></el-icon>
          <span>短链生成</span>
        </el-tag>
        <el-tag 
          :type="getStatusType(record.status)"
          :effect="getStatusEffect(record.status)"
          class="status-tag"
        >
          {{ getStatusText(record.status) }}
        </el-tag>
      </div>
      <div class="header-right">
        <div class="time-info">
          <el-icon><Clock /></el-icon>
          <span>{{ formatDate(record.operationTime) }}</span>
        </div>
      </div>
    </div>

    <div class="shortlink-body">
      <div class="link-item">
        <div class="link-label">
          <el-icon><Link /></el-icon>
          <span>短链接</span>
        </div>
        <div class="link-content">
          <div class="url-container">
            <el-tag 
              type="success" 
              class="short-url"
              @click="openLink(content.shortUrl)"
            >
              <el-icon class="link-icon"><Link /></el-icon>
              {{ content.shortUrl }}
            </el-tag>
            <el-button
              type="primary"
              link
              size="small"
              @click.stop="copyToClipboard(content.shortUrl)"
            >
              <el-icon><CopyDocument /></el-icon>
            </el-button>
          </div>
        </div>
      </div>

      <div class="link-item">
        <div class="link-label">
          <el-icon><Link /></el-icon>
          <span>原始链接</span>
        </div>
        <div class="link-content">
          <div class="url-container">
            <span 
              class="original-url"
              @click="openLink(content.originalUrl)"
            >
              {{ content.originalUrl }}
            </span>
            <el-button
              type="primary"
              link
              size="small"
              @click.stop="copyToClipboard(content.originalUrl)"
            >
              <el-icon><CopyDocument /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <div class="shortlink-footer">
    </div>
  </div>
</template>

<style scoped>
.shortlink-detail {
  padding: 24px;
  background: var(--el-bg-color);
  border-radius: 8px;
  box-shadow: var(--el-box-shadow-light);
}

.shortlink-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.module-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-tag {
  margin-left: 4px;
}

.header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.time-info {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  padding: 6px 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

:root[theme-mode="dark"] .time-info {
  background: var(--el-fill-color-dark);
}

.shortlink-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.link-item {
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 16px;
}

.link-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
  font-size: 14px;
}

.link-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.url-container {
  flex: 1;
  min-width: 0; /* 防止flex子元素溢出 */
}

.short-url {
  cursor: pointer;
  padding: 8px 12px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.95em;
  letter-spacing: 0.3px;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: auto;
  max-width: 100%;
  word-break: break-all;
  line-height: 1.4;
  border: 1px solid var(--el-color-success-light-5);
  background-color: var(--el-color-success-light-9);
}

.short-url .link-icon {
  font-size: 14px;
  opacity: 0.8;
}

.short-url:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background-color: var(--el-color-success-light-8);
  border-color: var(--el-color-success-light-3);
}

:root[theme-mode="dark"] .short-url {
  background-color: var(--el-color-success-dark-9);
  border-color: var(--el-color-success-dark-5);
}

:root[theme-mode="dark"] .short-url:hover {
  background-color: var(--el-color-success-dark-8);
  border-color: var(--el-color-success-dark-3);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.original-url {
  color: var(--el-text-color-primary);
  cursor: pointer;
  word-break: break-all;
  font-family: monospace;
  transition: color 0.3s ease;
  padding: 8px;
  background: var(--el-bg-color);
  border-radius: 4px;
  line-height: 1.4;
}

.original-url:hover {
  color: var(--el-color-primary);
}

.shortlink-footer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  display: flex;
  justify-content: flex-end;
}

/* 暗色主题适配 */
:root[theme-mode="dark"] .shortlink-detail {
  background: var(--el-bg-color-overlay);
}

:root[theme-mode="dark"] .link-item {
  background: var(--el-bg-color);
}

:root[theme-mode="dark"] .original-url {
  background: var(--el-bg-color-overlay);
}
</style>
