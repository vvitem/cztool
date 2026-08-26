<template>
  <div class="cz-dialog-body qq-dialog">
    <el-form label-position="top">
      <el-form-item label="请输入QQ号">
        <el-input
          v-model="searchInput"
          placeholder="请输入QQ号"
          size="large"
          clearable
          @keydown.enter.prevent="handleSubmit"
          @keydown.esc.prevent="$emit('close')"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </el-form-item>
    </el-form>

    <el-alert
      title="声明：本工具仅供学习交流使用"
      type="info"
      :closable="false"
      show-icon
    />

    <div class="result-container" v-if="result">
      <div class="cz-dialog-panel basic-info">
        <div class="panel-title">基本信息</div>
        <div class="avatar-section">
          <img v-if="result.avatar" :src="result.avatar" class="qq-avatar" alt="QQ头像" />
          <div class="qq-details">
            <div class="qq-number" v-if="result.qq">QQ：{{ result.qq }}</div>
            <div class="qq-nickname" v-if="result.nickname">昵称：{{ result.nickname }}</div>
            <div class="qq-phone" v-if="result.phones?.length">
              手机号：
              <span
                v-for="(phone, index) in result.phones"
                :key="phone"
                class="phone-chip"
              >{{ phone }}{{ index < result.phones.length - 1 ? '、' : '' }}</span>
            </div>
            <div class="qq-phone empty" v-else>手机号：暂无</div>
          </div>
        </div>
      </div>
    </div>

    <div class="cz-dialog-footer">
      <el-button @click="$emit('close')">关闭</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        {{ loading ? '查询中...' : '查询' }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'

interface QQResult {
  qq?: string
  nickname?: string
  avatar?: string
  phone?: string
  phones?: string[]
}

const QQ_SEARCH_BASE = 'https://info.oihome.dpdns.org/api/v1/search/t1'
const QQ_SEARCH_AUTHKEY = 'ak_db742918e8f54c9a87352a1b9e0f6c3d'

const searchInput = ref('')
const loading = ref(false)
const result = ref<QQResult | null>(null)

const getNickname = async (qq: string): Promise<string | undefined> => {
  try {
    const response = await window.ipcRenderer.invoke('fetch-qq-nickname', qq)
    if (response && response.code === 200) {
      return response.qqnicheng
    }
    return undefined
  } catch (error) {
    console.error('QQ昵称查询失败:', error)
    return undefined
  }
}

const queryByQQ = async (qq: string): Promise<QQResult> => {
  const trimmed = qq.trim()
  if (!/^\d{5,12}$/.test(trimmed)) {
    throw new Error('请输入正确的QQ号（5-12位数字）')
  }

  const url = `${QQ_SEARCH_BASE}/${encodeURIComponent(trimmed)}?authkey=${QQ_SEARCH_AUTHKEY}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`查询失败（HTTP ${response.status}）`)
  }

  const data = await response.json()
  if (!data?.uid) {
    throw new Error('未找到相关信息')
  }

  const phones: string[] = Array.isArray(data.result)
    ? data.result.map((item: unknown) => String(item)).filter(Boolean)
    : []

  const nickname = await getNickname(String(data.uid))

  return {
    qq: String(data.uid),
    phones,
    phone: phones[0],
    nickname,
    avatar: `https://q1.qlogo.cn/g?b=qq&nk=${data.uid}&s=100&t=${Date.now()}`,
  }
}

const handleSubmit = async () => {
  if (!searchInput.value.trim()) {
    ElMessage.error('请输入QQ号')
    return
  }

  loading.value = true
  result.value = null

  try {
    const finalResult = await queryByQQ(searchInput.value)
    result.value = finalResult
    ElMessage.success('查询成功')

    try {
      await window.ipcRenderer.invoke('history:add', {
        moduleName: 'QQ查询',
        appName: 'QQ',
        content: JSON.stringify({
          qq: finalResult.qq,
          nickname: finalResult.nickname,
          avatar: finalResult.avatar,
          phone: finalResult.phone,
          phones: finalResult.phones,
        }),
        status: 'success',
        contentType: 'qq-query',
      })
    } catch (error) {
      console.error('添加历史记录失败:', error)
    }
  } catch (error) {
    console.error('Error:', error)
    ElMessage.error(error instanceof Error ? error.message : '查询失败，请稍后重试')

    try {
      await window.ipcRenderer.invoke('history:add', {
        moduleName: 'QQ查询',
        appName: 'QQ',
        content: `查询失败: ${searchInput.value} (${error instanceof Error ? error.message : '未知错误'})`,
        status: 'error',
      })
    } catch (historyError) {
      console.error('添加历史记录失败:', historyError)
    }
  } finally {
    loading.value = false
  }
}

defineEmits(['close'])
</script>

<style scoped>
.qq-dialog {
  max-height: min(70vh, 640px);
}

.result-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  min-height: 0;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--cz-primary);
  margin-bottom: 10px;
}

.avatar-section {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.qq-avatar {
  width: 72px;
  height: 72px;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid var(--cz-border);
  box-shadow: var(--cz-shadow-sm);
  flex-shrink: 0;
}

.qq-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--cz-text-secondary);
  line-height: 1.45;
}

.qq-phone.empty {
  color: var(--cz-text-tertiary);
}

.phone-chip {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
