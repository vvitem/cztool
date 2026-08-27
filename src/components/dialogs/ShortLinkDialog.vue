<template>
  <div class="cz-dialog-body shortlink-dialog">
    <section class="query-block">
      <label class="field-label">原始网址</label>
      <el-input
        v-model="longUrl"
        class="query-input"
        placeholder="https://example.com/very/long/path"
        size="large"
        clearable
        @keydown.enter.prevent="handleSubmit"
        @keydown.esc.prevent="$emit('close')"
      />
      <p class="field-hint">使用 cleanuri 生成短链；请勿高频连续请求</p>
    </section>

    <section class="result-stage">
      <div v-if="result" class="result-card">
        <div class="meta-label">短链</div>
        <div class="url-row">
          <span class="url-text">{{ result.shortUrl }}</span>
        </div>
        <div class="meta-label" style="margin-top: 12px">原链接</div>
        <div class="url-row muted">
          <span class="url-text">{{ result.originalUrl }}</span>
        </div>
        <div class="action-row">
          <el-button type="primary" size="small" @click="copyText(result.shortUrl)">复制短链</el-button>
          <el-button size="small" @click="openResult">浏览器打开</el-button>
        </div>
      </div>
      <div v-else class="empty-card">
        <div class="empty-title">等待生成</div>
        <div class="empty-desc">粘贴长链接后点击生成</div>
      </div>
    </section>

    <div class="cz-dialog-footer">
      <el-button @click="$emit('close')">关闭</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        {{ loading ? '生成中…' : '生成短链' }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { invoke, openExternal } from '../../api/desktop'
import { copyText, invokeErrorMessage } from '../../utils/toolHelpers'

interface ShortLinkResult {
  shortUrl: string
  originalUrl: string
}

const longUrl = ref('')
const loading = ref(false)
const result = ref<ShortLinkResult | null>(null)

const openResult = async () => {
  if (!result.value?.shortUrl) return
  await openExternal(result.value.shortUrl)
}

const handleSubmit = async () => {
  const url = longUrl.value.trim()
  if (!url) {
    ElMessage.error('请输入网址')
    return
  }
  loading.value = true
  try {
    const data = await invoke<ShortLinkResult>('short-link:create', { url })
    result.value = data
    ElMessage.success('生成成功')
    try {
      await invoke('history:add', {
        moduleName: '短链生成',
        appName: '短链',
        content: JSON.stringify({
          shortUrl: data.shortUrl,
          originalUrl: data.originalUrl,
          createdAt: Date.now(),
        }),
        status: 'success',
      })
    } catch (e) {
      console.error(e)
    }
  } catch (error) {
    ElMessage.error(invokeErrorMessage(error, '生成失败'))
  } finally {
    loading.value = false
  }
}

defineEmits(['close'])
</script>

<style scoped>
.shortlink-dialog { max-height: min(72vh, 640px); }
.query-block { display: flex; flex-direction: column; gap: 8px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--cz-text-secondary); }
.field-hint { margin: 0; font-size: 12px; color: var(--cz-text-tertiary); line-height: 1.45; }
.result-stage { min-height: 160px; margin-top: 4px; }
.result-card, .empty-card {
  box-sizing: border-box; padding: 16px; border-radius: var(--cz-radius-sm);
  border: 1px solid var(--cz-border); background: var(--cz-surface-secondary);
}
.empty-card { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 140px; text-align: center; }
.empty-title { font-size: 14px; font-weight: 600; color: var(--cz-text-primary); }
.empty-desc { font-size: 12px; color: var(--cz-text-tertiary); }
.meta-label { font-size: 12px; font-weight: 600; color: var(--cz-text-tertiary); margin-bottom: 6px; }
.url-row { padding: 8px 10px; border-radius: 8px; background: var(--cz-surface); border: 1px solid var(--cz-border); }
.url-row.muted { opacity: 0.85; }
.url-text {
  font-size: 13px; word-break: break-all;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--cz-text-primary);
}
.action-row { margin-top: 12px; display: flex; gap: 8px; }
</style>
