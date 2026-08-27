<template>
  <div class="holiday-list">
    <template v-if="mode === 'holidays' && monthGroups.length">
      <div v-for="group in monthGroups" :key="group.key" class="month-block">
        <div class="month-title">{{ group.label }}</div>
        <div class="item-list">
          <div v-for="item in group.items" :key="item.date + item.name" class="holiday-item">
            <div class="date-badge">
              <span class="day">{{ item.day }}</span>
              <span class="weekday">周{{ item.weekday }}</span>
            </div>
            <div class="item-body">
              <div class="item-name">{{ item.name }}</div>
              <div class="item-date">{{ item.date }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="mode === 'longWeekends' && weekendItems.length">
      <div class="weekend-list">
        <div
          v-for="(item, idx) in weekendItems"
          :key="item.start + '-' + item.end + '-' + idx"
          class="weekend-card"
        >
          <div class="weekend-range">
            <span class="range-date">{{ item.start }}</span>
            <span class="range-sep">→</span>
            <span class="range-date">{{ item.end }}</span>
          </div>
          <div class="weekend-meta">
            <span class="meta-pill days">{{ item.days }} 天</span>
            <span v-if="item.bridgeDays > 0" class="meta-pill bridge">
              调休 {{ item.bridgeDays }} 天
            </span>
            <span v-else class="meta-pill quiet">无需调休</span>
          </div>
          <div v-if="item.holidayNames" class="weekend-holidays">
            {{ item.holidayNames }}
          </div>
        </div>
      </div>
    </template>

    <div v-else class="list-empty">暂无数据</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  mode: string
  items: any[]
}>()

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

const monthGroups = computed(() => {
  if (props.mode !== 'holidays') return []
  const map = new Map<string, { key: string; label: string; sort: number; items: any[] }>()
  for (const row of props.items || []) {
    const dateStr = String(row?.date || '')
    const d = new Date(`${dateStr}T00:00:00`)
    if (Number.isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const label = `${d.getFullYear()} 年 ${MONTHS[d.getMonth()]}`
    if (!map.has(key)) {
      map.set(key, { key, label, sort: d.getFullYear() * 100 + d.getMonth(), items: [] })
    }
    map.get(key)!.items.push({
      date: dateStr,
      name: String(row?.name || '节日'),
      day: d.getDate(),
      weekday: WEEKDAYS[d.getDay()],
    })
  }
  return Array.from(map.values()).sort((a, b) => a.sort - b.sort)
})

const weekendItems = computed(() => {
  if (props.mode !== 'longWeekends') return []
  return (props.items || []).map((row) => {
    const holidays = Array.isArray(row?.holidays) ? row.holidays : []
    const holidayNames = holidays
      .map((h: any) => h?.name)
      .filter(Boolean)
      .join(' · ')
    return {
      start: String(row?.start || ''),
      end: String(row?.end || ''),
      days: Number(row?.days || 0),
      bridgeDays: Number(row?.bridgeDays || 0),
      holidayNames,
    }
  })
})
</script>

<style scoped>
.holiday-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 280px;
  overflow: auto;
  padding-right: 2px;
}

.month-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.month-title {
  position: sticky;
  top: 0;
  z-index: 1;
  font-size: 12px;
  font-weight: 650;
  color: var(--cz-text-secondary);
  padding: 4px 2px;
  background: linear-gradient(180deg, var(--cz-surface-secondary), rgba(248, 251, 255, 0.85));
  backdrop-filter: blur(4px);
}

.item-list,
.weekend-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.holiday-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--cz-surface);
  border: 1px solid var(--cz-border);
}

.date-badge {
  width: 44px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 0;
  border-radius: 10px;
  background: var(--cz-primary-soft);
  color: var(--cz-primary-hover);
}

.date-badge .day {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.date-badge .weekday {
  font-size: 10px;
  font-weight: 600;
  opacity: 0.85;
}

.item-body {
  min-width: 0;
  flex: 1;
}

.item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--cz-text-primary);
  line-height: 1.35;
  word-break: break-word;
}

.item-date {
  margin-top: 2px;
  font-size: 11px;
  color: var(--cz-text-tertiary);
  font-variant-numeric: tabular-nums;
}

.weekend-card {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--cz-surface);
  border: 1px solid var(--cz-border);
}

.weekend-range {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 650;
  color: var(--cz-text-primary);
  font-variant-numeric: tabular-nums;
}

.range-sep {
  color: var(--cz-text-tertiary);
  font-weight: 500;
}

.weekend-meta {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid transparent;
}

.meta-pill.days {
  color: #2563eb;
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.14);
}

.meta-pill.bridge {
  color: #d97706;
  background: var(--cz-warning-soft);
  border-color: rgba(245, 158, 11, 0.18);
}

.meta-pill.quiet {
  color: var(--cz-text-tertiary);
  background: rgba(148, 163, 184, 0.12);
  border-color: rgba(148, 163, 184, 0.16);
}

.weekend-holidays {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--cz-text-secondary);
}

.list-empty {
  padding: 24px;
  text-align: center;
  font-size: 12px;
  color: var(--cz-text-tertiary);
}
</style>
