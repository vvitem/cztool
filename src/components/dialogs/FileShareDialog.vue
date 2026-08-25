<template>
  <el-form ref="formRef" :model="form" label-width="80px">
    <el-form-item label="分享类型">
      <el-radio-group v-model="form.shareType">
        <el-radio label="file">文件分享</el-radio>
        <el-radio label="text">文本分享</el-radio>
      </el-radio-group>
    </el-form-item>

    <!-- 文件上传区域 -->
    <el-form-item v-if="form.shareType === 'file'" label="选择文件">
      <el-upload
        class="upload-area"
        drag
        action="#"
        :auto-upload="false"
        :on-change="handleFileChange"
        :limit="1"
        :multiple="false"
        :show-file-list="true"
        accept="*/*"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          拖拽文件到此处或 <em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持任意类型文件，最大 50MB。使用 paste.c-net.org 服务，链接保存 180 天，每次访问自动延长保存期限。
          </div>
        </template>
      </el-upload>
    </el-form-item>

    <!-- 文本输入区域 -->
    <el-form-item v-if="form.shareType === 'text'" label="文本内容">
      <el-input
        v-model="form.textContent"
        type="textarea"
        :rows="8"
        :maxlength="50 * 1024 * 1024"
        placeholder="请输入或粘贴要分享的文本内容"
        resize="both"
      />
      <div class="input-tip">
        支持纯文本。使用 paste.c-net.org 服务。
      </div>
    </el-form-item>

    <!-- 分享链接结果 - 文件 -->
    <el-form-item v-if="form.shareType === 'file' && form.fileShareUrl" label="分享链接">
      <el-input v-model="form.fileShareUrl" readonly>
        <template #append>
          <el-button @click="copyShareUrl">复制</el-button>
        </template>
      </el-input>
    </el-form-item>

    <!-- 分享链接结果 - 文本 -->
    <el-form-item v-if="form.shareType === 'text' && form.textShareUrl" label="分享链接">
      <el-input v-model="form.textShareUrl" readonly>
        <template #append>
          <el-button @click="copyShareUrl">复制</el-button>
        </template>
      </el-input>
    </el-form-item>

    <el-form-item>
      <el-button 
        type="primary" 
        @click="handleShare" 
        :loading="uploading"
        :disabled="uploading || !canShare"
      >
        {{ uploading ? '正在上传...' : '生成分享链接' }}
      </el-button>
    </el-form-item>
  </el-form>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'

const formRef = ref(null)
const emit = defineEmits(['close'])
const uploading = ref(false)
const ipcRenderer = window.ipcRenderer

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

const form = reactive({
  shareType: 'file',
  file: null,
  textContent: '',
  fileShareUrl: '',
  textShareUrl: ''
})

const canShare = computed(() => {
  if (form.shareType === 'file') {
    return !!form.file
  } else {
    return !!form.textContent.trim()
  }
})

const handleClose = () => {
  form.file = null
  form.textContent = ''
  form.fileShareUrl = ''
  form.textShareUrl = ''
  uploading.value = false
  emit('close')
}

const handleFileChange = (file) => {
  // 验证文件大小，限制为50MB
  const maxSize = 50 * 1024 * 1024 // 50MB in bytes
  if (file.size > maxSize) {
    ElMessage.error('文件大小不能超过50MB')
    form.file = null
    return
  }
  form.file = file.raw
  form.fileShareUrl = ''
}

const copyShareUrl = () => {
  const url = form.shareType === 'file' ? form.fileShareUrl : form.textShareUrl
  if (!url) {
    ElMessage.warning('没有可复制的内容')
    return
  }

  try {
    // 创建一个临时输入框
    const input = document.createElement('input')
    input.value = url
    document.body.appendChild(input)
    
    // 选择文本
    input.select()
    input.setSelectionRange(0, input.value.length)
    
    // 尝试复制
    const success = document.execCommand('copy')
    
    // 移除临时输入框
    document.body.removeChild(input)
    
    if (success) {
      ElMessage.success('复制成功')
    } else {
      ElMessage.error('复制失败')
    }
  } catch (error) {
    console.error('复制失败:', error)
    ElMessage.error('复制失败')
  }
}

const extractUrlFromHtml = (html) => {
  // 尝试直接从响应中查找 URL
  const urlMatch = html.match(/https:\/\/paste\.c-net\.org\/[a-zA-Z0-9-]+/)
  if (urlMatch) {
    return urlMatch[0]
  }
  
  // 如果响应内容就是一个纯 URL
  if (html.trim().startsWith('https://paste.c-net.org/')) {
    return html.trim()
  }
  
  // 创建一个临时的 DOM 解析器
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  
  // 查找第一个链接
  const firstLink = doc.querySelector('a')
  if (firstLink && firstLink.href.includes('paste.c-net.org')) {
    return firstLink.href
  }
  
  throw new Error('无法从响应中提取 URL')
}

const addHistory = async (content, status = 'success') => {
  if (!ipcRenderer) {
    console.error('IPC 通道未就绪')
    return
  }

  try {
    const record = {
      moduleName: 'share',
      appName: form.shareType === 'file' ? '文件分享' : '文本分享',
      content: JSON.stringify(content),
      status,
      contentType: form.shareType === 'file' ? 'file-share' : 'text-share'
    }
    await ipcRenderer.invoke('history:add', record)
  } catch (error) {
    console.error('添加历史记录失败:', error)
  }
}

const handleShare = async () => {
  if (!ipcRenderer) {
    ElMessage.error('系统服务未就绪')
    return
  }

  if (form.shareType === 'file') {
    if (!form.file) {
      ElMessage.warning('请选择要分享的文件')
      return
    }
    
    // 再次验证文件大小
    const maxSize = 50 * 1024 * 1024 // 50MB in bytes
    if (form.file.size > maxSize) {
      ElMessage.error('文件大小不能超过50MB')
      return
    }
  }

  if (form.shareType === 'text' && !form.textContent.trim()) {
    ElMessage.warning('请输入要分享的文本内容')
    return
  }

  uploading.value = true

  try {
    if (form.shareType === 'file') {
      const formData = new FormData()
      formData.append('file', form.file)
      
      const response = await fetch('https://paste.c-net.org/', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('文件上传失败')
      }

      const responseText = await response.text()
      const shareUrl = extractUrlFromHtml(responseText)
      form.fileShareUrl = shareUrl
      
      // 获取文件后缀
      const fileNameParts = form.file.name.split('.')
      const fileExtension = fileNameParts.length > 1 ? fileNameParts.pop() : ''
      const fileNameWithoutExt = fileNameParts.join('.')
      
      // 添加文件分享历史记录
      await addHistory({
        fileName: form.file.name,
        sourceFileName: form.file.name,
        fileNameWithoutExt,
        fileExtension,
        fileSize: form.file.size,
        fileSizeFormatted: formatFileSize(form.file.size),
        shareUrl,
        createdAt: Date.now()
      })
      
      // 清除已分享的文件
      form.file = null
    } else {
      const response = await fetch('https://paste.c-net.org/', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: form.textContent
      })

      if (!response.ok) {
        throw new Error('文本分享失败')
      }

      const responseText = await response.text()
      const shareUrl = extractUrlFromHtml(responseText)
      form.textShareUrl = shareUrl
      
      // 添加文本分享历史记录
      await addHistory({
        textPreview: form.textContent,
        contentLength: form.textContent.length,
        shareUrl,
        createdAt: Date.now()
      })
    }

    ElMessage.success('分享链接生成成功')
  } catch (error) {
    console.error('分享失败:', error)
    ElMessage.error(error.message || '分享失败，请重试')
    // 添加失败记录
    await addHistory({
      error: error.message || '分享失败',
      createdAt: Date.now()
    }, 'error')
  } finally {
    uploading.value = false
  }
}

defineExpose({
  handleClose
})
</script>

<style scoped>
.upload-area {
  width: 100%;
}

.input-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
  margin-top: 4px;
}

:deep(.el-upload-dragger) {
  width: 100%;
}

:deep(.el-upload) {
  width: 100%;
}

.el-icon--upload {
  margin: 10px 0;
  font-size: 48px;
  color: #409EFF;
}

.el-upload__text {
  margin: 10px 0;
  color: #606266;
}

.el-upload__text em {
  color: #409EFF;
  font-style: normal;
}

.el-textarea {
  width: 100%;
}
</style>
