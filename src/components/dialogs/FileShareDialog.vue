<template>
  <div class="cz-dialog-body fileshare-dialog">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="warn"
      title="使用 Litterbox 临时托管（catbox.moe）。公共链接、无隐私保证；到期自动删除。禁止上传违规内容。"
    />

    <section class="query-block">
      <div class="file-row">
        <el-button @click="handlePick" :loading="picking">选择文件</el-button>
        <span class="file-name">{{ pickedLabel }}</span>
      </div>
      <div>
        <label class="field-label">保留时长</label>
        <el-select v-model="time" style="width: 100%" size="large">
          <el-option label="1 小时" value="1h" />
          <el-option label="12 小时" value="12h" />
          <el-option label="24 小时" value="24h" />
          <el-option label="72 小时" value="72h" />
        </el-select>
      </div>
    </section>

    <section class="result-stage">
      <div v-if="result" class="result-card">
        <div class="meta-label">分享链接</div>
        <div class="url-text">{{ result.shareUrl }}</div>
        <div class="meta-sub">
          {{ result.sourceFileName }} · {{ result.fileSizeFormatted }}
          <template v-if="result.expiresIn"> · 保留 {{ result.expiresIn }}</template>
        </div>
        <div class="action-row">
          <el-button type="primary" size="small" @click="copyText(result.shareUrl)">复制链接</el-button>
          <el-button size="small" @click="openExternal(result.shareUrl)">打开</el-button>
        </div>
      </div>
      <div v-else class="empty-card">
        <div class="empty-title">等待上传</div>
        <div class="empty-desc">选择本地文件后上传到 Litterbox</div>
      </div>
    </section>

    <div class="cz-dialog-footer">
      <el-button @click="$emit('close')">关闭</el-button>
      <el-button type="primary" :loading="loading" :disabled="!picked" @click="handleUpload">
        {{ loading ? '上传中…' : '上传' }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { invoke, openExternal } from '../../api/desktop'
import { copyText, invokeErrorMessage } from '../../utils/toolHelpers'

interface PickedFile {
  canceled?: boolean
  path?: string
  fileName?: string
  fileSize?: number
}

interface ShareResult {
  shareUrl: string
  fileName: string
  sourceFileName: string
  fileSize: number
  fileSizeFormatted: string
  expiresIn?: string
  provider?: string
  token?: string | null
}

const picking = ref(false)
const loading = ref(false)
const time = ref('24h')
const picked = ref<PickedFile | null>(null)
const result = ref<ShareResult | null>(null)

const pickedLabel = computed(() => {
  if (!picked.value?.fileName) return '未选择（上限 200 MiB）'
  const size = picked.value.fileSize
  if (!size) return picked.value.fileName
  const mb = size / (1024 * 1024)
  return `${picked.value.fileName}（${mb >= 1 ? mb.toFixed(1) + ' MB' : size + ' B'}）`
})

const handlePick = async () => {
  picking.value = true
  try {
    const res = await invoke<PickedFile>('file-share:pick')
    if (res?.canceled || !res?.path) {
      return
    }
    picked.value = res
    result.value = null
  } catch (error) {
    ElMessage.error(invokeErrorMessage(error, '选择文件失败'))
  } finally {
    picking.value = false
  }
}

const handleUpload = async () => {
  if (!picked.value?.path) {
    ElMessage.error('请先选择文件')
    return
  }
  loading.value = true
  try {
    const data = await invoke<ShareResult>('file-share:upload', {
      path: picked.value.path,
      time: time.value,
    })
    result.value = data
    ElMessage.success('上传成功')
    try {
      await invoke('history:add', {
        moduleName: 'share',
        appName: '文件分享',
        content: JSON.stringify({
          shareUrl: data.shareUrl,
          fileName: data.fileName,
          sourceFileName: data.sourceFileName,
          fileSize: data.fileSize,
          fileSizeFormatted: data.fileSizeFormatted,
          expiresIn: data.expiresIn,
          provider: data.provider || 'litterbox',
          createdAt: Date.now(),
        }),
        status: 'success',
        contentType: 'file-share',
      })
    } catch (e) {
      console.error(e)
    }
  } catch (error) {
    ElMessage.error(invokeErrorMessage(error, '上传失败'))
    try {
      await invoke('history:add', {
        moduleName: 'share',
        appName: '文件分享',
        content: JSON.stringify({
          error: invokeErrorMessage(error, '上传失败'),
          sourceFileName: picked.value?.fileName,
          createdAt: Date.now(),
        }),
        status: 'error',
        contentType: 'file-share',
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
.fileshare-dialog { max-height: min(78vh, 700px); }
.warn { margin-bottom: 12px; }
.query-block { display: flex; flex-direction: column; gap: 12px; }
.file-row { display: flex; align-items: center; gap: 12px; }
.file-name { font-size: 13px; color: var(--cz-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.field-label { font-size: 12px; font-weight: 600; color: var(--cz-text-secondary); display: block; margin-bottom: 4px; }
.result-stage { min-height: 140px; }
.result-card, .empty-card {
  padding: 16px; border-radius: var(--cz-radius-sm); border: 1px solid var(--cz-border);
  background: var(--cz-surface-secondary);
}
.empty-card { min-height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center; }
.empty-title { font-size: 14px; font-weight: 600; }
.empty-desc { font-size: 12px; color: var(--cz-text-tertiary); }
.meta-label { font-size: 12px; font-weight: 600; color: var(--cz-text-tertiary); margin-bottom: 6px; }
.url-text {
  font-size: 13px; word-break: break-all;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.meta-sub { margin-top: 8px; font-size: 12px; color: var(--cz-text-tertiary); }
.action-row { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
</style>
