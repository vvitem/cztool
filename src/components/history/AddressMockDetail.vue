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
        <el-icon><Location /></el-icon>
      </div>
      <div style="min-width: 0">
        <div class="hd-hero-title">{{ content.typeLabel || content.type || '地址模拟' }}</div>
        <div class="hd-hero-sub">
          <template v-if="content.error">{{ content.error }}</template>
          <template v-else>
            {{ content.count ?? results.length }} 条
            <template v-if="content.gender && content.gender !== 'random'">
              · {{ content.gender === 'male' ? '男' : content.gender === 'female' ? '女' : content.gender }}
            </template>
            <template v-if="content.state"> · {{ content.state }}</template>
          </template>
        </div>
      </div>
    </div>

    <div class="hd-card" v-if="results.length">
      <AddressListView :items="results" />
    </div>
    <div class="hd-card" v-else-if="content.error">
      <el-alert :title="content.error" type="error" :closable="false" show-icon />
    </div>
    <div class="hd-card" v-else>
      <div class="hd-value-row">
        <span class="hd-value-text" style="color: var(--cz-text-tertiary)">暂无地址明细</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Clock, Location } from '@element-plus/icons-vue'
import type { HistoryRecord } from '../../types'
import { formatHistoryTime, historyStatusText } from '../../utils/toolHelpers'
import AddressListView, { type AddressItem } from '../AddressListView.vue'

const props = defineProps<{ record: HistoryRecord }>()

const content = computed(() => {
  try {
    return JSON.parse(props.record.content) as Record<string, any>
  } catch {
    return {}
  }
})

const results = computed<AddressItem[]>(() =>
  Array.isArray(content.value.results) ? content.value.results : [],
)
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
  color: #64748b;
  background: rgba(148, 163, 184, 0.16);
  border: 1px solid rgba(148, 163, 184, 0.2);
  flex-shrink: 0;
}
</style>
