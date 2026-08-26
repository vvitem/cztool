<script setup lang="ts">
import { computed } from 'vue'
import type { HistoryRecord } from '../../types'
import { ElMessage } from 'element-plus'
import {
  VideoCamera as VideoPlay,
  Microphone as Headset,
  Clock,
  Document as CopyDocument,
} from '@element-plus/icons-vue'
import { openExternal } from '../../api/desktop'

const props = defineProps<{
  record: HistoryRecord
}>()

const content = computed(() => {
  try {
    const data = JSON.parse(props.record.content)
    const stats = data.statistics || {}
    const hasStats = !!(stats.digg || stats.comment || stats.collect || stats.share)

    return {
      title: data.title || data.desc || '无标题',
      type: data.type || '',
      cover: data.cover || data.avatar || '',
      author: data.author || '',
      statistics: stats,
      hasStats,
      videoUrls: data.videoUrls || [],
      audioUrl: data.audioUrl || '',
      originalUrl: data.originalUrl || '',
      error: data.error,
    }
  } catch (e) {
    return {
      title: '无标题',
      type: '',
      cover: '',
      author: '',
      statistics: {},
      hasStats: false,
      videoUrls: [],
      audioUrl: '',
      originalUrl: '',
      error: '解析失败',
    }
  }
})

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString()
}

const openLink = async (url: string) => {
  try {
    await openExternal(url)
  } catch (error: any) {
    ElMessage.error(error?.message || '打开链接失败')
  }
}

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

const getStatusType = (status: string) => {
  if (status === 'success') return 'success'
  if (status === 'error') return 'danger'
  return 'info'
}

const getStatusEffect = (status: string) => {
  return status === 'success' ? 'light' : 'dark'
}

const getStatusText = (status: string) => {
  if (status === 'success') return '成功'
  if (status === 'error') return '失败'
  return '未知'
}
</script>

<template>
  <div class="video-info">
    <div class="video-desc">
      <div class="desc-header">
        <div class="author-info">
          <el-avatar :src="content.cover" :size="56" class="avatar" shape="square" />
          <div class="author-details">
            <span class="author-name">{{ content.author || '抖音视频' }}</span>
            <div class="meta-row">
              <el-tag
                :type="getStatusType(record.status)"
                :effect="getStatusEffect(record.status)"
                size="small"
                class="status-tag"
              >
                {{ getStatusText(record.status) }}
              </el-tag>
              <el-tag v-if="content.type" size="small" type="info" effect="plain">
                {{ content.type }}
              </el-tag>
            </div>
          </div>
        </div>
        <div class="time-info">
          <el-icon><Clock /></el-icon>
          <span>{{ formatDate(record.operationTime) }}</span>
        </div>
      </div>

      <div class="desc-text">
        <div class="info-item">
          <span class="info-label">视频标题</span>
          <div class="info-value-container">
            <el-tag size="large" class="value-tag">
              <span class="desc-content">{{ content.title }}</span>
              <el-button
                class="copy-icon-btn"
                type="primary"
                link
                @click.stop="copyWithTip(content.title, '视频标题')"
              >
                <el-icon><CopyDocument /></el-icon>
              </el-button>
            </el-tag>
          </div>
        </div>

        <div v-if="content.originalUrl" class="info-item">
          <span class="info-label">原始链接</span>
          <div class="info-value-container">
            <el-tag size="large" class="value-tag">
              <span class="desc-content">{{ content.originalUrl }}</span>
              <el-button
                class="copy-icon-btn"
                type="primary"
                link
                @click.stop="copyWithTip(content.originalUrl, '原始链接')"
              >
                <el-icon><CopyDocument /></el-icon>
              </el-button>
            </el-tag>
          </div>
        </div>
      </div>
    </div>

    <div v-if="content.hasStats" class="video-stats">
      <div class="stat-item">
        <span class="stat-label">点赞</span>
        <span class="stat-value">{{ content.statistics?.digg || 0 }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">评论</span>
        <span class="stat-value">{{ content.statistics?.comment || 0 }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">收藏</span>
        <span class="stat-value">{{ content.statistics?.collect || 0 }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">分享</span>
        <span class="stat-value">{{ content.statistics?.share || 0 }}</span>
      </div>
    </div>

    <template v-if="record.status === 'success'">
      <div class="video-actions">
        <div class="section-label">清晰度 / 下载</div>
        <div class="link-tags">
          <el-button
            v-for="link in content.videoUrls"
            :key="link.url + link.label"
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
          :title="content.error || '解析失败'"
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
  padding: 20px;
  border-radius: 12px;
  background: var(--cz-surface, var(--el-bg-color));
}

.video-desc {
  margin-bottom: 16px;
}

.desc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--cz-border, var(--el-border-color-lighter));
  gap: 12px;
}

.author-info {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}

.author-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.avatar {
  border: 1px solid var(--cz-border, var(--el-border-color-lighter));
  border-radius: 10px;
  flex-shrink: 0;
}

.author-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--cz-text-primary, var(--el-text-color-primary));
  line-height: 1.2;
}

.meta-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.status-tag {
  font-weight: 500;
}

.time-info {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--cz-text-tertiary, var(--el-text-color-secondary));
  font-size: 12px;
  padding: 6px 10px;
  background: var(--cz-surface-tertiary, var(--el-fill-color-light));
  border-radius: 8px;
  flex-shrink: 0;
}

.info-item {
  margin-bottom: 14px;
}

.info-label {
  display: block;
  margin-bottom: 8px;
  color: var(--cz-text-tertiary, var(--el-text-color-secondary));
  font-size: 13px;
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
}

.video-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
  margin: 16px 0;
  padding: 12px;
  background: var(--cz-surface-tertiary, var(--el-fill-color-blank));
  border-radius: 10px;
  border: 1px solid var(--cz-border, var(--el-border-color-lighter));
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.stat-label {
  color: var(--cz-text-tertiary, var(--el-text-color-secondary));
}

.stat-value {
  font-weight: 500;
}

.section-label {
  font-size: 13px;
  color: var(--cz-text-tertiary, var(--el-text-color-secondary));
  margin-bottom: 10px;
}

.link-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: auto;
  padding: 10px 14px;
}

.error-message {
  margin-top: 12px;
}
</style>
