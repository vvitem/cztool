<template>
  <div class="tool-box">
    <div class="tool-grid">
      <div
        v-for="tool in tools"
        :key="tool.id"
        class="tool-item"
        :class="[`tone-${tool.tone}`]"
        @click="showDialog(tool.type)"
      >
        <div class="tool-icon">
          <el-icon><component :is="tool.icon" /></el-icon>
        </div>
        <div class="tool-name">{{ tool.name }}</div>
        <div class="tool-description">{{ tool.description }}</div>
      </div>
    </div>

    <el-dialog
      v-for="d in dialogMeta"
      :key="d.type"
      v-model="currentDialog[d.type]"
      :width="d.width"
      :class="['cz-tool-dialog', `tone-${d.tone}`]"
      align-center
      :show-close="true"
      :close-on-click-modal="false"
      :close-on-press-escape="true"
      @close="closeDialog(d.type)"
      destroy-on-close
    >
      <template #header>
        <div class="dialog-heading">
          <span class="dialog-heading-mark" :class="d.tone">
            <el-icon><component :is="d.icon" /></el-icon>
          </span>
          <div>
            <div class="dialog-heading-title">{{ d.title }}</div>
            <div class="dialog-heading-sub">{{ d.sub }}</div>
          </div>
        </div>
      </template>
      <component :is="d.component" @close="closeDialog(d.type)" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import {
  Search,
  VideoCamera,
  Link,
  Grid,
  Calendar,
  Location,
  Upload,
  Picture,
  Trophy,
} from '@element-plus/icons-vue'
import type { Component } from 'vue'
import DouyinDialog from './dialogs/DouyinDialog.vue'
import QQDialog from './dialogs/QQDialog.vue'
import ShortLinkDialog from './dialogs/ShortLinkDialog.vue'
import BarcodeDialog from './dialogs/BarcodeDialog.vue'
import HolidayDialog from './dialogs/HolidayDialog.vue'
import AddressMockDialog from './dialogs/AddressMockDialog.vue'
import FileShareDialog from './dialogs/FileShareDialog.vue'
import MemeDialog from './dialogs/MemeDialog.vue'
import SportsPicksDialog from './dialogs/SportsPicksDialog.vue'

type Tone = 'blue' | 'cyan' | 'green' | 'indigo' | 'amber' | 'slate'

interface Tool {
  id: string
  name: string
  icon: Component
  type: string
  description?: string
  tone: Tone
}

const tools: Tool[] = [
  { id: 'qq', name: 'QQ号查询', icon: Search, type: 'qq', description: '快速查询QQ号信息', tone: 'blue' },
  { id: 'douyin', name: '视频解析', icon: VideoCamera, type: 'douyin', description: '解析视频分享链接', tone: 'cyan' },
  { id: 'shortlink', name: '短链生成', icon: Link, type: 'shortlink', description: 'cleanuri 缩短网址', tone: 'indigo' },
  { id: 'barcode', name: '二维码条码', icon: Grid, type: 'barcode', description: '生成 QR / 条码图片', tone: 'green' },
  { id: 'holiday', name: '节假日查询', icon: Calendar, type: 'holiday', description: '各国假期与长周末', tone: 'amber' },
  { id: 'address', name: '地址模拟', icon: Location, type: 'address', description: '生成测试用假地址', tone: 'slate' },
  { id: 'fileshare', name: '文件分享', icon: Upload, type: 'fileshare', description: '临时文件上传分享', tone: 'cyan' },
  { id: 'meme', name: '看表情包', icon: Picture, type: 'meme', description: '浏览 Imgflip 热门模板', tone: 'blue' },
  { id: 'sports', name: '体育模型', icon: Trophy, type: 'sports', description: '联赛获胜概率与公平赔率', tone: 'green' },
]

const dialogMeta = [
  { type: 'qq', title: 'QQ 号查询', sub: '查询头像、昵称与关联手机号', tone: 'blue', icon: Search, width: '560px', component: QQDialog },
  { type: 'douyin', title: '视频解析', sub: '解析分享链接 · 浏览器打开视频', tone: 'cyan', icon: VideoCamera, width: '560px', component: DouyinDialog },
  { type: 'shortlink', title: '短链生成', sub: 'cleanuri · 复制或打开短链', tone: 'indigo', icon: Link, width: '560px', component: ShortLinkDialog },
  { type: 'barcode', title: '二维码 / 条码', sub: 'Orca Scan · 预览与保存', tone: 'green', icon: Grid, width: '560px', component: BarcodeDialog },
  { type: 'holiday', title: '节假日查询', sub: 'caldays · 假期与长周末', tone: 'amber', icon: Calendar, width: '620px', component: HolidayDialog },
  { type: 'address', title: '地址模拟', sub: 'AddressMock · 仅供测试', tone: 'slate', icon: Location, width: '720px', component: AddressMockDialog },
  { type: 'fileshare', title: '文件分享', sub: 'Litterbox · 临时公共托管', tone: 'cyan', icon: Upload, width: '580px', component: FileShareDialog },
  { type: 'meme', title: '看表情包', sub: 'Imgflip 热门模板 · 无需账号', tone: 'blue', icon: Picture, width: '640px', component: MemeDialog },
  { type: 'sports', title: '体育模型预测', sub: 'Bet Better · 研究用途 · 18+', tone: 'green', icon: Trophy, width: '760px', component: SportsPicksDialog },
]

const currentDialog = reactive<Record<string, boolean>>(
  Object.fromEntries(dialogMeta.map((d) => [d.type, false])),
)

const showDialog = (type: string) => {
  currentDialog[type] = true
}

const closeDialog = (type: string) => {
  currentDialog[type] = false
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
