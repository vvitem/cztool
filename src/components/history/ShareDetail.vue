<template>
  <div class="share-detail">
    <!-- 文件分享详情 -->
    <template v-if="isFileShare">
      <div class="share-header">
        <el-icon class="icon"><Document /></el-icon>
        <span class="title">文件分享</span>
        <el-tag :type="getStatusType" :effect="getStatusEffect" size="small" class="status-tag">
          {{ getStatusText }}
        </el-tag>
      </div>

      <div class="share-content" v-if="content.shareUrl">
        <div class="file-info-section">
          <div class="info-item">
            <span class="label"><el-icon><Document /></el-icon> 文件名称：</span>
            <span class="value">{{ content.fileName }}</span>
          </div>
          <div class="info-item">
            <span class="label"><el-icon><Document /></el-icon> 源文件：</span>
            <span class="value">{{ content.sourceFileName }}</span>
            <el-tag size="small" effect="plain" class="file-ext" v-if="getFileExtension">
              {{ getFileExtension }}
            </el-tag>
          </div>
          <div class="info-item">
            <span class="label"><el-icon><Files /></el-icon> 文件大小：</span>
            <span class="value">{{ content.fileSizeFormatted }}</span>
          </div>
        </div>

        <el-divider>
          <el-icon><Link /></el-icon>
          <span style="margin: 0 8px">分享链接</span>
        </el-divider>

        <div class="share-link-section">
          <el-input v-model="content.shareUrl" readonly>
            <template #append>
              <el-button-group class="button-group">
                <el-button @click="copyToClipboard(content.shareUrl)" type="info" plain>复制</el-button>
                <el-button @click="openLink(content.shareUrl)" type="primary">打开</el-button>
              </el-button-group>
            </template>
          </el-input>
        </div>
      </div>

      <!-- 错误状态显示 -->
      <div class="error-content" v-else-if="content.error">
        <el-alert
          :title="content.error"
          type="error"
          :closable="false"
          show-icon
        />
      </div>
    </template>

    <!-- 文本分享详情 -->
    <template v-else>
      <div class="share-header">
        <el-icon class="icon"><ChatLineSquare /></el-icon>
        <span class="title">文本分享</span>
        <el-tag :type="getStatusType" :effect="getStatusEffect" size="small" class="status-tag">
          {{ getStatusText }}
        </el-tag>
      </div>

      <div class="share-content" v-if="content.shareUrl">
        <div class="text-preview-section">
          <div class="preview-header">
            <el-icon><Document /></el-icon>
            <span>文本预览</span>
          </div>
          <div class="text-preview" ref="previewEl">{{ content.textPreview }}</div>
        </div>

        <el-divider>
          <el-icon><Link /></el-icon>
          <span style="margin: 0 8px">分享链接</span>
        </el-divider>

        <div class="share-link-section">
          <el-input v-model="content.shareUrl" readonly>
            <template #append>
              <el-button-group class="button-group">
                <el-button @click="copyToClipboard(content.shareUrl)" type="info" plain>复制</el-button>
                <el-button @click="openLink(content.shareUrl)" type="primary">打开</el-button>
              </el-button-group>
            </template>
          </el-input>
        </div>
      </div>

      <!-- 错误状态显示 -->
      <div class="error-content" v-else-if="content.error">
        <el-alert
          :title="content.error"
          type="error"
          :closable="false"
          show-icon
        />
      </div>
    </template>

    <div class="share-footer">
      <div class="info-item">
        <span class="label"><el-icon><Clock /></el-icon> 创建时间：</span>
        <span class="value">{{ formatDate(content.createdAt || record.operationTime) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import type { HistoryRecord } from '../../types'
import { ElMessage } from 'element-plus'
import { 
  Document, 
  Link, 
  Clock, 
  Files,
  ChatLineSquare
} from '@element-plus/icons-vue'

const props = defineProps<{
  record: HistoryRecord
}>()

const previewEl = ref(null)

// 解析内容
const content = computed(() => {
  try {
    const parsedContent = JSON.parse(props.record.content)
    console.log('原始文本预览内容:', parsedContent.textPreview)
    return parsedContent
  } catch (e) {
    return {}
  }
})

// 获取文件后缀
const getFileExtension = computed(() => {
  if (!content.value.sourceFileName) return null
  const match = content.value.sourceFileName.match(/\.([^.]+)$/i)
  return match ? match[1].toUpperCase() : null
})

// 判断是否为文件分享
const isFileShare = computed(() => {
  if (props.record.contentType) {
    return ['file-share', 'file'].includes(props.record.contentType)
  }
  return props.record.appName === '文件分享'
})

// 格式化日期
const formatDate = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

// 格式化文件大小
const formatFileSize = (bytes: number) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
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
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

// 打开链接
const openLink = (url: string) => {
  window.open(url)
}

// 获取状态类型
const getStatusType = computed(() => {
  switch (props.record.status) {
    case 'success':
      return 'success'
    case 'error':
      return 'danger'
    case 'running':
      return 'warning'
    default:
      return 'info'
  }
})

// 获取状态效果
const getStatusEffect = computed(() => {
  return props.record.status === 'success' ? 'light' : 'plain'
})

// 获取状态文本
const getStatusText = computed(() => {
  switch (props.record.status) {
    case 'success':
      return '成功'
    case 'error':
      return '失败'
    case 'running':
      return '进行中'
    default:
      return '未知'
  }
})

// 监控文本预览内容
onMounted(() => {
  if (!isFileShare.value && previewEl.value) {
    console.log('文本预览DOM内容:', previewEl.value.textContent)
  }
})
</script>

<style scoped>
.share-detail {
  padding: 16px;
  background-color: var(--el-bg-color);
  border-radius: 8px;
}

.share-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  gap: 8px;
}

.share-header .icon {
  font-size: 24px;
  color: var(--el-color-primary);
}

.share-header .title {
  font-size: 18px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.share-header .status-tag {
  margin-left: auto;
}

.share-content {
  padding: 16px;
  background-color: var(--el-fill-color-blank);
  border-radius: 4px;
  margin-bottom: 16px;
}

.file-info-section {
  padding: 12px;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
  margin-bottom: 16px;
}

.text-preview-section {
  padding: 12px;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
  margin-bottom: 16px;
}

.text-preview-section .preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.text-preview-section .text-preview {
  padding: 12px;
  background-color: var(--el-bg-color-page);
  border-radius: 4px;
  color: var(--el-text-color-regular);
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}

.share-link-section {
  margin-top: 16px;
}

.share-link-section :deep(.el-input-group__append) {
  padding: 0;
  background-color: transparent;
}

.share-link-section :deep(.button-group) {
  display: inline-flex;
  gap: 1px;
}

.share-link-section :deep(.button-group .el-button) {
  margin: 0;
  border-radius: 0;
  padding: 8px 16px;
  font-size: 14px;
}

.share-link-section :deep(.button-group .el-button:first-child) {
  border-right: 1px solid var(--el-border-color-light);
}

.share-link-section :deep(.button-group .el-button:last-child) {
  border-left: none;
}

.info-item {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-item .label {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--el-text-color-secondary);
  min-width: 80px;
}

.info-item .value {
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.info-item .file-ext {
  margin-left: 8px;
  text-transform: uppercase;
}

.url-container {
  flex: 1;
}

.share-footer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

:deep(.el-divider__text) {
  display: flex;
  align-items: center;
  color: var(--el-text-color-secondary);
}

.error-content {
  margin: 16px 0;
}
</style>
