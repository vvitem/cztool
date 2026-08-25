<script setup lang="ts">
import { computed } from 'vue'
import type { HistoryRecord } from '../../types'
import { ElMessage } from 'element-plus'
import { 
  Link,
  VideoCamera as VideoPlay,
  Microphone as Headset,
  Clock,
  Share,
  Collection as Star,
  ChatLineRound as ChatDotRound,
  View as ThumbUp,
  Document as CopyDocument 
} from '@element-plus/icons-vue'

const props = defineProps<{
  record: HistoryRecord
}>()

// 解析内容
const content = computed(() => {
  try {
    const data = JSON.parse(props.record.content)
    return {
      author: data.author || '未知',
      desc: data.desc || '无描述',
      avatar: data.avatar,
      statistics: data.statistics || {},
      videoUrls: data.videoUrls || [],
      audioUrl: data.audioUrl,
      error: data.error
    }
  } catch (e) {
    return {
      author: '未知',
      desc: '无描述',
      avatar: '',
      statistics: {},
      videoUrls: [],
      audioUrl: '',
      error: '解析失败'
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

// 复制到剪贴板并显示提示
const copyWithTip = (text: string, type: string) => {
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success(`${type}已复制到剪贴板`)
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
  <div class="video-info">
    <div class="video-desc">
      <div class="desc-header">
        <div class="author-info">
          <el-avatar :src="content.avatar" :size="48" class="avatar" />
          <div class="author-details">
            <span class="author-name">{{ content.author }}</span>
            <el-tag
              :type="getStatusType(record.status)"
              :effect="getStatusEffect(record.status)"
              size="small"
              class="status-tag"
            >
              {{ getStatusText(record.status) }}
            </el-tag>
          </div>
        </div>
        <div class="time-info">
          <el-icon><Clock /></el-icon>
          <span>{{ formatDate(record.operationTime) }}</span>
        </div>
      </div>
      
      <div class="desc-text">
        <div class="info-item">
          <span class="info-label">视频描述</span>
          <div class="info-value-container">
            <el-tag size="large" class="value-tag">
              <span class="desc-content">{{ content.desc }}</span>
              <el-button
                class="copy-icon-btn"
                type="primary"
                link
                @click.stop="copyWithTip(content.desc, '视频描述')"
              >
                <el-icon><CopyDocument /></el-icon>
              </el-button>
            </el-tag>
          </div>
        </div>
      </div>
    </div>
    
    <div class="video-stats">
      <div class="stat-item">
        <el-icon><ThumbUp /></el-icon>
        <span class="stat-label">点赞</span>
        <span class="stat-value">{{ content.statistics?.digg || 0 }}</span>
      </div>
      <div class="stat-item">
        <el-icon><ChatDotRound /></el-icon>
        <span class="stat-label">评论</span>
        <span class="stat-value">{{ content.statistics?.comment || 0 }}</span>
      </div>
      <div class="stat-item">
        <el-icon><Star /></el-icon>
        <span class="stat-label">收藏</span>
        <span class="stat-value">{{ content.statistics?.collect || 0 }}</span>
      </div>
      <div class="stat-item">
        <el-icon><Share /></el-icon>
        <span class="stat-label">分享</span>
        <span class="stat-value">{{ content.statistics?.share || 0 }}</span>
      </div>
    </div>

    <template v-if="record.status === 'success'">
      <div class="video-actions">
        <div class="link-tags">
          <el-button
            v-for="link in content.videoUrls"
            :key="link.url"
            type="success"
            class="action-btn"
            @click="openLink(link.url)"
          >
            <el-icon><VideoPlay /></el-icon>
            {{ link.label }}
          </el-button>
          <el-button
            v-if="content.audioUrl"
            type="warning"
            class="action-btn"
            @click="openLink(content.audioUrl)"
          >
            <el-icon><Headset /></el-icon>
            音频
          </el-button>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="error-message">
        <el-alert
          :title="content.error"
          type="error"
          :closable="false"
          show-icon
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.video-info {
  padding: 24px;
  border-radius: 12px;
  background: var(--el-bg-color);
  box-shadow: var(--el-box-shadow-light);
  position: relative;
}

.video-desc {
  margin-bottom: 24px;
}

.desc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.author-info {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.author-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.avatar {
  border: 2px solid var(--el-color-primary-light-5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.author-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.2;
}

.status-tag {
  font-weight: 500;
  font-size: 12px;
  padding: 0 8px;
  height: 20px;
  line-height: 18px;
  margin-top: 2px;
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
  margin-left: auto;
}

.desc-text {
  margin-top: 16px;
}

.info-item {
  margin-bottom: 16px;
}

.info-label {
  display: block;
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.info-value-container {
  width: 100%;
}

.value-tag {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  height: auto;
  white-space: normal;
}

.desc-content {
  flex: 1;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
  margin-right: 8px;
}

.copy-icon-btn {
  flex-shrink: 0;
  padding: 4px;
  height: 24px;
  width: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
  opacity: 0.7;
}

.copy-icon-btn:hover {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.1);
}

.video-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  margin: 24px 0;
  padding: 16px;
  background: var(--el-fill-color-blank);
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.stat-label {
  color: var(--el-text-color-secondary);
}

.stat-value {
  font-weight: 500;
}

.video-actions {
  margin-top: 24px;
}

.link-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  font-weight: 500;
  height: auto;
  transition: all 0.3s ease;
}

.action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.error-message {
  margin-top: 20px;
}

/* 暗色主题适配 */
:root[theme-mode="dark"] .video-info {
  background: var(--el-bg-color-overlay);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
}

:root[theme-mode="dark"] .avatar {
  border-color: var(--el-color-primary-dark-3);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

:root[theme-mode="dark"] .time-info {
  background: var(--el-fill-color-dark);
}

:root[theme-mode="dark"] .value-tag {
  background: var(--el-bg-color);
  border-color: var(--el-border-color-darker);
}

:root[theme-mode="dark"] .video-stats {
  background: var(--el-bg-color);
  border-color: var(--el-border-color-darker);
}

:root[theme-mode="dark"] .stat-item {
  color: var(--el-text-color-regular);
}

:root[theme-mode="dark"] .action-btn:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

:root[theme-mode="dark"] .copy-icon-btn:hover {
  background-color: rgba(0, 0, 0, 0.2);
}
</style>
