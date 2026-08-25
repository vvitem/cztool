<template>
  <div class="tool-box">
    <div class="tool-grid">
      <div v-for="tool in tools" :key="tool.id" class="tool-item" @click="handleToolClick(tool)">
        <div class="tool-icon">
          <span class="emoji-icon">{{ tool.icon }}</span>
        </div>
        <div class="tool-name">{{ tool.name }}</div>
        <div class="tool-description">{{ tool.description }}</div>
      </div>
    </div>

    <el-dialog
      v-model="currentDialog.douyin"
      title="抖音去水印"
      width="500px"
      :show-close="true"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      @close="closeDialog('douyin')"
      destroy-on-close
    >
      <DouyinDialog @close="closeDialog('douyin')" />
    </el-dialog>

    <el-dialog
      v-model="currentDialog.qq"
      title="QQ号查询"
      width="500px"
      :show-close="true"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      @close="closeDialog('qq')"
      destroy-on-close
    >
      <QQDialog @close="closeDialog('qq')" />
    </el-dialog>

    <el-dialog
      v-model="currentDialog.countdown"
      title="倒计时"
      width="500px"
      :show-close="true"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      @close="closeDialog('countdown')"
      destroy-on-close
    >
      <CountdownDialog @close="closeDialog('countdown')" />
    </el-dialog>

    <el-dialog
      v-model="currentDialog.fileShare"
      title="文件分享"
      width="500px"
      :show-close="true"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      @close="closeDialog('fileShare')"
      destroy-on-close
    >
      <FileShareDialog @close="closeDialog('fileShare')" />
    </el-dialog>

    <el-dialog
      v-model="currentDialog.shortlink"
      title="短链生成"
      width="500px"
      :show-close="true"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      @close="closeDialog('shortlink')"
      destroy-on-close
    >
      <ShortLinkDialog @close="closeDialog('shortlink')" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import DouyinDialog from './dialogs/DouyinDialog.vue'
import QQDialog from './dialogs/QQDialog.vue'
import CountdownDialog from './dialogs/CountdownDialog.vue'
import FileShareDialog from './dialogs/FileShareDialog.vue'
import ShortLinkDialog from './dialogs/ShortLinkDialog.vue'

// 使用全局 window.ipcRenderer
const ipcRenderer = window?.ipcRenderer

interface Tool {
  id: string
  name: string
  icon: string
  type: string
  description?: string
}

interface DialogState {
  [key: string]: boolean;
}

const tools = ref<Tool[]>([
  {
    id: 'qq',
    name: 'QQ号查询',
    icon: '🔍',
    type: 'qq',
    description: '快速查询QQ号信息'
  },
  {
    id: 'douyin',
    name: '抖音去水印',
    icon: '🎥',
    type: 'douyin',
    description: '无水印视频下载'
  },
  {
    id: 'fileShare',
    name: '文件分享',
    icon: '📤',
    type: 'fileShare',
    description: '文件和文本分享'
  },
  {
    id: 'urlShorten',
    name: '短链生成',
    icon: '🔗',
    type: 'shortlink',
    description: '生成短链接'
  },
  // {
  //   id: 'videoDownload',
  //   name: '视频下载',
  //   icon: '📥',
  //   type: 'videoDownload',
  //   description: '支持多平台视频下载'
  // },
  // {
  //   id: 'imageProcess',
  //   name: '图片处理',
  //   icon: '🖼️',
  //   type: 'imageProcess',
  //   description: '图片编辑与处理'
  // },
  {
    id: 'countdown',
    name: '倒计时工具',
    icon: '⏰',
    type: 'countdown',
    description: '设置倒计时执行指定操作'
  },
  // {
  //   id: 'textEditor',
  //   name: '文本编辑',
  //   icon: '✏️',
  //   type: 'textEditor',
  //   description: '在线文本编辑工具'
  // },
  {
    id: 'share',
    name: '更多功能',
    icon: '🛠️',
    type: 'more',
    description: '更多工具'
  }
])

const currentDialog = reactive({
  douyin: false,
  qq: false,
  countdown: false,
  fileShare: false,
  shortlink: false
})

const showDialog = (type: string) => {
  currentDialog[type] = true
}

const closeDialog = (type: string) => {
  currentDialog[type] = false
}

const handleToolClick = (tool: Tool) => {
  if (tool.type === 'douyin' || tool.type === 'qq' || tool.type === 'countdown' || tool.type === 'fileShare' || tool.type === 'shortlink') {
    showDialog(tool.type)
  } else {
    ElMessage.info('功能开发中...')
  }
}
</script>

<style scoped>
.tool-box {
  padding: 20px;
  background-color: var(--el-bg-color);
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 20px;
  padding: 16px;
}

.tool-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background-color: var(--el-bg-color-container);
  border: 1px solid var(--el-border-color-lighter);
  position: relative;
  overflow: hidden;
}

.tool-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  border-color: var(--el-color-primary-light-5);
}

.tool-item:active {
  transform: translateY(-2px);
}

.tool-icon {
  font-size: 32px;
  color: inherit;
  background: var(--el-color-primary-light-9);
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.emoji-icon {
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tool-item:hover .tool-icon {
  transform: scale(1.1);
  background: var(--el-color-primary-light-8);
}

.tool-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  text-align: center;
  margin: 0;
}

.tool-description {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
  margin: 0;
  line-height: 1.4;
}

/* 对话框样式 */
:deep(.el-dialog) {
  margin: 15vh auto !important;
  border-radius: 8px;
  min-width: 500px;
}

:deep(.el-dialog__body) {
  padding: 0;
}

:deep(.el-dialog__header) {
  margin: 0;
  padding: 20px;
  text-align: center;
  border-bottom: 1px solid #ebeef5;
}

:deep(.el-dialog__title) {
  font-size: 1.2em;
  font-weight: 600;
}
</style>
