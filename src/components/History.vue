<template>
  <div class="history-page">
    <div class="history-panel">
      <div class="history-toolbar">
        <div class="toolbar-copy">
          <div class="toolbar-title">操作历史</div>
          <div class="toolbar-desc">点击行查看详情；可删除单条或清除全部记录</div>
        </div>
        <div class="toolbar-meta">
          <span class="meta-chip">共 {{ total }} 条</span>
          <el-button
            class="clear-all-btn"
            type="danger"
            plain
            size="small"
            :icon="Delete"
            :disabled="total === 0 || clearingAll"
            :loading="clearingAll"
            @click="clearAllHistory"
          >
            清除全部
          </el-button>
        </div>
      </div>

      <div class="history-table-wrap" v-loading="loading">
        <el-table
          :data="historyList"
          height="100%"
          class="history-table"
          :row-class-name="() => 'history-row'"
          @row-click="handleRowClick"
          :empty-text="loading ? '加载中...' : '暂无历史记录'"
        >
          <el-table-column prop="moduleName" label="模块" width="118" align="center">
            <template #default="{ row }">
              <span class="soft-tag" :class="'tone-' + getModuleTone(row.moduleName)">
                {{ row.moduleName }}
              </span>
            </template>
          </el-table-column>

          <el-table-column prop="appName" label="应用" width="100" align="center">
            <template #default="{ row }">
              <span class="app-name">{{ row.appName }}</span>
            </template>
          </el-table-column>

          <el-table-column prop="content" label="内容" min-width="280">
            <template #default="{ row }">
              <div class="content-cell">
                <template v-if="row.moduleName === '抖音去水印' && row.status === 'success'">
                  <div class="content-summary">{{ parseDouyinContent(row.content) }}</div>
                  <div class="chip-row">
                    <button
                      v-for="link in getDouyinLinks(row.content)"
                      :key="link.url + link.label"
                      type="button"
                      class="link-chip"
                      @click.stop="openLink(link.url)"
                    >
                      {{ link.label }}
                    </button>
                  </div>
                </template>

                <template v-else-if="row.moduleName === '短链生成'">
                  <div class="shortlink-block">
                    <button
                      type="button"
                      class="link-chip primary"
                      @click.stop="openLink(parseContent(row.content).shortUrl)"
                    >
                      {{ parseContent(row.content).shortUrl || '—' }}
                    </button>
                    <div
                      class="origin-line"
                      @click.stop="openLink(parseContent(row.content).originalUrl)"
                    >
                      <span class="origin-arrow">↳</span>
                      <span class="origin-url">{{ parseContent(row.content).originalUrl }}</span>
                    </div>
                  </div>
                </template>

                <template v-else-if="row.moduleName === 'share'">
                  <div v-if="row.status === 'success'" class="share-block">
                    <div class="share-title">
                      <template v-if="isFileShare(row)">
                        {{ parseContent(row.content).sourceFileName || '文件' }}
                      </template>
                      <template v-else>
                        {{ parseContent(row.content).textPreview || '文本分享' }}
                      </template>
                    </div>
                    <button
                      type="button"
                      class="link-chip primary"
                      @click.stop="openLink(parseContent(row.content).shareUrl)"
                    >
                      {{ parseContent(row.content).shareUrl || '—' }}
                    </button>
                  </div>
                  <span v-else class="error-text">
                    {{ parseContent(row.content).error || '分享失败' }}
                  </span>
                </template>

                <span v-else class="content-summary">{{ formatContent(row) }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="operationTime" label="时间" width="168">
            <template #default="{ row }">
              <div class="time-cell">
                <el-icon><Clock /></el-icon>
                <span>{{ formatDate(row.operationTime) }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="status" label="状态" width="92" align="center">
            <template #default="{ row }">
              <span class="soft-tag" :class="'status-' + row.status">
                {{ getStatusText(row.status) }}
              </span>
            </template>
          </el-table-column>

          <el-table-column fixed="right" label="操作" width="72" align="center">
            <template #default="{ row }">
              <el-button
                class="delete-btn"
                text
                type="danger"
                :icon="Delete"
                @click.stop="clearHistory(row)"
              />
            </template>
          </el-table-column>
        </el-table>

        <div v-if="!loading && historyList.length === 0" class="empty-state">
          <div class="empty-mark">
            <el-icon><Clock /></el-icon>
          </div>
          <div class="empty-title">还没有历史记录</div>
          <div class="empty-desc">使用工具箱完成操作后，结果会出现在这里</div>
        </div>
      </div>

      <div class="pagination-bar">
        <div class="pagination-summary">
          共 <strong>{{ total }}</strong> 条记录
        </div>
        <el-pagination
          class="history-pagination"
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          :background="true"
          layout="sizes, prev, pager, next"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      title="详细信息"
      width="560px"
      class="cz-tool-dialog"
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
          <div class="fallback-detail">
            <div class="fallback-row">
              <span class="fallback-label">模块</span>
              <span class="soft-tag" :class="'tone-' + getModuleTone(selectedRow.moduleName)">
                {{ selectedRow.moduleName }}
              </span>
            </div>
            <div class="fallback-row">
              <span class="fallback-label">应用</span>
              <span>{{ selectedRow.appName }}</span>
            </div>
            <div class="fallback-row">
              <span class="fallback-label">状态</span>
              <span class="soft-tag" :class="'status-' + selectedRow.status">
                {{ getStatusText(selectedRow.status) }}
              </span>
            </div>
            <div class="fallback-row">
              <span class="fallback-label">时间</span>
              <span>{{ formatDate(selectedRow.operationTime) }}</span>
            </div>
            <div class="fallback-block">
              <div class="fallback-label">内容</div>
              <pre class="fallback-pre">{{ selectedRow.content }}</pre>
            </div>
          </div>
        </template>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DouyinDetail from './history/DouyinDetail.vue'
import QQQueryDetail from './history/QQQueryDetail.vue'
import ShortLinkDetail from './history/ShortLinkDetail.vue'
import ShareDetail from './history/ShareDetail.vue'
import { Clock, Delete } from '@element-plus/icons-vue'
import { invoke } from '../api/desktop'

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
const clearingAll = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

const formatDate = (timestamp: number) => new Date(timestamp).toLocaleString()

const getModuleTone = (moduleName: string) => {
  const map: Record<string, string> = {
    QQ查询: 'blue',
    抖音去水印: 'cyan',
    抖音解析: 'cyan',
    短链生成: 'indigo',
    share: 'green',
  }
  return map[moduleName] || 'slate'
}

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    success: '成功',
    error: '失败',
    running: '运行中',
  }
  return texts[status] || '未知'
}

const parseDouyinContent = (content: string) => {
  try {
    const data = JSON.parse(content)
    if (!data) return content
    if (data.error) return `失败: ${data.error}`

    const title = data.title || data.desc || '无标题'
    const type = data.type ? ` · ${data.type}` : ''
    return `${title}${type}`
  } catch {
    return content
  }
}

const getDouyinLinks = (content: string) => {
  try {
    const data = JSON.parse(content)
    if (!data) return []

    const links: Array<{ label: string; url: string }> = []
    if (Array.isArray(data.videoUrls)) {
      data.videoUrls.forEach((item: any) => {
        if (item?.url && item?.label) {
          links.push({ label: item.label, url: item.url })
        }
      })
    } else if (data.defaultUrl) {
      links.push({ label: '默认清晰度', url: data.defaultUrl })
    }
    if (data.audioUrl) {
      links.push({ label: '音频', url: data.audioUrl })
    }
    return links
  } catch {
    return []
  }
}

const openLink = (url?: string) => {
  if (!url) return
  window.open(url, '_blank')
}

const handleRowClick = (row: HistoryRecord) => {
  selectedRow.value = row
  dialogVisible.value = true
}

const getHistoryList = async () => {
  loading.value = true
  try {
    const result = await invoke('history:list', {
      page: currentPage.value,
      pageSize: pageSize.value,
    })

    historyList.value = result.records
    total.value = result.pagination.total

    if (result.records.length === 0 && currentPage.value > 1) {
      currentPage.value--
      await getHistoryList()
    }
  } catch (error: any) {
    console.error('Failed to fetch history:', error)
    ElMessage.error('获取历史记录失败：' + (error?.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

const clearHistory = async (row: HistoryRecord) => {
  try {
    const success = await invoke('history:clear', row.id)
    if (success) {
      ElMessage.success('历史记录已清除')
      if (historyList.value.length === 1 && currentPage.value > 1) {
        currentPage.value--
      }
      await getHistoryList()
    }
  } catch (error: any) {
    console.error('Failed to clear history:', error)
    ElMessage.error('清除历史记录失败：' + (error?.message || '未知错误'))
  }
}

const clearAllHistory = async () => {
  if (total.value === 0) return

  try {
    await ElMessageBox.confirm(
      `确定清除全部 ${total.value} 条历史记录吗？此操作不可恢复。`,
      '清除全部记录',
      {
        confirmButtonText: '全部清除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
  } catch {
    return
  }

  clearingAll.value = true
  try {
    await invoke('history:clear-all')
    currentPage.value = 1
    dialogVisible.value = false
    selectedRow.value = null
    ElMessage.success('已清除全部历史记录')
    await getHistoryList()
  } catch (error: any) {
    console.error('Failed to clear all history:', error)
    ElMessage.error('清除全部失败：' + (error?.message || '未知错误'))
  } finally {
    clearingAll.value = false
  }
}

const handleSizeChange = (val: number) => {
  pageSize.value = val
  currentPage.value = 1
  getHistoryList()
}

const handleCurrentChange = (val: number) => {
  currentPage.value = val
  getHistoryList()
}

onMounted(() => {
  getHistoryList()
})

const parseContent = (content: string) => {
  try {
    if (typeof content === 'string') return JSON.parse(content)
    return content
  } catch (e) {
    console.error('解析内容失败:', e)
    return {}
  }
}

const formatContent = (row: HistoryRecord) => {
  try {
    if (row.moduleName === 'QQ查询') {
      const data = JSON.parse(row.content)
      if (row.status === 'success') {
        const phones = Array.isArray(data.phones) && data.phones.length
          ? data.phones.join('、')
          : (data.phone || '')
        return `QQ: ${data.qq}${data.nickname ? ' · ' + data.nickname : ''}${phones ? ' · ' + phones : ''}${data.phonediqu ? ' · ' + data.phonediqu : ''}`
      }
      return data.error || '查询失败'
    }
    return row.content
  } catch {
    return row.content
  }
}

const isFileShare = (row: HistoryRecord) => {
  if (row.contentType) {
    return ['file-share', 'file'].includes(row.contentType)
  }
  return row.appName === '文件分享'
}
</script>

<style scoped>
.history-page {
  height: 100%;
  padding: 16px 20px;
  box-sizing: border-box;
}

.history-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--cz-surface);
  border: 1px solid var(--cz-border);
  border-radius: var(--cz-radius-card);
  box-shadow: var(--cz-shadow-sm);
  overflow: hidden;
}

.history-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--cz-border);
  background: linear-gradient(180deg, rgba(248, 251, 255, 0.9), rgba(255, 255, 255, 0.55));
}

.toolbar-title {
  font-size: 14px;
  font-weight: 650;
  color: var(--cz-text-primary);
}

.toolbar-desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--cz-text-tertiary);
}

.toolbar-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.meta-chip,
.clear-all-btn {
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  box-sizing: border-box;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--cz-primary-hover);
  background: var(--cz-primary-soft);
  border: 1px solid rgba(59, 130, 246, 0.12);
  line-height: 1;
}

.clear-all-btn {
  margin: 0;
}

:deep(.clear-all-btn.el-button) {
  height: 28px;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

:deep(.clear-all-btn.el-button .el-icon) {
  font-size: 12px;
}

.history-table-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  padding: 0;
}

.history-table {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: transparent;
  --el-table-row-hover-bg-color: var(--cz-primary-soft);
  --el-table-border-color: var(--cz-border);
  --el-table-text-color: var(--cz-text-secondary);
  --el-table-header-text-color: var(--cz-text-tertiary);
}

:deep(.history-table .el-table__header th) {
  font-weight: 600;
  font-size: 12px;
  background: transparent !important;
}

:deep(.history-table .el-table__row.history-row) {
  cursor: pointer;
  transition: background-color var(--cz-transition);
}

:deep(.history-table .el-table__cell) {
  padding: 12px 0 !important;
  border-bottom-color: var(--cz-border) !important;
}

:deep(.history-table .cell) {
  padding: 0 16px;
  line-height: 1.45;
}

:deep(.history-table .el-table__empty-block) {
  display: none;
}

.soft-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
  white-space: nowrap;
}

.tone-blue {
  color: #2563eb;
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.14);
}

.tone-cyan {
  color: #0284c7;
  background: rgba(14, 165, 233, 0.1);
  border-color: rgba(14, 165, 233, 0.14);
}

.tone-indigo {
  color: #4f46e5;
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.14);
}

.tone-green {
  color: #16a34a;
  background: var(--cz-success-soft);
  border-color: rgba(34, 197, 94, 0.16);
}

.tone-slate {
  color: #64748b;
  background: rgba(148, 163, 184, 0.14);
  border-color: rgba(148, 163, 184, 0.18);
}

.status-success {
  color: #16a34a;
  background: var(--cz-success-soft);
  border-color: rgba(34, 197, 94, 0.16);
}

.status-error {
  color: #dc2626;
  background: var(--cz-danger-soft);
  border-color: rgba(239, 68, 68, 0.16);
}

.status-running {
  color: #d97706;
  background: var(--cz-warning-soft);
  border-color: rgba(245, 158, 11, 0.18);
}

.app-name {
  font-size: 13px;
  font-weight: 550;
  color: var(--cz-text-primary);
}

.content-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.content-summary {
  font-size: 13px;
  color: var(--cz-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.link-chip {
  max-width: 220px;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(34, 197, 94, 0.16);
  background: var(--cz-success-soft);
  color: #15803d;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: border-color var(--cz-transition), background-color var(--cz-transition);
}

.link-chip.primary {
  border-color: rgba(59, 130, 246, 0.16);
  background: var(--cz-primary-soft);
  color: var(--cz-primary-hover);
}

.link-chip:hover {
  border-color: var(--cz-border-strong);
}

.shortlink-block,
.share-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.share-title {
  font-size: 13px;
  color: var(--cz-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.origin-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  cursor: pointer;
}

.origin-arrow {
  color: var(--cz-text-tertiary);
  flex-shrink: 0;
}

.origin-url {
  min-width: 0;
  font-size: 12px;
  color: var(--cz-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.origin-url:hover {
  text-decoration: underline;
}

.error-text {
  font-size: 13px;
  color: #dc2626;
}

.time-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--cz-text-tertiary);
}

.delete-btn {
  width: 32px;
  height: 32px;
  border-radius: 10px;
}

.delete-btn:hover {
  background: var(--cz-danger-soft);
}

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  pointer-events: none;
}

.empty-mark {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: var(--cz-primary);
  background: var(--cz-primary-soft);
  margin-bottom: 4px;
}

.empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--cz-text-primary);
}

.empty-desc {
  font-size: 12px;
  color: var(--cz-text-tertiary);
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 16px;
  border-top: 1px solid var(--cz-border);
  background: linear-gradient(180deg, rgba(248, 251, 255, 0.88), var(--cz-surface-secondary));
}

.pagination-summary {
  font-size: 12px;
  color: var(--cz-text-tertiary);
  white-space: nowrap;
}

.pagination-summary strong {
  margin: 0 2px;
  font-size: 13px;
  font-weight: 700;
  color: var(--cz-text-primary);
  font-variant-numeric: tabular-nums;
}

.history-pagination {
  margin-left: auto;
  --el-pagination-font-size: 12px;
  --el-pagination-button-bg-color: var(--cz-surface);
  --el-pagination-hover-color: var(--cz-primary);
  --el-pagination-button-color: var(--cz-text-secondary);
}

:deep(.history-pagination .el-pagination__sizes) {
  margin-right: 10px;
}

:deep(.history-pagination .el-select) {
  width: 118px;
}

:deep(.history-pagination .el-select .el-select__wrapper) {
  min-height: 30px;
  border-radius: 10px;
  box-shadow: 0 0 0 1px var(--cz-border) inset;
  background: var(--cz-surface);
}

:deep(.history-pagination .el-select .el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--cz-border-strong) inset;
}

:deep(.history-pagination .el-pager li) {
  border-radius: 8px;
  font-weight: 600;
}

:deep(.history-pagination .btn-prev),
:deep(.history-pagination .btn-next) {
  border-radius: 8px;
}

:deep(.history-pagination.is-background .el-pager li.is-active) {
  background: var(--cz-primary);
}

.detail-content {
  max-height: 70vh;
  overflow-y: auto;
}

.fallback-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fallback-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--cz-text-secondary);
}

.fallback-label {
  width: 42px;
  flex-shrink: 0;
  font-size: 12px;
  color: var(--cz-text-tertiary);
}

.fallback-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fallback-pre {
  margin: 0;
  padding: 12px;
  border-radius: 12px;
  background: var(--cz-surface-tertiary);
  border: 1px solid var(--cz-border);
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  color: var(--cz-text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  :deep(.history-table .el-table__row.history-row),
  .link-chip {
    transition: none;
  }
}
</style>
