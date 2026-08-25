<template>
  <div class="douyin-dialog">
    <div class="input-wrapper">
      <el-input
        v-model="videoUrl"
        placeholder="请粘贴视频分享链接"
        :prefix-icon="Link"
        clearable
        @clear="clearInput"
        @keydown.enter="handleSubmit"
        @keydown.esc="$emit('close')"
      />
    </div>
    
    <!-- 视频信息展示区域 -->
    <div v-if="videoInfo" class="video-info">
      <div class="video-author">
        <el-avatar :src="videoInfo.author.avatar_thumb.url_list[0]" />
        <span class="author-name">{{ videoInfo.author.nickname }}</span>
      </div>
      
      <div class="video-desc">{{ videoInfo.desc }}</div>
      
      <div class="video-stats">
        <span>点赞: {{ videoInfo.statistics?.digg_count || 0 }}</span>
        <span>评论: {{ videoInfo.statistics?.comment_count || 0 }}</span>
        <span>收藏: {{ videoInfo.statistics?.collect_count || 0 }}</span>
      </div>

      <div class="video-quality-selector">
        <el-select v-model="selectedQuality" placeholder="选择视频质量">
          <el-option
            v-for="quality in availableQualities"
            :key="quality.value"
            :label="quality.label"
            :value="quality.value"
          />
        </el-select>
      </div>

      <div class="video-actions">
        <el-button type="primary" @click="downloadVideo">
          下载无水印视频
        </el-button>
        <el-button @click="copyVideoUrl">
          复制视频链接
        </el-button>
        <el-button 
          type="success" 
          @click="downloadAudio" 
          v-if="videoInfo.music?.play_url?.url_list?.length > 0"
        >
          下载音频
        </el-button>
      </div>
    </div>

    <div class="button-group">
      <el-button @click="$emit('close')">取消</el-button>
      <el-button 
        type="primary" 
        :loading="loading" 
        :disabled="isSubmitDisabled"
        @click="handleSubmit"
      >
        {{ loading ? '获取中...' : '获取无水印视频' }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Link } from '@element-plus/icons-vue'

interface VideoQuality {
  value: string;
  label: string;
  url: string;
}

const videoUrl = ref('')
const loading = ref(false)
const videoInfo = ref<any>(null)
const selectedQuality = ref('')
const lastParsedUrl = ref('')

const availableQualities = computed(() => {
  if (!videoInfo.value?.video) return []
  
  const qualities: VideoQuality[] = []
  const video = videoInfo.value.video
  
  // 主播放地址 (无水印)
  if (video.play_addr?.url_list?.length > 0) {
    video.play_addr.url_list.forEach((url: string, index: number) => {
      qualities.push({
        value: `nwm_hd_${index}`,
        label: `无水印 HD ${index + 1}`,
        url: url
      })
    })
  }

  // 备用播放地址 (无水印)
  if (video.play_addr_lowbr?.url_list?.length > 0) {
    video.play_addr_lowbr.url_list.forEach((url: string, index: number) => {
      qualities.push({
        value: `nwm_sd_${index}`,
        label: `无水印 SD ${index + 1}`,
        url: url
      })
    })
  }

  return qualities
})

const isSubmitDisabled = computed(() => {
  const currentUrl = videoUrl.value.trim()
  return !currentUrl || currentUrl === lastParsedUrl.value
})

const getCurrentVideoUrl = () => {
  const quality = availableQualities.value.find(q => q.value === selectedQuality.value)
  if (!quality?.url) {
    // 如果没有选择质量或URL无效，默认使用第一个可用的URL
    return availableQualities.value[0]?.url || ''
  }
  return quality.url
}

const copyVideoUrl = () => {
  const url = getCurrentVideoUrl()
  if (!url) {
    ElMessage.warning('请先选择视频质量')
    return
  }

  // 创建临时输入框
  const input = document.createElement('input')
  input.setAttribute('readonly', 'readonly')
  input.value = url
  document.body.appendChild(input)
  
  // 选择文本
  input.select()
  input.setSelectionRange(0, input.value.length)
  
  try {
    // 执行复制
    document.execCommand('copy')
    ElMessage.success('视频链接已复制到剪贴板')
  } catch (err) {
    ElMessage.error('复制失败，请手动复制')
    console.error('Copy failed:', err)
  } finally {
    // 移除临时输入框
    document.body.removeChild(input)
  }
}

const downloadVideo = () => {
  const url = getCurrentVideoUrl()
  if (!url) {
    ElMessage.warning('请先选择视频质量')
    return
  }
  window.open(url, '_blank')
}

const downloadAudio = () => {
  if (videoInfo.value?.music?.play_url?.url_list?.[0]) {
    window.open(videoInfo.value.music.play_url.url_list[0], '_blank')
  } else {
    ElMessage.warning('音频链接不可用')
  }
}

const handleSubmit = async () => {
  if (!videoUrl.value.trim()) {
    ElMessage.error('请输入视频链接')
    return
  }

  loading.value = true
  videoInfo.value = null
  selectedQuality.value = ''
  
  try {
    const response = await fetch('https://api.douyin.wtf/api/hybrid/video_data?url=' + encodeURIComponent(videoUrl.value.trim()))
    const data = await response.json()
    console.log('API Response:', data)
    
    if (data.code === 200) {  
      videoInfo.value = data.data
      console.log('Video info:', videoInfo.value)
      if (availableQualities.value.length > 0) {
        const defaultQuality = availableQualities.value[0]
        selectedQuality.value = defaultQuality.value
      }
      lastParsedUrl.value = videoUrl.value.trim()
      ElMessage.success('解析成功')

      // 添加成功历史记录
      try {
        const historyData = {
          moduleName: '抖音去水印',
          appName: '抖音',
          content: JSON.stringify({
            originalUrl: videoUrl.value.trim(),
            author: videoInfo.value.author.nickname,
            avatar: videoInfo.value.author.avatar_thumb?.url_list?.[0],
            desc: videoInfo.value.desc || '无描述',
            statistics: {
              digg: videoInfo.value.statistics?.digg_count || 0,
              comment: videoInfo.value.statistics?.comment_count || 0,
              collect: videoInfo.value.statistics?.collect_count || 0,
              share: videoInfo.value.statistics?.share_count || 0
            },
            audioUrl: videoInfo.value.music?.play_url?.url_list?.[0] || '',
            videoUrls: availableQualities.value.map(quality => ({
              label: quality.label,
              url: quality.url
            }))
          }),
          status: 'success',
          contentType: 'douyin-video'
        }

        await window.ipcRenderer.invoke('history:add', historyData)
      } catch (historyError) {
        console.error('添加历史记录失败:', historyError)
      }
    } else {
      ElMessage.error(data.message || '解析失败，请检查链接是否正确')
      
      // 添加失败历史记录
      try {
        await window.ipcRenderer.invoke('history:add', {
          moduleName: '抖音去水印',
          appName: '抖音',
          content: JSON.stringify({
            originalUrl: videoUrl.value.trim(),
            error: data.message || '链接无效'
          }),
          status: 'error',
          contentType: 'douyin-video'
        })
      } catch (historyError) {
        console.error('添加历史记录失败:', historyError)
      }
    }
  } catch (error) {
    console.error('Error:', error)
    ElMessage.error('处理失败，请稍后重试')

    // 添加失败历史记录
    try {
      await window.ipcRenderer.invoke('history:add', {
        moduleName: '抖音去水印',
        appName: '抖音',
        content: JSON.stringify({
          originalUrl: videoUrl.value.trim(),
          error: error instanceof Error ? error.message : '未知错误'
        }),
        status: 'error',
        contentType: 'douyin-video'
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
  videoInfo.value = null
  selectedQuality.value = ''
}

const emit = defineEmits(['close'])
</script>

<style scoped>
.douyin-dialog {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
}

.input-wrapper {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.video-info {
  flex: 1;
  margin: 20px 0;
  padding: 15px;
  border-radius: 8px;
  background-color: #f8f9fa;
}

.video-author {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.author-name {
  margin-left: 10px;
  font-weight: 500;
}

.video-desc {
  margin-bottom: 15px;
  line-height: 1.5;
}

.video-stats {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
  color: #606266;
}

.video-quality-selector {
  margin-bottom: 15px;
}

.video-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.button-group {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
</style>
