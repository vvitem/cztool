<template>
  <div class="cz-dialog-body sports-dialog">
    <el-alert
      type="warning"
      :closable="false"
      show-icon
      class="warn"
      title="18+ · 模型估计仅供研究，非投注建议。多数人长期会亏钱，请理性对待。"
    />

    <section class="query-block">
      <div class="row-2">
        <div>
          <label class="field-label">联赛</label>
          <el-select v-model="path" filterable style="width: 100%" size="large">
            <el-option v-for="l in leagues" :key="l.path" :label="l.label" :value="l.path" />
          </el-select>
        </div>
        <div>
          <label class="field-label">数据源</label>
          <el-select v-model="feed" style="width: 100%" size="large">
            <el-option label="综合 picks" value="picks" />
            <el-option label="盘口 best-bets" value="best-bets" />
            <el-option label="球员 prop-bets" value="prop-bets" />
          </el-select>
        </div>
      </div>
    </section>

    <section class="result-stage">
      <div v-if="picks.length" class="result-card">
        <div class="meta-line">{{ metaLine }}</div>
        <el-table :data="picks" size="small" max-height="280" stripe>
          <el-table-column prop="game" label="赛事" min-width="140" />
          <el-table-column prop="market" label="市场" width="100" />
          <el-table-column prop="selection" label="选择" width="110" />
          <el-table-column prop="modelProbabilityPct" label="概率%" width="80" />
          <el-table-column prop="fairOdds" label="公平赔率" width="90" />
          <el-table-column prop="confidence" label="信心" width="90" />
        </el-table>
      </div>
      <div v-else class="empty-card">
        <div class="empty-title">{{ emptyTitle }}</div>
        <div class="empty-desc">空赛季或暂无赛事前列表为空属正常</div>
      </div>
    </section>

    <p class="attribution">Source: Bet Better · https://betbetter.world · CC BY 4.0</p>

    <div class="cz-dialog-footer">
      <el-button @click="$emit('close')">关闭</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        {{ loading ? '加载中…' : '查询' }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { invoke } from '../../api/desktop'
import { invokeErrorMessage } from '../../utils/toolHelpers'

const leagues = [
  { path: 'nba', label: 'NBA' },
  { path: 'nfl', label: 'NFL' },
  { path: 'mlb', label: 'MLB' },
  { path: 'nhl', label: 'NHL' },
  { path: 'wnba', label: 'WNBA' },
  { path: 'ncaab', label: 'NCAAB' },
  { path: 'ncaaf', label: 'NCAAF' },
  { path: 'afl', label: 'AFL' },
  { path: 'nrl', label: 'NRL' },
  { path: 'ufc', label: 'UFC' },
  { path: 'cricket', label: 'Cricket' },
  { path: 'tennis/wta', label: 'Tennis WTA' },
  { path: 'soccer/epl', label: 'Soccer EPL' },
]

interface PickRow {
  game?: string
  market?: string
  selection?: string
  modelProbabilityPct?: number
  fairOdds?: number | null
  confidence?: string
  verdict?: string
}

const path = ref('nba')
const feed = ref('picks')
const loading = ref(false)
const raw = ref<Record<string, unknown> | null>(null)
const queried = ref(false)

const picks = computed<PickRow[]>(() => {
  const list = raw.value?.picks
  return Array.isArray(list) ? list : []
})

const metaLine = computed(() => {
  if (!raw.value) return ''
  const sport = raw.value.sport || path.value
  const updated = raw.value.updatedUtc || ''
  return `${sport} · ${picks.value.length} 条 · 更新 ${updated || '—'}`
})

const emptyTitle = computed(() => (queried.value ? '暂无数据' : '等待查询'))

const handleSubmit = async () => {
  loading.value = true
  queried.value = true
  try {
    raw.value = await invoke('sports-picks:query', {
      path: path.value,
      feed: feed.value,
    })
    ElMessage.success(picks.value.length ? `已加载 ${picks.value.length} 条` : '当前无赛前数据')
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
.sports-dialog { max-height: min(82vh, 780px); }
.warn { margin-bottom: 10px; }
.query-block { display: flex; flex-direction: column; gap: 8px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--cz-text-secondary); display: block; margin-bottom: 4px; }
.row-2 { display: grid; grid-template-columns: 1.4fr 1fr; gap: 10px; }
.result-stage { min-height: 200px; }
.result-card, .empty-card {
  padding: 12px; border-radius: var(--cz-radius-sm); border: 1px solid var(--cz-border);
  background: var(--cz-surface-secondary);
}
.empty-card { min-height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center; }
.empty-title { font-size: 14px; font-weight: 600; }
.empty-desc { font-size: 12px; color: var(--cz-text-tertiary); }
.meta-line { font-size: 12px; color: var(--cz-text-secondary); margin-bottom: 8px; }
.attribution { margin: 10px 0 0; font-size: 11px; color: var(--cz-text-tertiary); }
</style>
