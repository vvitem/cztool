<template>
  <div class="history-container">
    <div class="history-content">
      <el-table 
        :data="historyList" 
        style="width: 100%"
        height="calc(100vh - 120px)"
        :row-style="{ cursor: 'pointer' }"
        @row-click="handleRowClick"
        v-loading="loading"
        :empty-text="loading ? '加载中...' : '暂无数据'"
        :header-cell-style="{
          background: 'var(--el-color-primary-light-9)',
          color: 'var(--el-color-primary)',
          fontWeight: 'bold'
        }"
        :cell-style="{
          padding: '8px 0'
        }"
      >
        <el-table-column 
          prop="moduleName" 
          label="模块" 
          width="120" 
          align="center"
        >
          <template #default="scope">
            <el-tag
              :type="getModuleType(scope.row.moduleName)"
              effect="plain"
              size="small"
              class="module-tag"
            >
              {{ scope.row.moduleName }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column 
          prop="appName" 
          label="应用" 
          width="120" 
          align="center"
        >
          <template #default="scope">
            <span class="app-name">{{ scope.row.appName }}</span>
          </template>
        </el-table-column>
        <el-table-column 
          prop="content" 
          label="内容"
          min-width="300"
        >
          <template #default="scope">
            <div class="content-cell">
              <div v-if="scope.row.moduleName === '抖音去水印' && scope.row.status === 'success'">
                {{ parseDouyinContent(scope.row.content) }}
                <div class="link-tags" style="margin-top: 8px">
                  <el-tag
                    v-for="link in getDouyinLinks(scope.row.content)"
                    :key="link.url"
                    size="small"
                    type="success"
                    style="margin-right: 8px; cursor: pointer"
                    @click.stop="openLink(link.url)"
                  >
                    {{ link.label }}
                  </el-tag>
                </div>
              </div>
              <div v-else-if="scope.row.moduleName === '短链生成'" class="shortlink-content">
                <div class="link-row">
                  <el-icon><Link /></el-icon>
                  <el-tag 
                    size="small" 
                    type="success" 
                    class="short-url" 
                    style="cursor: pointer"
                    @click.stop="openLink(parseContent(scope.row.content).shortUrl)"
                  >
                    {{ parseContent(scope.row.content).shortUrl }}
                  </el-tag>
                </div>
                <div class="link-row original-url">
                  <span class="arrow-icon">↳</span>
                  <span 
                    class="url-text" 
                    style="cursor: pointer"
                    @click.stop="openLink(parseContent(scope.row.content).originalUrl)"
                  >
                    {{ parseContent(scope.row.content).originalUrl }}
                  </span>
                </div>
              </div>
              <div v-else-if="scope.row.moduleName === 'share'" class="share-content">
                <div v-if="scope.row.status === 'success'">
                  <div class="share-info">
                    <!-- 文件分享 -->
                    <template v-if="isFileShare(scope.row)">
                      <div class="file-info">
                        <el-icon><Document /></el-icon>
                        <span class="file-name">{{ parseContent(scope.row.content).sourceFileName }}</span>
                      </div>
                    </template>
                    <!-- 文本分享 -->
                    <template v-else>
                      <div class="text-preview">
                        <el-icon><ChatLineSquare /></el-icon>
                        <span class="preview-text">{{ parseContent(scope.row.content).textPreview }}</span>
                      </div>
                    </template>
                  </div>
                  <div class="link-row">
                    <el-icon><Link /></el-icon>
                    <el-tag 
                      size="small" 
                      type="success" 
                      class="share-url" 
                      style="cursor: pointer"
                      @click.stop="openLink(parseContent(scope.row.content).shareUrl)"
                    >
                      {{ parseContent(scope.row.content).shareUrl }}
                    </el-tag>
                  </div>
                </div>
                <div v-else class="error-content">
                  <el-tag type="danger" effect="plain" size="small">
                    {{ parseContent(scope.row.content).error || '分享失败' }}
                  </el-tag>
                </div>
              </div>
              <span v-else class="content-text">{{ formatContent(scope.row) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column 
          prop="operationTime" 
          label="时间"
          width="200"
          align="left"
        >
          <template #default="{ row }">
            <div class="time-cell">
              <el-icon><Clock /></el-icon>
              <span>{{ formatDate(row.operationTime) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column 
          prop="status" 
          label="状态" 
          width="100"
          align="center"
        >
          <template #default="scope">
            <el-tag
              :type="getStatusType(scope.row.status)"
              :effect="getStatusEffect(scope.row.status)"
              size="small"
              class="status-tag"
            >
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column 
          fixed="right" 
          label="操作" 
          width="80"
          align="center"
        >
          <template #default="scope">
            <el-button
              type="danger"
              size="small"
              @click.stop="clearHistory(scope.row)"
              :icon="Delete"
              circle
            />
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页器 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          :background="true"
          layout="total, sizes, prev, pager, next"
          :page-size-options="['10 条/页', '20 条/页', '50 条/页', '100 条/页']"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>

    <!-- 详情对话框 -->
    <el-dialog
      v-model="dialogVisible"
      title="详细信息"
      width="50%"
      destroy-on-close
      align-center
    >
      <div v-if="selectedRow" class="detail-content">
        <template v-if="selectedRow.moduleName === '抖音去水印'">
          <DouyinDetail :record="selectedRow" />
        </template>
        <template v-else-if="selectedRow.moduleName === 'QQ查询'">
          <QQQueryDetail :record="selectedRow" />
        </template>
        <template v-else-if="selectedRow.moduleName === '短链生成'">
          <ShortLinkDetail :record="selectedRow" />
        </template>
        <template v-else-if="selectedRow.moduleName === 'share'">
          <ShareDetail :record="selectedRow" />
        </template>
        <template v-else>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="模块">
              <el-tag
                :type="getModuleType(selectedRow.moduleName)"
                effect="plain"
                size="small"
              >
                {{ selectedRow.moduleName }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="应用">
              <span class="app-name">{{ selectedRow.appName }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="内容">
              <pre>{{ selectedRow.content }}</pre>
            </el-descriptions-item>
            <el-descriptions-item label="时间">
              <div class="time-cell">
                <el-icon><Clock /></el-icon>
                <span>{{ formatDate(selectedRow.operationTime) }}</span>
              </div>
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag
                :type="getStatusType(selectedRow.status)"
                :effect="getStatusEffect(selectedRow.status)"
                size="small"
              >
                {{ getStatusText(selectedRow.status) }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </template>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { HistoryRecord } from '../types'
import DouyinDetail from './history/DouyinDetail.vue'
import QQQueryDetail from './history/QQQueryDetail.vue'
import ShortLinkDetail from './history/ShortLinkDetail.vue'
import ShareDetail from './history/ShareDetail.vue'
import { Clock, Delete, Link, CopyDocument, Trophy, Promotion } from '@element-plus/icons-vue'

interface HistoryRecord {
  id: number
  moduleName: string
  appName: string
  content: string
  operationTime: number
  status: 'success' | 'error' | 'running'
  contentType?: string
  createTime?: string
}

const historyList = ref<HistoryRecord[]>([])
const dialogVisible = ref(false)
const selectedRow = ref<HistoryRecord | null>(null)
const loading = ref(false)

// 分页相关
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

// 格式化日期
const formatDate = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

// 获取模块类型
const getModuleType = (moduleName: string) => {
  const types = {
    'QQ查询': 'primary',
    '抖音解析': 'success',
    '短链生成': 'warning'
  }
  return types[moduleName] || 'info'
}

// 获取状态类型
const getStatusType = (status: string) => {
  const types = {
    'success': 'success',
    'error': 'danger',
    'running': 'warning'
  }
  return types[status] || 'info'
}

// 获取状态效果
const getStatusEffect = (status: string) => {
  return status === 'running' ? 'light' : 'dark'
}

// 获取状态文本
const getStatusText = (status: string) => {
  const texts = {
    'success': '成功',
    'error': '失败',
    'running': '运行中'
  }
  return texts[status] || '未知'
}

// 解析抖音视频历史记录内容
const parseDouyinContent = (content: string) => {
  try {
    const data = JSON.parse(content)
    if (!data) return content

    const stats = data.statistics || {}
    const basicInfo = [
      `作者: ${data.author || '未知'}`,
      `描述: ${data.desc || '无描述'}`,
      `点赞: ${stats.digg || 0}`,
      `评论: ${stats.comment || 0}`,
      `收藏: ${stats.collect || 0}`,
      `分享: ${stats.share || 0}`
    ].join(' | ')

    return basicInfo
  } catch (error) {
    return content
  }
}

// 获取抖音视频链接
const getDouyinLinks = (content: string) => {
  try {
    const data = JSON.parse(content)
    if (!data) return []

    const links = []
    
    // 添加视频链接
    if (data.videoUrls && Array.isArray(data.videoUrls)) {
      data.videoUrls.forEach((item: any) => {
        if (item && item.url && item.label) {
          links.push({
            label: `视频(${item.label})`,
            url: item.url
          })
        }
      })
    }

    // 添加音频链接
    if (data.audioUrl) {
      links.push({
        label: '音频',
        url: data.audioUrl
      })
    }

    return links
  } catch (error) {
    return []
  }
}

// 打开链接
const openLink = (url: string) => {
  window.open(url, '_blank')
}

// 处理行点击
const handleRowClick = (row: HistoryRecord) => {
  selectedRow.value = row
  dialogVisible.value = true
}

// 获取历史记录
const getHistoryList = async () => {
  loading.value = true
  try {
    const result = await window.ipcRenderer.invoke('history:list', {
      page: currentPage.value,
      pageSize: pageSize.value
    })
    
    historyList.value = result.records
    total.value = result.pagination.total
    
    // 如果当前页没有数据且不是第一页，回到上一页
    if (result.records.length === 0 && currentPage.value > 1) {
      currentPage.value--
      await getHistoryList()
    }
  } catch (error) {
    console.error('Failed to fetch history:', error)
    ElMessage.error('获取历史记录失败：' + (error.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

// 清除历史记录
const clearHistory = async (row: HistoryRecord) => {
  try {
    const success = await window.ipcRenderer.invoke('history:clear', row.id)
    if (success) {
      ElMessage.success('历史记录已清除')
      // 如果当前页只有一条记录，删除后自动回到上一页
      if (historyList.value.length === 1 && currentPage.value > 1) {
        currentPage.value--
      }
      await getHistoryList()
    }
  } catch (error) {
    console.error('Failed to clear history:', error)
    ElMessage.error('清除历史记录失败：' + (error.message || '未知错误'))
  }
}

// 处理每页条数变化
const handleSizeChange = (val: number) => {
  pageSize.value = val
  currentPage.value = 1 // 重置到第一页
  getHistoryList()
}

// 处理页码变化
const handleCurrentChange = (val: number) => {
  currentPage.value = val
  getHistoryList()
}

// 组件挂载时获取历史记录
onMounted(() => {
  getHistoryList()
})

// 解析内容
const parseContent = (content: string) => {
  try {
    if (typeof content === 'string') {
      return JSON.parse(content)
    }
    return content
  } catch (e) {
    console.error('解析内容失败:', e)
    return {}
  }
}

// 格式化内容
const formatContent = (row: HistoryRecord) => {
  try {
    if (row.moduleName === 'QQ查询') {
      const data = JSON.parse(row.content)
      if (row.status === 'success') {
        return `QQ: ${data.qq}${data.nickname ? ' | 昵称: ' + data.nickname : ''}${data.phonediqu ? ' | 归属地: ' + data.phonediqu : ''}`
      } else {
        return data.error || '查询失败'
      }
    }
    return row.content
  } catch (e) {
    return row.content
  }
}

// 判断是否为文件分享
const isFileShare = (row: HistoryRecord) => {
  if (row.contentType) {
    return ['file-share', 'file'].includes(row.contentType)
  }
  return row.appName === '文件分享'
}

// 获取文件扩展名
const getFileExtension = (row: HistoryRecord) => {
  const fileName = parseContent(row.content).fileName
  if (!fileName) return ''
  const parts = fileName.split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

// 复制到剪贴板
const copyToClipboard = (text: string) => {
  if (!text) {
    ElMessage.warning('没有可复制的内容')
    return
  }

  try {
    // 创建一个临时输入框
    const input = document.createElement('input')
    input.value = text
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
</script>

<style scoped>
.history-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px;
  box-sizing: border-box;
}

.history-content {
  background: var(--el-bg-color);
  border-radius: 8px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  box-shadow: var(--el-box-shadow-light);
}

.el-table {
  flex: 1;
}

:deep(.el-table__cell) {
  padding: 8px !important;
}

:deep(.el-table .cell) {
  padding: 0 8px;
  line-height: 1.5;
}

.content-cell {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  word-break: break-all;
  line-height: 1.5;
  color: var(--el-text-color-regular);
}

.content-cell .share-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.content-cell .share-content .link-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.content-cell .share-content .file-info,
.content-cell .share-content .text-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
  font-size: 0.9em;
}

.content-cell .share-content .file-info .el-icon,
.content-cell .share-content .text-preview .el-icon {
  font-size: 16px;
}

.content-cell .share-content .text-preview {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.content-cell .share-content .error-content {
  margin-top: 4px;
}

.time-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--el-text-color-secondary);
  font-size: var(--el-font-size-small);
}

.pagination-container {
  padding: 16px;
  display: flex;
  justify-content: flex-end;
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color-lighter);
}

:deep(.el-pagination) {
  justify-content: flex-end;
  --el-pagination-font-size: var(--el-font-size-small);
}

:deep(.el-pagination .el-select .el-input) {
  width: 110px;
}

.detail-content {
  max-height: 70vh;
  overflow-y: auto;
}

.shortlink-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.link-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
}

.short-url {
  padding: 4px 8px;
}

.original-url {
  color: var(--el-text-color-secondary);
}

.url-text {
  color: var(--el-color-primary);
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  text-decoration: underline;
}

.url-text:hover {
  color: var(--el-color-primary-light-3);
}

.arrow-icon {
  color: var(--el-text-color-secondary);
  font-weight: bold;
}

.link-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.share-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-name {
  color: var(--el-text-color-primary);
}

.text-preview {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-text {
  color: var(--el-text-color-regular);
}

.link-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.share-url {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 暗色主题适配 */
:root[theme-mode="dark"] .history-content {
  background: var(--el-bg-color-overlay);
}
</style>
