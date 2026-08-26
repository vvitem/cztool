<template>
  <div class="cz-dialog-body douyin-dialog">
    <section class="query-block">
      <label class="field-label">视频链接 / 口令</label>
      <el-input
        v-model="videoUrl"
        class="query-input"
        type="textarea"
        :rows="3"
        resize="none"
        placeholder="粘贴视频分享文案或 https 链接"
        clearable
        @clear="clearInput"
        @keydown.enter.ctrl="handleSubmit"
        @keydown.esc="$emit('close')"
      />
      <p class="field-hint">支持分享口令全文；解析后可选择清晰度再打开</p>
    </section>

    <section class="result-stage">
      <div v-if="parseResult" class="result-card">
        <div class="video-header">
          <div class="cover-wrap">
            <img
              v-if="parseResult.cover"
              :src="parseResult.cover"
              class="video-cover"
              alt="封面"
            />
            <div v-else class="video-cover placeholder">
              <el-icon><VideoCamera /></el-icon>
            </div>
          </div>
          <div class="video-meta">
            <div class="video-title">{{ parseResult.title || '无标题' }}</div>
            <div class="video-tags">
              <span class="tone-pill">{{ parseResult.type || 'video' }}</span>
              <span v-if="availableQualities.length" class="soft-pill">
                {{ availableQualities.length }} 个清晰度
              </span>
            </div>
          </div>
        </div>

        <div class="quality-block">
          <label class="field-label">清晰度</label>
          <el-select v-model="selectedQuality" placeholder="选择清晰度" style="width: 100%" size="large">
            <el-option
              v-for="quality in availableQualities"
              :key="quality.value"
              :label="quality.label"
              :value="quality.value"
            />
          </el-select>
        </div>

        <div class="video-actions">
          <el-button type="primary" :disabled="!currentVideoUrl" @click="downloadVideo">
            <el-icon class="btn-icon"><TopRight /></el-icon>
            打开视频
          </el-button>
          <el-button :disabled="!currentVideoUrl" @click="copyVideoUrl">
            <el-icon class="btn-icon"><DocumentCopy /></el-icon>
            复制链接
          </el-button>
        </div>
      </div>

      <div v-else class="empty-card">
        <div class="empty-icon">
          <el-icon><VideoCamera /></el-icon>
        </div>
        <div class="empty-title">等待解析</div>
        <div class="empty-desc">粘贴链接后点下方按钮，封面与下载选项会出现在这里</div>
      </div>
    </section>

    <div class="cz-dialog-footer">
      <el-button @click="$emit('close')">取消</el-button>
      <el-button
        type="primary"
        :loading="loading"
        :disabled="isSubmitDisabled"
        @click="handleSubmit"
      >
        {{ loading ? '解析中…' : '解析视频' }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { VideoCamera, TopRight, DocumentCopy } from '@element-plus/icons-vue'
import { invoke, openExternal } from '../../api/desktop'

interface VideoQuality {
  value: string
  label: string
  url: string
  size?: number
}

interface ParseResult {
  title: string
  type: string
  cover: string
  url: string
  pics: string[]
}

const videoUrl = ref('')
const loading = ref(false)
const parseResult = ref<ParseResult | null>(null)
const availableQualities = ref<VideoQuality[]>([])
const selectedQuality = ref('')
const lastParsedUrl = ref('')

const formatSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return ''
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}GB`
  return `${mb.toFixed(1)}MB`
}

const currentVideoUrl = computed(() => {
  const quality = availableQualities.value.find((item) => item.value === selectedQuality.value)
  return quality?.url || parseResult.value?.url || ''
})

const isSubmitDisabled = computed(() => {
  const currentUrl = videoUrl.value.trim()
  return !currentUrl || currentUrl === lastParsedUrl.value
})

const extractQualities = (data: any): VideoQuality[] => {
  const qualities: VideoQuality[] = []
  const fullInfo = data?.videos?.[0]?.video_fullinfo

  if (Array.isArray(fullInfo) && fullInfo.length) {
    fullInfo.forEach((item: any, index: number) => {
      if (!item?.url) return
      const typeLabel = item.type || `清晰度${index + 1}`
      const sizeLabel = formatSize(item.size)
      qualities.push({
        value: `q_${index}_${typeLabel}`,
        label: sizeLabel ? `${typeLabel}（${sizeLabel}）` : typeLabel,
        url: item.url,
        size: item.size,
      })
    })
  }

  if (!qualities.length && data?.url) {
    qualities.push({
      value: 'default',
      label: '默认清晰度',
      url: data.url,
    })
  }

  return qualities
}

const copyVideoUrl = () => {
  const url = currentVideoUrl.value
  if (!url) {
    ElMessage.warning('请先选择视频清晰度')
    return
  }

  try {
    const input = document.createElement('input')
    input.setAttribute('readonly', 'readonly')
    input.value = url
    document.body.appendChild(input)
    input.select()
    input.setSelectionRange(0, input.value.length)
    document.execCommand('copy')
    document.body.removeChild(input)
    ElMessage.success('视频链接已复制到剪贴板')
  } catch (err) {
    ElMessage.error('复制失败，请手动复制')
    console.error('Copy failed:', err)
  }
}

const downloadVideo = async () => {
  const url = currentVideoUrl.value
  if (!url) {
    ElMessage.warning('请先选择视频清晰度')
    return
  }
  try {
    await openExternal(url)
  } catch (error) {
    console.error('Open video failed:', error)
    ElMessage.error(error instanceof Error ? error.message : '打开下载链接失败')
  }
}

const handleSubmit = async () => {
  if (!videoUrl.value.trim()) {
    ElMessage.error('请输入视频链接')
    return
  }

  loading.value = true

  try {
    const data = await invoke('douyin:parse', videoUrl.value.trim())
    console.log('API Response:', data)

    if (!data?.success || !data?.data) {
      const message = data?.error || '解析失败，请检查链接是否正确'
      ElMessage.error(typeof message === 'string' ? message : '解析失败')
      await invoke('history:add', {
        moduleName: '视频解析',
        appName: '抖音',
        content: JSON.stringify({
          originalUrl: videoUrl.value.trim(),
          error: typeof message === 'string' ? message : '链接无效',
        }),
        status: 'error',
        contentType: 'douyin-video',
      })
      return
    }

    const payload = data.data
    const qualities = extractQualities(payload)
    parseResult.value = {
      title: payload.title || '',
      type: payload.type || 'video',
      cover: payload.cover || payload.pics?.[0] || '',
      url: payload.url || qualities[0]?.url || '',
      pics: Array.isArray(payload.pics) ? payload.pics : [],
    }
    availableQualities.value = qualities
    if (qualities.length) {
      selectedQuality.value = qualities[qualities.length - 1].value
    }
    lastParsedUrl.value = videoUrl.value.trim()
    ElMessage.success('解析成功')

    await invoke('history:add', {
      moduleName: '视频解析',
      appName: '抖音',
      content: JSON.stringify({
        originalUrl: videoUrl.value.trim(),
        title: parseResult.value.title,
        desc: parseResult.value.title || '无描述',
        author: '抖音',
        avatar: parseResult.value.cover,
        cover: parseResult.value.cover,
        type: parseResult.value.type,
        defaultUrl: parseResult.value.url,
        pics: parseResult.value.pics,
        statistics: {},
        audioUrl: '',
        videoUrls: qualities.map((quality) => ({
          label: quality.label,
          url: quality.url,
          size: quality.size,
        })),
      }),
      status: 'success',
      contentType: 'douyin-video',
    })
  } catch (error) {
    console.error('Error:', error)
    ElMessage.error(error instanceof Error ? error.message : '处理失败，请稍后重试')

    try {
      await invoke('history:add', {
        moduleName: '视频解析',
        appName: '抖音',
        content: JSON.stringify({
          originalUrl: videoUrl.value.trim(),
          error: error instanceof Error ? error.message : '未知错误',
        }),
        status: 'error',
        contentType: 'douyin-video',
      })
    } catch (historyError) {
      console.error('添加历史记录失败:', historyError)
    }
  } finally {
    loading.value = false
  }
}

const clearInput = () => {
  videoUrl.value = ''
  lastParsedUrl.value = ''
  parseResult.value = null
  availableQualities.value = []
  selectedQuality.value = ''
}

defineEmits(['close'])
</script>

<style scoped>
.douyin-dialog {
  min-height: 0;
}

.query-block,
.quality-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--cz-text-secondary);
}

.field-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--cz-text-tertiary);
}

/* 固定结果区高度，空态/结果切换时弹窗不跳动 */
.result-stage {
  height: 268px;
  display: flex;
  flex-direction: column;
}

.result-card,
.empty-card {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
  padding: 16px;
  border-radius: var(--cz-radius-sm);
  border: 1px solid var(--cz-border);
  background: var(--cz-surface-secondary);
  overflow: auto;
}

.result-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.video-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.cover-wrap {
  flex-shrink: 0;
}

.video-cover {
  width: 92px;
  height: 92px;
  border-radius: 14px;
  object-fit: cover;
  border: 1px solid var(--cz-border);
  background: var(--cz-surface);
  box-shadow: var(--cz-shadow-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0284c7;
  font-size: 22px;
}

.video-cover.placeholder {
  background: rgba(14, 165, 233, 0.08);
}

.video-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.video-title {
  font-size: 14px;
  font-weight: 650;
  color: var(--cz-text-primary);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.video-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tone-pill,
.soft-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.tone-pill {
  color: #0284c7;
  background: rgba(14, 165, 233, 0.12);
}

.soft-pill {
  color: var(--cz-text-secondary);
  background: var(--cz-surface);
  border: 1px solid var(--cz-border);
}

.video-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-icon {
  margin-right: 4px;
}

.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 6px;
}

.empty-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
  font-size: 18px;
  color: #0284c7;
  background: rgba(14, 165, 233, 0.12);
}

.empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--cz-text-primary);
}

.empty-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--cz-text-tertiary);
}
</style>
