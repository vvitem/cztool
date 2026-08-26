<template>
  <div class="tool-box">
    <div class="tool-grid">
      <div
        v-for="tool in tools"
        :key="tool.id"
        class="tool-item"
        :class="[`tone-${tool.tone}`, { disabled: tool.type === 'more' }]"
        @click="handleToolClick(tool)"
      >
        <div class="tool-icon">
          <el-icon><component :is="tool.icon" /></el-icon>
        </div>
        <div class="tool-name">{{ tool.name }}</div>
        <div class="tool-description">{{ tool.description }}</div>
      </div>
    </div>

    <el-dialog
      v-model="currentDialog.douyin"
      width="560px"
      class="cz-tool-dialog tone-cyan"
      align-center
      :show-close="true"
      :close-on-click-modal="false"
      :close-on-press-escape="true"
      @close="closeDialog('douyin')"
      destroy-on-close
    >
      <template #header>
        <div class="dialog-heading">
          <span class="dialog-heading-mark cyan">
            <el-icon><VideoCamera /></el-icon>
          </span>
          <div>
            <div class="dialog-heading-title">视频解析</div>
            <div class="dialog-heading-sub">解析分享链接 · 浏览器打开视频</div>
          </div>
        </div>
      </template>
      <DouyinDialog @close="closeDialog('douyin')" />
    </el-dialog>

    <el-dialog
      v-model="currentDialog.qq"
      width="560px"
      class="cz-tool-dialog tone-blue"
      align-center
      :show-close="true"
      :close-on-click-modal="false"
      :close-on-press-escape="true"
      @close="closeDialog('qq')"
      destroy-on-close
    >
      <template #header>
        <div class="dialog-heading">
          <span class="dialog-heading-mark blue">
            <el-icon><Search /></el-icon>
          </span>
          <div>
            <div class="dialog-heading-title">QQ 号查询</div>
            <div class="dialog-heading-sub">查询头像、昵称与关联手机号</div>
          </div>
        </div>
      </template>
      <QQDialog @close="closeDialog('qq')" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Search,
  VideoCamera,
  MoreFilled,
} from '@element-plus/icons-vue'
import type { Component } from 'vue'
import DouyinDialog from './dialogs/DouyinDialog.vue'
import QQDialog from './dialogs/QQDialog.vue'

interface Tool {
  id: string
  name: string
  icon: Component
  type: string
  description?: string
  tone: 'blue' | 'cyan' | 'green' | 'indigo' | 'amber' | 'slate'
}

const tools = ref<Tool[]>([
  { id: 'qq', name: 'QQ号查询', icon: Search, type: 'qq', description: '快速查询QQ号信息', tone: 'blue' },
  { id: 'douyin', name: '视频解析', icon: VideoCamera, type: 'douyin', description: '解析视频分享链接', tone: 'cyan' },
  { id: 'share', name: '更多功能', icon: MoreFilled, type: 'more', description: '更多工具', tone: 'slate' },
])

const currentDialog = reactive({
  douyin: false,
  qq: false,
})

const showDialog = (type: string) => {
  currentDialog[type] = true
}

const closeDialog = (type: string) => {
  currentDialog[type] = false
}

const handleToolClick = (tool: Tool) => {
  if (tool.type === 'douyin' || tool.type === 'qq') {
    showDialog(tool.type)
  } else {
    ElMessage.info('功能开发中...')
  }
}
</script>

<style scoped>
.tool-box {
  height: 100%;
  padding: 20px;
  overflow: auto;
  background: transparent;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
}

.tool-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 16px;
  border-radius: var(--cz-radius-card);
  cursor: pointer;
  background: var(--cz-surface);
  border: 1px solid var(--cz-border);
  box-shadow: var(--cz-shadow-sm);
  transition: transform var(--cz-transition), border-color var(--cz-transition), box-shadow var(--cz-transition);
}

.tool-item:hover {
  transform: translateY(-2px);
  border-color: var(--cz-border-strong);
}

.tool-item.disabled {
  opacity: 0.55;
  cursor: default;
}

.tool-item.disabled:hover {
  transform: none;
  border-color: var(--cz-border);
}

.tool-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--cz-radius-tile);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.tone-blue .tool-icon { background: var(--cz-primary-soft); color: var(--cz-primary-hover); }
.tone-cyan .tool-icon { background: rgba(14, 165, 233, 0.12); color: #0284c7; }
.tone-green .tool-icon { background: var(--cz-success-soft); color: #16a34a; }
.tone-indigo .tool-icon { background: rgba(99, 102, 241, 0.12); color: #4f46e5; }
.tone-amber .tool-icon { background: var(--cz-warning-soft); color: #d97706; }
.tone-slate .tool-icon { background: rgba(148, 163, 184, 0.18); color: #64748b; }

.tool-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--cz-text-primary);
}

.tool-description {
  font-size: 12px;
  line-height: 1.4;
  color: var(--cz-text-tertiary);
}
</style>
