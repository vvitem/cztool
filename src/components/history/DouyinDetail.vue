<template>
  <div class="cz-history-detail">
    <div class="hd-meta">
      <span class="hd-pill" :class="'status-' + (record.status || 'info')">
        {{ historyStatusText(record.status) }}
      </span>
      <span class="hd-time">
        <el-icon><Clock /></el-icon>
        {{ formatHistoryTime(record.operationTime) }}
      </span>
    </div>

    <div class="hd-hero">
      <img
        v-if="content.cover"
        :src="content.cover"
        class="hd-avatar"
        alt="封面"
      />
      <div v-else class="hd-avatar" />
      <div style="min-width: 0">
        <div class="hd-hero-title">{{ content.title }}</div>
        <div class="hd-hero-sub">
          {{ content.author || '未知作者' }}
          <template v-if="content.type"> · {{ content.type }}</template>
        </div>
      </div>
    </div>

    <div v-if="content.error && record.status !== 'success'" class="hd-card">
      <el-alert :title="content.error" type="error" :closable="false" show-icon />
    </div>

    <template v-else>
      <div class="hd-card">
        <div class="hd-field">
          <div class="hd-label">标题</div>
          <div class="hd-value-row">
            <span class="hd-value-text">{{ content.title }}</span>
            <el-button text type="primary" :icon="CopyDocument" @click="copyText(content.title, '标题已复制')" />
          </div>
        </div>

        <div class="hd-field" v-if="content.originalUrl">
          <div class="hd-label">原始链接</div>
          <div class="hd-value-row">
            <span class="hd-value-text mono linkish" @click="openUrl(content.originalUrl)">
              {{ content.originalUrl }}
            </span>
            <el-button
              text
              type="primary"
              :icon="CopyDocument"
              @click="copyText(content.originalUrl, '链接已复制')"
            />
          </div>
        </div>
      </div>

      <div v-if="content.hasStats" class="hd-card">
        <div class="hd-section-title">数据</div>
        <div class="hd-stats">
          <div class="hd-stat">
            <div class="hd-stat-label">点赞</div>
            <div class="hd-stat-value">{{ content.statistics.digg || 0 }}</div>
          </div>
          <div class="hd-stat">
            <div class="hd-stat-label">评论</div>
            <div class="hd-stat-value">{{ content.statistics.comment || 0 }}</div>
          </div>
          <div class="hd-stat">
            <div class="hd-stat-label">收藏</div>
            <div class="hd-stat-value">{{ content.statistics.collect || 0 }}</div>
          </div>
          <div class="hd-stat">
            <div class="hd-stat-label">分享</div>
            <div class="hd-stat-value">{{ content.statistics.share || 0 }}</div>
          </div>
        </div>
      </div>

      <div
        v-if="content.videoUrls.length || content.audioUrl"
        class="hd-card"
      >
        <div class="hd-section-title">清晰度 / 打开</div>
        <div class="hd-actions">
          <el-button
            v-for="link in content.videoUrls"
            :key="link.url + link.label"
            type="primary"
            size="small"
            @click="openUrl(link.url)"
          >
            <el-icon class="btn-icon"><VideoPlay /></el-icon>
            {{ link.label }}
          </el-button>
          <el-button
            v-if="content.audioUrl"
            size="small"
            @click="openUrl(content.audioUrl)"
          >
            <el-icon class="btn-icon"><Headset /></el-icon>
            音频
          </el-button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  Clock,
  CopyDocument,
  VideoCamera as VideoPlay,
  Microphone as Headset,
} from '@element-plus/icons-vue'
import type { HistoryRecord } from '../../types'
import { openExternal } from '../../api/desktop'
import { copyText, formatHistoryTime, historyStatusText } from '../../utils/toolHelpers'

const props = defineProps<{ record: HistoryRecord }>()

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
      videoUrls: Array.isArray(data.videoUrls) ? data.videoUrls : [],
      audioUrl: data.audioUrl || '',
      originalUrl: data.originalUrl || '',
      error: data.error,
    }
  } catch {
    return {
      title: '无标题',
      type: '',
      cover: '',
      author: '',
      statistics: {} as Record<string, number>,
      hasStats: false,
      videoUrls: [] as { url: string; label: string }[],
      audioUrl: '',
      originalUrl: '',
      error: '解析失败',
    }
  }
})

const openUrl = async (url: string) => {
  if (!url) return
  await openExternal(url)
}
</script>

<style scoped>
.btn-icon {
  margin-right: 4px;
}
</style>
