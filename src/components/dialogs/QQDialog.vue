<template>
  <div class="cz-dialog-body qq-dialog">
    <section class="query-block">
      <label class="field-label">QQ 号</label>
      <el-input
        v-model="searchInput"
        class="query-input"
        placeholder="例如 10001"
        size="large"
        clearable
        @keydown.enter.prevent="handleSubmit"
        @keydown.esc.prevent="$emit('close')"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <p class="field-hint">仅支持 5–12 位数字，结果仅供学习交流</p>
    </section>

    <section class="result-stage">
      <div v-if="result" class="result-card">
        <div class="result-head">
          <img v-if="result.avatar" :src="result.avatar" class="qq-avatar" alt="QQ头像" />
          <div class="result-identity">
            <div class="qq-name-row">
              <span class="qq-nickname">{{ result.nickname || '未获取到昵称' }}</span>
              <span class="tone-pill">QQ</span>
            </div>
            <div class="qq-number">{{ result.qq }}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <div class="meta-label">手机号</div>
            <div v-if="result.phones?.length" class="meta-value phones">
              <span v-for="phone in result.phones" :key="phone" class="phone-chip">{{ phone }}</span>
            </div>
            <div v-else class="meta-value empty">暂无关联号码</div>
          </div>
        </div>
      </div>

      <div v-else class="empty-card">
        <div class="empty-icon">
          <el-icon><Search /></el-icon>
        </div>
        <div class="empty-title">等待查询</div>
        <div class="empty-desc">输入 QQ 号后点击查询，结果会显示在这里</div>
      </div>
    </section>

    <div class="cz-dialog-footer">
      <el-button @click="$emit('close')">关闭</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        {{ loading ? '查询中…' : '开始查询' }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { invoke } from '../../api/desktop'

interface QQResult {
  qq?: string
  nickname?: string
  avatar?: string
  phone?: string
  phones?: string[]
}

interface QQSearchPayload {
  uid?: string | number
  result?: unknown
}

const searchInput = ref('')
const loading = ref(false)
const result = ref<QQResult | null>(null)

const getNickname = async (qq: string): Promise<string | undefined> => {
  try {
    const response = await invoke<{ code?: number; qqnicheng?: string }>('fetch-qq-nickname', qq)
    if (response && response.code === 200) {
      return response.qqnicheng || undefined
    }
    return undefined
  } catch (error) {
    console.error('QQ昵称查询失败:', error)
    return undefined
  }
}

const invokeErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message?: unknown }).message || '')
    if (msg) return msg
  }
  return fallback
}

const queryByQQ = async (qq: string): Promise<QQResult> => {
  const trimmed = qq.trim()
  if (!/^\d{5,12}$/.test(trimmed)) {
    throw new Error('请输入正确的QQ号（5-12位数字）')
  }

  const data = await invoke<QQSearchPayload>('qq:search', trimmed)
  if (data?.uid === undefined || data?.uid === null || data?.uid === '') {
    throw new Error('未找到相关信息')
  }

  const phones: string[] = Array.isArray(data.result)
    ? data.result.map((item: unknown) => String(item)).filter(Boolean)
    : []

  const uid = String(data.uid)
  const nickname = await getNickname(uid)

  return {
    qq: uid,
    phones,
    phone: phones[0],
    nickname,
    avatar: `https://q1.qlogo.cn/g?b=qq&nk=${uid}&s=100&t=${Date.now()}`,
  }
}

const handleSubmit = async () => {
  if (!searchInput.value.trim()) {
    ElMessage.error('请输入QQ号')
    return
  }

  loading.value = true

  try {
    const finalResult = await queryByQQ(searchInput.value)
    result.value = finalResult
    ElMessage.success('查询成功')

    try {
      await invoke('history:add', {
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
    ElMessage.error(invokeErrorMessage(error, '查询失败，请稍后重试'))

    try {
      await invoke('history:add', {
        moduleName: 'QQ查询',
        appName: 'QQ',
        content: `查询失败: ${searchInput.value} (${invokeErrorMessage(error, '未知错误')})`,
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
  max-height: min(72vh, 680px);
}

.query-block {
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
  height: 188px;
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

.result-head {
  display: flex;
  gap: 14px;
  align-items: center;
}

.qq-avatar {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  object-fit: cover;
  border: 1px solid var(--cz-border);
  box-shadow: var(--cz-shadow-sm);
  flex-shrink: 0;
  background: var(--cz-surface);
}

.result-identity {
  min-width: 0;
}

.qq-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.qq-nickname {
  font-size: 15px;
  font-weight: 650;
  color: var(--cz-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tone-pill {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: var(--cz-primary-hover);
  background: var(--cz-primary-soft);
}

.qq-number {
  margin-top: 4px;
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--cz-text-secondary);
}

.meta-grid {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--cz-border);
}

.meta-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--cz-text-tertiary);
  margin-bottom: 8px;
}

.meta-value.phones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.phone-chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--cz-surface);
  border: 1px solid var(--cz-border);
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--cz-text-primary);
  box-shadow: var(--cz-shadow-sm);
}

.meta-value.empty {
  font-size: 13px;
  color: var(--cz-text-tertiary);
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
  color: var(--cz-primary-hover);
  background: var(--cz-primary-soft);
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
