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

    <div class="hd-card">
      <div class="hd-field">
        <div class="hd-label">短链接</div>
        <div class="hd-value-row">
          <span
            class="hd-value-text mono linkish"
            @click="openUrl(content.shortUrl)"
          >{{ content.shortUrl || '—' }}</span>
          <el-button
            v-if="content.shortUrl"
            text
            type="primary"
            :icon="CopyDocument"
            @click="copyText(content.shortUrl, '短链已复制')"
          />
        </div>
      </div>

      <div class="hd-field">
        <div class="hd-label">原始链接</div>
        <div class="hd-value-row">
          <span
            class="hd-value-text mono linkish"
            @click="openUrl(content.originalUrl)"
          >{{ content.originalUrl || '—' }}</span>
          <el-button
            v-if="content.originalUrl"
            text
            type="primary"
            :icon="CopyDocument"
            @click="copyText(content.originalUrl, '原链接已复制')"
          />
        </div>
      </div>
    </div>

    <div v-if="content.shortUrl" class="hd-actions">
      <el-button type="primary" size="small" @click="openUrl(content.shortUrl)">打开短链</el-button>
      <el-button size="small" @click="copyText(content.shortUrl, '短链已复制')">复制短链</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Clock, CopyDocument } from '@element-plus/icons-vue'
import type { HistoryRecord } from '../../types'
import { openExternal } from '../../api/desktop'
import { copyText, formatHistoryTime, historyStatusText } from '../../utils/toolHelpers'

const props = defineProps<{ record: HistoryRecord }>()

const content = computed(() => {
  try {
    const data = JSON.parse(props.record.content)
    return {
      shortUrl: data.shortUrl || '',
      originalUrl: data.originalUrl || '',
    }
  } catch {
    return { shortUrl: '', originalUrl: '' }
  }
})

const openUrl = async (url: string) => {
  if (!url) return
  await openExternal(url)
}
</script>
