<template>
  <div class="cz-dialog-body holiday-dialog">
    <section class="query-block">
      <div class="row-2">
        <div>
          <label class="field-label">国家代码</label>
          <el-select v-model="country" filterable allow-create default-first-option style="width: 100%" size="large">
            <el-option v-for="c in countries" :key="c.code" :label="`${c.name} (${c.code})`" :value="c.code" />
          </el-select>
        </div>
        <div>
          <label class="field-label">视图</label>
          <el-select v-model="mode" style="width: 100%" size="large">
            <el-option label="公共假期" value="holidays" />
            <el-option label="长周末 / 调休" value="longWeekends" />
          </el-select>
        </div>
      </div>
    </section>

    <section class="result-stage">
      <div v-if="rows.length" class="result-card">
        <div class="meta-line">
          <span>{{ metaLine }}</span>
        </div>
        <HolidayListView :mode="mode" :items="rows" />
      </div>
      <div v-else class="empty-card">
        <div class="empty-title">等待查询</div>
        <div class="empty-desc">选择国家后查看假期或长周末</div>
      </div>
    </section>

    <p class="attribution">Source: caldays.com · CC BY 4.0</p>

    <div class="cz-dialog-footer">
      <el-button @click="$emit('close')">关闭</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        {{ loading ? '查询中…' : '查询' }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { invoke } from '../../api/desktop'
import { invokeErrorMessage } from '../../utils/toolHelpers'
import HolidayListView from '../HolidayListView.vue'

const countries = [
  { code: 'cn', name: '中国' },
  { code: 'hk', name: '香港' },
  { code: 'tw', name: '台湾' },
  { code: 'us', name: '美国' },
  { code: 'jp', name: '日本' },
  { code: 'kr', name: '韩国' },
  { code: 'gb', name: '英国' },
  { code: 'sg', name: '新加坡' },
  { code: 'au', name: '澳大利亚' },
]

const country = ref('cn')
const mode = ref('holidays')
const loading = ref(false)
const raw = ref<Record<string, unknown> | null>(null)

const metaLine = computed(() => {
  if (!raw.value) return ''
  const name = String(raw.value.country || country.value)
  const year = raw.value.year ?? ''
  const count = raw.value.count ?? rows.value.length
  return `${name} · ${year} · ${count} 条`
})

const rows = computed(() => {
  if (!raw.value) return []
  if (mode.value === 'longWeekends') {
    const list = raw.value.longWeekends
    return Array.isArray(list) ? list : []
  }
  const list = raw.value.holidays
  return Array.isArray(list) ? list : []
})

const handleSubmit = async () => {
  loading.value = true
  try {
    raw.value = await invoke('holiday:query', {
      country: country.value.trim().toLowerCase(),
      mode: mode.value,
    })
    ElMessage.success('查询成功')
    try {
      await invoke('history:add', {
        moduleName: '节假日查询',
        appName: '节假日',
        content: JSON.stringify({
          country: country.value,
          countryName: raw.value?.country || country.value,
          mode: mode.value,
          year: raw.value?.year,
          count: raw.value?.count ?? rows.value.length,
          holidays: mode.value === 'holidays' ? rows.value : undefined,
          longWeekends: mode.value === 'longWeekends' ? rows.value : undefined,
        }),
        status: 'success',
      })
    } catch (e) {
      console.error(e)
    }
  } catch (error) {
    raw.value = null
    ElMessage.error(invokeErrorMessage(error, '查询失败'))
  } finally {
    loading.value = false
  }
}

defineEmits(['close'])
</script>

<style scoped>
.holiday-dialog { max-height: min(78vh, 720px); }
.query-block { display: flex; flex-direction: column; gap: 8px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--cz-text-secondary); display: block; margin-bottom: 4px; }
.row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.result-stage { min-height: 200px; }
.result-card, .empty-card {
  padding: 12px; border-radius: var(--cz-radius-sm); border: 1px solid var(--cz-border);
  background: var(--cz-surface-secondary);
}
.empty-card { min-height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center; }
.empty-title { font-size: 14px; font-weight: 600; }
.empty-desc { font-size: 12px; color: var(--cz-text-tertiary); }
.meta-line { font-size: 12px; color: var(--cz-text-secondary); margin-bottom: 10px; }
.attribution { margin: 10px 0 0; font-size: 11px; color: var(--cz-text-tertiary); }
</style>
