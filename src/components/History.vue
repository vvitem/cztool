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
                <template v-if="isVideoParseModule(row.moduleName) && row.status === 'success' && getDouyinLinks(row.content).length">
                  <div class="content-summary">{{ summarizeHistoryContent(row) }}</div>
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

                <template v-else-if="row.moduleName === '短链生成' && parseContent(row.content).shortUrl">
                  <div class="shortlink-block">
                    <button
                      type="button"
                      class="link-chip primary"
                      @click.stop="openLink(parseContent(row.content).shortUrl)"
                    >
                      {{ parseContent(row.content).shortUrl }}
                    </button>
                    <div
                      v-if="parseContent(row.content).originalUrl"
                      class="origin-line"
                      @click.stop="openLink(parseContent(row.content).originalUrl)"
                    >
                      <span class="origin-arrow">↳</span>
                      <span class="origin-url">{{ parseContent(row.content).originalUrl }}</span>
                    </div>
                  </div>
                </template>

                <template v-else-if="row.moduleName === 'share' && row.status === 'success' && parseContent(row.content).shareUrl">
                  <div class="share-block">
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
                      {{ parseContent(row.content).shareUrl }}
                    </button>
                  </div>
                </template>

                <span v-else class="content-summary">{{ summarizeHistoryContent(row) }}</span>
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
      :width="detailMeta.width"
      :class="['cz-tool-dialog', `tone-${detailMeta.tone}`]"
      destroy-on-close
      align-center
      :show-close="true"
      :close-on-click-modal="true"
      :close-on-press-escape="true"
    >
      <template #header>
        <div class="dialog-heading">
          <span class="dialog-heading-mark" :class="detailMeta.tone">
            <el-icon><component :is="detailMeta.icon" /></el-icon>
          </span>
          <div>
            <div class="dialog-heading-title">{{ detailMeta.title }}</div>
            <div class="dialog-heading-sub">{{ detailMeta.sub }}</div>
          </div>
        </div>
      </template>

      <div v-if="selectedRow" class="cz-dialog-body history-detail-body">
        <template v-if="isVideoParseModule(selectedRow.moduleName)">
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
        <template v-else-if="selectedRow.moduleName === '节假日查询'">
          <HolidayDetail :record="selectedRow" />
        </template>
        <template v-else-if="selectedRow.moduleName === '地址模拟'">
          <AddressMockDetail :record="selectedRow" />
        </template>
        <template v-else>
          <div class="cz-history-detail">
            <div class="hd-meta">
              <span class="soft-tag" :class="'tone-' + getModuleTone(selectedRow.moduleName)">
                {{ selectedRow.moduleName }}
              </span>
              <span class="hd-pill" :class="'status-' + selectedRow.status">
                {{ getStatusText(selectedRow.status) }}
              </span>
            </div>
            <div class="hd-card">
              <div class="hd-field">
                <div class="hd-label">应用</div>
                <div class="hd-value-row">
                  <span class="hd-value-text">{{ selectedRow.appName }}</span>
                </div>
              </div>
              <div class="hd-field">
                <div class="hd-label">时间</div>
                <div class="hd-value-row">
                  <span class="hd-value-text">{{ formatDate(selectedRow.operationTime) }}</span>
                </div>
              </div>
              <template v-if="detailFields(selectedRow.content).length">
                <div
                  v-for="item in detailFields(selectedRow.content)"
                  :key="item.key"
                  class="hd-field"
                >
                  <div class="hd-label">{{ item.key }}</div>
                  <div class="hd-value-row">
                    <span class="hd-value-text" :class="{ mono: item.mono }">{{ item.value }}</span>
                  </div>
                </div>
              </template>
              <div v-else class="hd-field">
                <div class="hd-label">内容</div>
                <pre class="hd-preview">{{ selectedRow.content }}</pre>
              </div>
            </div>
          </div>
        </template>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onActivated } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import DouyinDetail from './history/DouyinDetail.vue'
import QQQueryDetail from './history/QQQueryDetail.vue'
import ShortLinkDetail from './history/ShortLinkDetail.vue'
import ShareDetail from './history/ShareDetail.vue'
import HolidayDetail from './history/HolidayDetail.vue'
import AddressMockDetail from './history/AddressMockDetail.vue'
import {
  Clock,
  Delete,
  Search,
  VideoCamera,
  Link,
  Upload,
  Calendar,
  Location,
  Document,
} from '@element-plus/icons-vue'
import type { Component } from 'vue'
import { invoke, openExternal } from '../api/desktop'
import type { HistoryRecord } from '../types'

const historyList = ref<HistoryRecord[]>([])
const dialogVisible = ref(false)
const selectedRow = ref<HistoryRecord | null>(null)
const loading = ref(false)
const clearingAll = ref(false)

const detailMeta = computed(() => {
  const row = selectedRow.value
  const moduleName = row?.moduleName || ''
  const map: Record<string, { title: string; sub: string; tone: string; icon: Component; width: string }> = {
    QQ查询: { title: 'QQ 查询详情', sub: '头像、昵称与关联信息', tone: 'blue', icon: Search, width: '560px' },
    视频解析: { title: '视频解析详情', sub: '标题、链接与清晰度', tone: 'cyan', icon: VideoCamera, width: '580px' },
    抖音去水印: { title: '视频解析详情', sub: '标题、链接与清晰度', tone: 'cyan', icon: VideoCamera, width: '580px' },
    抖音解析: { title: '视频解析详情', sub: '标题、链接与清晰度', tone: 'cyan', icon: VideoCamera, width: '580px' },
    短链生成: { title: '短链详情', sub: '短链与原始网址', tone: 'indigo', icon: Link, width: '560px' },
    share: { title: '文件分享详情', sub: '托管链接与文件信息', tone: 'cyan', icon: Upload, width: '560px' },
    节假日查询: { title: '节假日查询', sub: '假期与长周末明细', tone: 'amber', icon: Calendar, width: '560px' },
    地址模拟: { title: '地址模拟详情', sub: '测试地址明细', tone: 'slate', icon: Location, width: '620px' },
  }
  return map[moduleName] || {
    title: '记录详情',
    sub: moduleName || '历史记录',
    tone: 'slate',
    icon: Document,
    width: '520px',
  }
})

const formatHolidaySummary = (raw: string) => {
  try {
    const data = JSON.parse(raw)
    const parts = [
      data.country ? `国家 ${String(data.country).toUpperCase()}` : '',
      data.mode === 'longWeekends' ? '长周末' : '公共假期',
      data.year ? `${data.year} 年` : '',
      data.count != null ? `${data.count} 条` : '',
    ].filter(Boolean)
    return parts.join(' · ') || '节假日查询'
  } catch {
    return '节假日查询'
  }
}

/** 详情弹窗：把 JSON 拆成具体字段，不做一行摘要 */
const detailFields = (raw: string): Array<{ key: string; value: string; mono?: boolean }> => {
  try {
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object' || Array.isArray(data)) return []
    return Object.entries(data).map(([key, value]) => {
      let text: string
      if (value == null) text = '—'
      else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        text = String(value)
      } else {
        text = JSON.stringify(value, null, 2)
      }
      return {
        key,
        value: text,
        mono: typeof value === 'object' || (typeof value === 'string' && /https?:\/\//.test(value)),
      }
    })
  } catch {
    return []
  }
}

const looksLikeJson = (text: string) => {
  const t = text.trim()
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))
}

const clipText = (text: string, max = 80) => {
  const t = text.trim()
  if (!t) return ''
  if (looksLikeJson(t)) return ''
  return t.length > max ? `${t.slice(0, max)}…` : t
}

const parseDouyinContent = (content: string) => {
  try {
    const data = JSON.parse(content)
    if (!data || typeof data !== 'object') return '视频解析'
    if (data.error) return `失败: ${String(data.error)}`

    const title = String(data.title || data.desc || '无标题')
    const type = data.type ? ` · ${data.type}` : ''
    return `${title}${type}`
  } catch {
    return '视频解析'
  }
}
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

const formatDate = (timestamp: number) => new Date(timestamp).toLocaleString()

const getModuleTone = (moduleName: string) => {
  const map: Record<string, string> = {
    QQ查询: 'blue',
    视频解析: 'cyan',
    抖音去水印: 'cyan',
    抖音解析: 'cyan',
    短链生成: 'indigo',
    节假日查询: 'amber',
    地址模拟: 'slate',
    share: 'cyan',
  }
  return map[moduleName] || 'slate'
}

/** 兼容历史记录里旧的「抖音去水印 / 抖音解析」模块名 */
const isVideoParseModule = (moduleName?: string) =>
  moduleName === '视频解析' || moduleName === '抖音去水印' || moduleName === '抖音解析'

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    success: '成功',
    error: '失败',
    running: '运行中',
  }
  return texts[status] || '未知'
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

const openLink = async (url?: string) => {
  if (!url) return
  try {
    await openExternal(url)
  } catch (error: any) {
    ElMessage.error(error?.message || '打开链接失败')
  }
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

onActivated(() => {
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

const summarizeHistoryContent = (row: HistoryRecord) => {
  const raw = typeof row.content === 'string' ? row.content.trim() : ''
  if (!raw) return '—'

  let data: Record<string, any> | null = null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      data = parsed
    } else if (Array.isArray(parsed)) {
      return `${row.appName || row.moduleName} · ${parsed.length} 项`
    }
  } catch {
    return clipText(raw) || `${row.appName || row.moduleName} · 查看详情`
  }

  if (row.status === 'error') {
    const err = data?.error || data?.message
    if (typeof err === 'string' && err.trim() && !looksLikeJson(err)) {
      return clipText(err) || '操作失败'
    }
    const plain = clipText(raw)
    if (plain) return plain
    return '操作失败'
  }

  switch (row.moduleName) {
    case 'QQ查询': {
      const phones = Array.isArray(data?.phones) && data!.phones.length
        ? data!.phones.map(String).join('、')
        : (data?.phone ? String(data.phone) : '')
      const parts = [
        data?.qq ? `QQ ${data.qq}` : '',
        data?.nickname ? String(data.nickname) : '',
        phones,
        data?.phonediqu ? String(data.phonediqu) : '',
      ].filter(Boolean)
      return parts.join(' · ') || 'QQ 查询'
    }
    case '节假日查询':
      return formatHolidaySummary(raw)
    case '地址模拟': {
      if (data?.error && typeof data.error === 'string') {
        return clipText(data.error) || '地址生成失败'
      }
      const typeLabel = data?.typeLabel || data?.type || '地址'
      const n = Array.isArray(data?.results) ? data.results.length : data?.count
      return n != null ? `${typeLabel} · ${n} 条` : String(typeLabel)
    }
    case '短链生成':
      return String(data?.shortUrl || data?.originalUrl || '短链记录')
    case 'share': {
      if (data?.error && typeof data.error === 'string') return clipText(data.error) || '分享失败'
      return String(
        data?.sourceFileName || data?.fileName || data?.textPreview || data?.shareUrl || '分享记录',
      )
    }
    default: {
      if (isVideoParseModule(row.moduleName)) {
        return parseDouyinContent(raw)
      }
      const candidates = [
        data?.title,
        data?.name,
        data?.desc,
        data?.nickname,
        data?.shortUrl,
        data?.shareUrl,
        data?.url,
        data?.qq ? `QQ ${data.qq}` : '',
      ]
      for (const c of candidates) {
        if (typeof c === 'string' && c.trim() && !looksLikeJson(c)) {
          return clipText(c) || `${row.appName || row.moduleName} · 查看详情`
        }
      }
      if (data?.country) return formatHolidaySummary(raw)
      return `${row.appName || row.moduleName} · 查看详情`
    }
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

.tone-amber {
  color: #d97706;
  background: var(--cz-warning-soft);
  border-color: rgba(245, 158, 11, 0.18);
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

.history-detail-body {
  padding-bottom: 20px;
}

@media (prefers-reduced-motion: reduce) {
  :deep(.history-table .el-table__row.history-row),
  .link-chip {
    transition: none;
  }
}
</style>
