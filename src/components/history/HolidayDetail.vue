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

    <div class="hd-hero compact">
      <div class="hero-mark">
        <el-icon><Calendar /></el-icon>
      </div>
      <div style="min-width: 0">
        <div class="hd-hero-title">{{ content.countryName || content.country || '—' }}</div>
        <div class="hd-hero-sub">
          {{ modeLabel }}
          <template v-if="content.year"> · {{ content.year }}</template>
          <template v-if="listItems.length"> · {{ listItems.length }} 条</template>
        </div>
      </div>
    </div>

    <div class="hd-card" v-if="listItems.length">
      <HolidayListView :mode="content.mode || 'holidays'" :items="listItems" />
    </div>
    <div class="hd-card" v-else>
      <div class="hd-value-row">
        <span class="hd-value-text" style="color: var(--cz-text-tertiary)">
          暂无明细（旧记录可能仅保存了查询条件）
        </span>
      </div>
    </div>

    <p class="attr">Source: caldays.com · CC BY 4.0</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Calendar, Clock } from '@element-plus/icons-vue'
import type { HistoryRecord } from '../../types'
import { formatHistoryTime, historyStatusText } from '../../utils/toolHelpers'
import HolidayListView from '../HolidayListView.vue'

const props = defineProps<{ record: HistoryRecord }>()

const content = computed(() => {
  try {
    return JSON.parse(props.record.content) as Record<string, any>
  } catch {
    return {}
  }
})

const modeLabel = computed(() =>
  content.value.mode === 'longWeekends' ? '长周末 / 调休' : '公共假期',
)

const listItems = computed(() => {
  if (content.value.mode === 'longWeekends') {
    return Array.isArray(content.value.longWeekends) ? content.value.longWeekends : []
  }
  return Array.isArray(content.value.holidays) ? content.value.holidays : []
})
</script>

<style scoped>
.hd-hero.compact {
  padding: 12px 14px;
}

.hero-mark {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #d97706;
  background: var(--cz-warning-soft);
  border: 1px solid rgba(245, 158, 11, 0.18);
  flex-shrink: 0;
}

.attr {
  margin: 0;
  font-size: 11px;
  color: var(--cz-text-tertiary);
}
</style>
