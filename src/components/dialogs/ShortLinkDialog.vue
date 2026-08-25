<template>
  <el-form ref="formRef" :model="form" label-width="80px">
    <el-form-item label="原始链接" prop="originalUrl" :rules="[{ required: true, message: '请输入链接' }]">
      <el-input v-model="form.originalUrl" placeholder="请输入需要转换的链接"></el-input>
    </el-form-item>
    <el-form-item v-if="form.shortUrl" label="短链结果">
      <el-input v-model="form.shortUrl" readonly>
        <template #append>
          <el-button @click="copyShortUrl">复制</el-button>
        </template>
      </el-input>
    </el-form-item>
    <el-form-item>
      <el-button type="primary" @click="handleSubmit">生成短链</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

const ipcRenderer = window?.ipcRenderer
const formRef = ref(null)
const emit = defineEmits(['close'])

const form = reactive({
  originalUrl: '',
  shortUrl: ''
})

const handleClose = () => {
  form.originalUrl = ''
  form.shortUrl = ''
  emit('close')
}

const copyShortUrl = () => {
  if (!form.shortUrl) {
    ElMessage.warning('没有可复制的内容')
    return
  }

  try {
    // 创建一个临时输入框
    const input = document.createElement('input')
    input.value = form.shortUrl
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

const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        if (!ipcRenderer) {
          throw new Error('IPC 通道未就绪')
        }
        
        // 通过 ipcRenderer 发送请求
        const response = await ipcRenderer.invoke('generate-short-url', form.originalUrl)
        console.log('API Response:', response)
        
        if (response?.code === 200 && response?.url) {
          form.shortUrl = response.url
          console.log('Generated Short URL:', form.shortUrl)
          ElMessage.success('短链生成成功')
          
          // 添加历史记录
          try {
            await ipcRenderer.invoke('history:add', {
              moduleName: '短链生成',
              appName: 'ShortLink',
              content: JSON.stringify({
                originalUrl: form.originalUrl,
                shortUrl: form.shortUrl,
                createdAt: new Date().toISOString()
              }),
              status: 'success',
              contentType: 'short-link'
            })
          } catch (historyError) {
            console.error('添加历史记录失败:', historyError)
          }
        } else {
          console.log('Invalid response format')
          throw new Error(response?.msg || '短链生成失败')
        }
      } catch (error) {
        console.error('Error details:', error)
        ElMessage.error(error instanceof Error ? error.message : '短链生成失败，请稍后重试')
      }
    }
  })
}
</script>

<style scoped>
.el-form {
  padding: 20px;
}
</style>
