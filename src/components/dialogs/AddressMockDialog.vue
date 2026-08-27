<template>
  <div class="cz-dialog-body address-dialog">
    <el-alert
      type="warning"
      :closable="false"
      show-icon
      title="仅供测试的格式样例，禁止用于真实邮寄、冒充身份或规避地区校验"
      class="warn"
    />

    <section class="query-block">
      <div class="row-3">
        <div>
          <label class="field-label">类型</label>
          <el-select v-model="type" style="width: 100%" size="large">
            <el-option v-for="t in typeOptions" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
        </div>
        <div>
          <label class="field-label">条数</label>
          <el-input-number v-model="count" :min="1" :max="100" style="width: 100%" size="large" />
        </div>
        <div>
          <label class="field-label">性别</label>
          <el-select v-model="gender" style="width: 100%" size="large">
            <el-option label="随机" value="random" />
            <el-option label="男" value="male" />
            <el-option label="女" value="female" />
          </el-select>
        </div>
      </div>
      <div v-if="type === 'us' || type === 'us_tax_free'">
        <label class="field-label">州（可选，如 CA）</label>
        <el-input v-model="state" placeholder="留空则随机" size="large" clearable />
      </div>
    </section>

    <section class="result-stage">
      <div v-if="results.length" class="result-card">
        <div class="meta-line">
          已生成 {{ results.length }} 条 · {{ typeLabel }}
          <el-button
            size="small"
            text
            type="primary"
            @click="copyText(JSON.stringify(results, null, 2), 'JSON 已复制')"
          >
            复制全部 JSON
          </el-button>
        </div>
        <AddressListView :items="results" />
      </div>
      <div v-else class="empty-card">
        <div class="empty-title">等待生成</div>
        <div class="empty-desc">选择参数后生成测试地址</div>
      </div>
    </section>

    <div class="cz-dialog-footer">
      <el-button @click="$emit('close')">关闭</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        {{ loading ? '生成中…' : '生成地址' }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { invoke } from '../../api/desktop'
import { copyText, invokeErrorMessage } from '../../utils/toolHelpers'
import AddressListView, { type AddressItem } from '../AddressListView.vue'

const typeOptions = [
  { value: 'us', label: '美国 (us)' },
  { value: 'us_tax_free', label: '美国免税州' },
  { value: 'hk', label: '香港' },
  { value: 'cv', label: '佛得角' },
  { value: 'tr', label: '土耳其' },
]

const type = ref('us')
const count = ref(5)
const gender = ref('random')
const state = ref('')
const loading = ref(false)
const results = ref<AddressItem[]>([])

const typeLabel = computed(
  () => typeOptions.find((t) => t.value === type.value)?.label || type.value,
)

const handleSubmit = async () => {
  loading.value = true
  try {
    const data = await invoke<{ results?: AddressItem[]; type?: string; count?: number }>(
      'address-mock:generate',
      {
        count: count.value,
        type: type.value,
        gender: gender.value,
        state: state.value.trim(),
      },
    )
    results.value = Array.isArray(data?.results) ? data.results : []
    ElMessage.success(`已生成 ${results.value.length} 条`)

    try {
      await invoke('history:add', {
        moduleName: '地址模拟',
        appName: '地址',
        content: JSON.stringify({
          type: type.value,
          typeLabel: typeLabel.value,
          gender: gender.value,
          state: state.value.trim() || undefined,
          count: results.value.length,
          results: results.value,
        }),
        status: 'success',
      })
    } catch (e) {
      console.error(e)
    }
  } catch (error) {
    results.value = []
    ElMessage.error(invokeErrorMessage(error, '生成失败'))
    try {
      await invoke('history:add', {
        moduleName: '地址模拟',
        appName: '地址',
        content: JSON.stringify({
          type: type.value,
          typeLabel: typeLabel.value,
          error: invokeErrorMessage(error, '生成失败'),
        }),
        status: 'error',
      })
    } catch (e) {
      console.error(e)
    }
  } finally {
    loading.value = false
  }
}

defineEmits(['close'])
</script>

<style scoped>
.address-dialog {
  max-height: min(86vh, 860px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.warn {
  margin-bottom: 0;
  flex-shrink: 0;
}

.query-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--cz-text-secondary);
  display: block;
  margin-bottom: 4px;
}

.row-3 {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr 0.8fr;
  gap: 10px;
}

.result-stage {
  flex: 1;
  min-height: 320px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.result-card,
.empty-card {
  flex: 1;
  min-height: 0;
  padding: 12px;
  border-radius: var(--cz-radius-sm);
  border: 1px solid var(--cz-border);
  background: var(--cz-surface-secondary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty-card {
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-align: center;
}

.empty-title {
  font-size: 14px;
  font-weight: 600;
}

.empty-desc {
  font-size: 12px;
  color: var(--cz-text-tertiary);
}

.meta-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--cz-text-secondary);
  flex-shrink: 0;
}

.result-card :deep(.address-list) {
  flex: 1;
  min-height: 0;
  max-height: none;
}
</style>
