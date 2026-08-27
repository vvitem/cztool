<template>
  <div class="cz-dialog-body barcode-dialog">
    <section class="query-block">
      <label class="field-label">内容</label>
      <el-input
        v-model="data"
        placeholder="要编码的文本或链接"
        size="large"
        clearable
        @keydown.enter.prevent="handleSubmit"
      />
      <div class="row-2">
        <div>
          <label class="field-label">类型</label>
          <el-select v-model="type" style="width: 100%" size="large">
            <el-option v-for="t in types" :key="t" :label="t" :value="t" />
          </el-select>
        </div>
        <div>
          <label class="field-label">格式</label>
          <el-select v-model="format" style="width: 100%" size="large">
            <el-option v-for="f in formats" :key="f" :label="f" :value="f" />
          </el-select>
        </div>
      </div>
      <label class="field-label">下方文字（可选）</label>
      <el-input v-model="text" placeholder="显示在条码下方的标签" size="large" clearable />
    </section>

    <section class="result-stage">
      <div v-if="result" class="result-card">
        <img :src="result.dataUrl" alt="barcode" class="preview" />
        <div class="action-row">
          <el-button type="primary" size="small" :loading="saving" @click="handleSave">保存图片</el-button>
        </div>
      </div>
      <div v-else class="empty-card">
        <div class="empty-title">等待生成</div>
        <div class="empty-desc">填写内容后生成二维码 / 条码预览</div>
      </div>
    </section>

    <div class="cz-dialog-footer">
      <el-button @click="$emit('close')">关闭</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        {{ loading ? '生成中…' : '生成' }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { invoke } from '../../api/desktop'
import { invokeErrorMessage } from '../../utils/toolHelpers'

const types = ['qr', 'code128', 'ean13', 'ean8', 'code39', 'datamatrix', 'pdf417', 'aztec']
const formats = ['png', 'jpg', 'svg', 'webp']

const data = ref('')
const type = ref('qr')
const format = ref('png')
const text = ref('')
const loading = ref(false)
const saving = ref(false)
const result = ref<{ url: string; dataUrl: string; imageBase64: string; mime: string } | null>(null)

const handleSubmit = async () => {
  if (!data.value.trim()) {
    ElMessage.error('请输入内容')
    return
  }
  loading.value = true
  try {
    result.value = await invoke('barcode:generate', {
      data: data.value.trim(),
      type: type.value,
      format: format.value,
      text: text.value.trim(),
    })
    ElMessage.success('生成成功')
  } catch (error) {
    ElMessage.error(invokeErrorMessage(error, '生成失败'))
  } finally {
    loading.value = false
  }
}

const handleSave = async () => {
  if (!result.value) return
  saving.value = true
  try {
    const res = await invoke<{ canceled?: boolean; path?: string }>('barcode:save', {
      imageBase64: result.value.imageBase64,
      format: format.value,
    })
    if (!res?.canceled) ElMessage.success('已保存')
  } catch (error) {
    ElMessage.error(invokeErrorMessage(error, '保存失败'))
  } finally {
    saving.value = false
  }
}

defineEmits(['close'])
</script>

<style scoped>
.barcode-dialog { max-height: min(78vh, 720px); }
.query-block { display: flex; flex-direction: column; gap: 8px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--cz-text-secondary); display: block; margin-bottom: 4px; }
.row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.result-stage { min-height: 180px; }
.result-card, .empty-card {
  padding: 16px; border-radius: var(--cz-radius-sm); border: 1px solid var(--cz-border);
  background: var(--cz-surface-secondary);
}
.empty-card { min-height: 160px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center; }
.empty-title { font-size: 14px; font-weight: 600; }
.empty-desc { font-size: 12px; color: var(--cz-text-tertiary); }
.preview { max-width: 100%; max-height: 240px; display: block; margin: 0 auto; background: #fff; border-radius: 8px; }
.action-row { margin-top: 12px; display: flex; gap: 8px; justify-content: center; }
</style>
