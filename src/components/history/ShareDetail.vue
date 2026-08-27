<template>
  <div class="cz-history-detail">
    <div class="hd-meta">
      <span class="hd-pill" :class="'status-' + (record.status || 'info')">
        {{ historyStatusText(record.status) }}
      </span>
      <span class="hd-time">
        <el-icon><Clock /></el-icon>
        {{ formatHistoryTime(content.createdAt || record.operationTime) }}
      </span>
    </div>

    <template v-if="isFileShare">
      <div class="hd-hero">
        <div class="file-mark">
          <el-icon><Document /></el-icon>
        </div>
        <div style="min-width: 0">
          <div class="hd-hero-title">{{ content.sourceFileName || content.fileName || '文件' }}</div>
          <div class="hd-hero-sub">
            {{ content.fileSizeFormatted || '—' }}
            <template v-if="fileExt"> · {{ fileExt }}</template>
          </div>
        </div>
      </div>

      <div v-if="content.shareUrl" class="hd-card">
        <div class="hd-field">
          <div class="hd-label">分享链接</div>
          <div class="hd-value-row">
            <span class="hd-value-text mono linkish" @click="openUrl(content.shareUrl)">
              {{ content.shareUrl }}
            </span>
            <el-button
              text
              type="primary"
              :icon="CopyDocument"
              @click="copyText(content.shareUrl, '链接已复制')"
            />
          </div>
        </div>
      </div>

      <div v-else-if="content.error" class="hd-card">
        <el-alert :title="content.error" type="error" :closable="false" show-icon />
      </div>

      <div v-if="content.shareUrl" class="hd-actions">
        <el-button type="primary" size="small" @click="openUrl(content.shareUrl)">打开链接</el-button>
        <el-button size="small" @click="copyText(content.shareUrl, '链接已复制')">复制链接</el-button>
      </div>
    </template>

    <template v-else>
      <div class="hd-card">
        <div class="hd-section-title">文本预览</div>
        <div class="hd-preview">{{ content.textPreview || '—' }}</div>
      </div>

      <div v-if="content.shareUrl" class="hd-card">
        <div class="hd-field">
          <div class="hd-label">分享链接</div>
          <div class="hd-value-row">
            <span class="hd-value-text mono linkish" @click="openUrl(content.shareUrl)">
              {{ content.shareUrl }}
            </span>
            <el-button
              text
              type="primary"
              :icon="CopyDocument"
              @click="copyText(content.shareUrl, '链接已复制')"
            />
          </div>
        </div>
      </div>

      <div v-else-if="content.error" class="hd-card">
        <el-alert :title="content.error" type="error" :closable="false" show-icon />
      </div>

      <div v-if="content.shareUrl" class="hd-actions">
        <el-button type="primary" size="small" @click="openUrl(content.shareUrl)">打开链接</el-button>
        <el-button size="small" @click="copyText(content.shareUrl, '链接已复制')">复制链接</el-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Clock, CopyDocument, Document } from '@element-plus/icons-vue'
import type { HistoryRecord } from '../../types'
import { openExternal } from '../../api/desktop'
import { copyText, formatHistoryTime, historyStatusText } from '../../utils/toolHelpers'

const props = defineProps<{ record: HistoryRecord }>()

const content = computed(() => {
  try {
    return JSON.parse(props.record.content) as Record<string, any>
  } catch {
    return {}
  }
})

const isFileShare = computed(() => {
  if (props.record.contentType) {
    return ['file-share', 'file'].includes(props.record.contentType)
  }
  return props.record.appName === '文件分享'
})

const fileExt = computed(() => {
  const name = String(content.value.sourceFileName || '')
  const match = name.match(/\.([^.]+)$/i)
  return match ? match[1].toUpperCase() : ''
})

const openUrl = async (url: string) => {
  if (!url) return
  await openExternal(url)
}
</script>

<style scoped>
.file-mark {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: #0284c7;
  background: rgba(14, 165, 233, 0.12);
  border: 1px solid rgba(14, 165, 233, 0.14);
  flex-shrink: 0;
}
</style>
