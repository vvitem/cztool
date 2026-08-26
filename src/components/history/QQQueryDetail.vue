<script setup lang="ts">
import { computed } from 'vue'
import type { HistoryRecord } from '../../types'
import { ElMessage } from 'element-plus'
import { Link, CopyDocument, Clock, Trophy, Promotion } from '@element-plus/icons-vue'

const props = defineProps<{
  record: HistoryRecord
}>()

// 解析内容
const content = computed(() => {
  try {
    const data = JSON.parse(props.record.content)
    const phones: string[] = Array.isArray(data.phones) && data.phones.length
      ? data.phones.map((item: unknown) => String(item)).filter(Boolean)
      : (data.phone ? [String(data.phone)] : [])
    return {
      qq: data.qq || '',
      nickname: data.nickname || '',
      avatar: data.avatar || '',
      phone: phones[0] || '',
      phones,
      phonediqu: data.phonediqu || '',
      lol: data.lol || null,
      wb: data.wb ? {
        ...data.wb,
        id: String(data.wb.id).replace(/[^\d]/g, '')
      } : null
    }
  } catch (e) {
    return {
      qq: '',
      nickname: '',
      avatar: '',
      phone: '',
      phones: [] as string[],
      phonediqu: '',
      lol: null,
      wb: null
    }
  }
})

// 格式化日期
const formatDate = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

// 打开链接
const openLink = (url: string) => {
  window.open(url)
}

// 复制到剪贴板并显示提示
const copyWithTip = (text: string, type: string) => {
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success(`${type}已复制到剪贴板`)
  } catch (err) {
    ElMessage.error('复制失败')
  }
}

// 获取状态类型
const getStatusType = (status: string) => {
  switch (status) {
    case 'success':
      return 'success'
    case 'error':
      return 'danger'
    default:
      return 'info'
  }
}

// 获取状态效果
const getStatusEffect = (status: string) => {
  return status === 'success' ? 'light' : 'dark'
}

// 获取状态文本
const getStatusText = (status: string) => {
  switch (status) {
    case 'success':
      return '成功'
    case 'error':
      return '失败'
    default:
      return '未知'
  }
}
</script>

<template>
  <div class="qq-info">
    <div class="qq-desc">
      <div class="desc-header">
        <div class="author-info">
          <el-avatar :src="content.avatar" :size="48" class="avatar" />
          <div class="author-details">
            <span class="author-name">{{ content.nickname || content.qq }}</span>
            <el-tag
              :type="getStatusType(record.status)"
              :effect="getStatusEffect(record.status)"
              size="small"
              class="status-tag"
            >
              {{ getStatusText(record.status) }}
            </el-tag>
          </div>
        </div>
        <div class="time-info">
          <el-icon><Clock /></el-icon>
          <span>{{ formatDate(record.operationTime) }}</span>
        </div>
      </div>

      <div class="info-section">
        <div class="info-item" v-if="content.qq">
          <span class="info-label">QQ</span>
          <div class="info-value-container">
            <el-tag size="large" class="value-tag">
              <span>{{ content.qq }}</span>
              <el-button
                class="copy-icon-btn"
                type="primary"
                link
                @click.stop="copyWithTip(content.qq, 'QQ号')"
              >
                <el-icon><CopyDocument /></el-icon>
              </el-button>
            </el-tag>
          </div>
        </div>
        
        <div class="info-item" v-if="content.nickname">
          <span class="info-label">昵称</span>
          <div class="info-value-container">
            <el-tag size="large" type="success" class="value-tag">
              <span>{{ content.nickname }}</span>
              <el-button
                class="copy-icon-btn"
                type="primary"
                link
                @click.stop="copyWithTip(content.nickname, '昵称')"
              >
                <el-icon><CopyDocument /></el-icon>
              </el-button>
            </el-tag>
          </div>
        </div>

        <div class="info-item" v-if="content.phones.length">
          <span class="info-label">手机号</span>
          <div class="info-value-container phone-list">
            <el-tag
              v-for="phone in content.phones"
              :key="phone"
              size="large"
              type="warning"
              class="value-tag"
            >
              <span>{{ phone }}</span>
              <el-button
                class="copy-icon-btn"
                type="primary"
                link
                @click.stop="copyWithTip(phone, '手机号')"
              >
                <el-icon><CopyDocument /></el-icon>
              </el-button>
            </el-tag>
          </div>
        </div>
        <div class="info-item" v-if="content.phonediqu">
          <span class="info-label">归属地</span>
          <el-tag size="large" type="info" class="value-tag">{{ content.phonediqu }}</el-tag>
        </div>
      </div>

      <div class="game-section" v-if="content.lol">
        <div class="section-title">
          <el-icon class="section-icon"><Trophy /></el-icon>
          英雄联盟信息
        </div>
        <div class="info-item" v-if="content.lol.name">
          <span class="info-label">名称</span>
          <el-tag size="large" type="success" class="value-tag">
            <span>{{ content.lol.name }}</span>
            <el-button
              class="copy-icon-btn"
              type="primary"
              link
              @click.stop="copyWithTip(content.lol.name, '游戏名称')"
            >
              <el-icon><CopyDocument /></el-icon>
            </el-button>
          </el-tag>
        </div>
        <div class="info-item" v-if="content.lol.daqu">
          <span class="info-label">大区</span>
          <el-tag size="large" type="success" class="value-tag">{{ content.lol.daqu }}</el-tag>
        </div>
      </div>

      <div class="weibo-section" v-if="content.wb">
        <div class="section-title">
          <el-icon class="section-icon"><Promotion /></el-icon>
          微博信息
        </div>
        <div class="info-item">
          <span class="info-label">ID</span>
          <el-tag size="large" type="danger" class="value-tag">
            <span>{{ content.wb.id }}</span>
            <el-button
              class="copy-icon-btn"
              type="primary"
              link
              @click.stop="copyWithTip(content.wb.id, '微博ID')"
            >
              <el-icon><CopyDocument /></el-icon>
            </el-button>
          </el-tag>
        </div>
        <div class="info-item">
          <span class="info-label">主页</span>
          <el-button 
            type="danger" 
            class="weibo-btn"
            @click="openLink(`https://weibo.com/u/${content.wb.id}`)"
          >
            <el-icon><Link /></el-icon>
            访问微博主页
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.qq-info {
  padding: 24px;
  border-radius: 12px;
  background: var(--el-bg-color);
  box-shadow: var(--el-box-shadow-light);
}

.qq-desc {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.desc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.author-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.author-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.avatar {
  border: 2px solid var(--el-color-primary-light-5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.author-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.2;
}

.status-tag {
  font-weight: 500;
}

.info-section,
.game-section,
.weibo-section {
  padding: 20px;
  background: var(--el-fill-color-blank);
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
  transition: all 0.3s ease;
}

.info-section:hover,
.game-section:hover,
.weibo-section:hover {
  border-color: var(--el-border-color);
  transform: translateY(-1px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 20px;
}

.section-icon {
  font-size: 18px;
  color: var(--el-color-primary);
}

.info-item {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  gap: 16px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-label {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  min-width: 60px;
}

.info-value-container {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.phone-list {
  flex-wrap: wrap;
}

.value-tag {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.95em;
  letter-spacing: 0.5px;
  padding: 8px 12px;
  height: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  position: relative;
  padding-right: 36px;
}

.copy-icon-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  padding: 4px;
  height: 24px;
  width: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
  opacity: 0.7;
}

.copy-icon-btn:hover {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.1);
}

.value-tag:hover .copy-icon-btn {
  opacity: 1;
}

:root[theme-mode="dark"] .copy-icon-btn:hover {
  background-color: rgba(0, 0, 0, 0.2);
}

.weibo-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-weight: 500;
  transition: all 0.3s ease;
  height: auto;
}

.weibo-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

:root[theme-mode="dark"] .weibo-btn:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.time-info {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  padding: 6px 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

/* 暗色主题适配 */
:root[theme-mode="dark"] .qq-info {
  background: var(--el-bg-color-overlay);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
}

:root[theme-mode="dark"] .info-section,
:root[theme-mode="dark"] .game-section,
:root[theme-mode="dark"] .weibo-section {
  background: var(--el-bg-color);
  border-color: var(--el-border-color-darker);
}

:root[theme-mode="dark"] .info-section:hover,
:root[theme-mode="dark"] .game-section:hover,
:root[theme-mode="dark"] .weibo-section:hover {
  border-color: var(--el-border-color);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
}

:root[theme-mode="dark"] .avatar {
  border-color: var(--el-color-primary-dark-3);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

:root[theme-mode="dark"] .time-info {
  background: var(--el-bg-color);
}
</style>
