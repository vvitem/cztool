<template>
  <div class="rules-page">
    <div class="rules-panel">
      <div class="rules-toolbar">
        <div class="toolbar-copy">
          <div class="toolbar-title">AI 规则中心</div>
          <div class="toolbar-desc">盘点本机各 AI 编程工具的全局规则 / 技能 / Agent</div>
        </div>
        <div class="toolbar-actions">
          <span class="meta-chip">共 {{ assets.length }} 项</span>
          <el-input
            v-model="keyword"
            clearable
            placeholder="搜索标题、路径、slug…"
            class="search-input"
          />
          <el-button type="primary" :loading="loading" @click="refresh">重新扫描</el-button>
        </div>
      </div>

      <div class="tool-overview">
        <div
          v-for="tool in tools"
          :key="tool.toolId"
          class="tool-tile"
          :class="[{ active: filterTool === tool.toolId, muted: !tool.detected }, `tone-${tool.toolId}`]"
          @click="toggleToolFilter(tool.toolId)"
        >
          <div class="tile-top">
            <span class="tile-name">{{ tool.label }}</span>
            <span class="tile-badge" :class="tool.detected ? 'ok' : 'miss'">
              {{ tool.detected ? `${tool.total} 项` : '未检测到' }}
            </span>
          </div>
          <div v-if="tool.detected" class="tile-counts">
            <span>规则 {{ tool.counts.rule }}</span>
            <span>技能 {{ tool.counts.skill }}</span>
            <span>Agent {{ tool.counts.agent }}</span>
            <span>提示 {{ tool.counts.prompt }}</span>
          </div>
          <div v-else class="tile-hint">未找到全局配置目录</div>
        </div>
      </div>

      <div class="filter-row">
        <div class="kind-chips">
          <button
            type="button"
            class="chip"
            :class="{ active: !filterKind }"
            @click="filterKind = ''"
          >
            全部类型
          </button>
          <button
            v-for="k in kindOptions"
            :key="k.value"
            type="button"
            class="chip"
            :class="{ active: filterKind === k.value }"
            @click="filterKind = k.value"
          >
            {{ k.label }}
          </button>
        </div>
        <div class="tab-switch">
          <button type="button" class="chip" :class="{ active: tab === 'list' }" @click="switchTab('list')">
            资产列表
          </button>
          <button type="button" class="chip" :class="{ active: tab === 'compare' }" @click="switchTab('compare')">
            跨工具对照
          </button>
        </div>
      </div>

      <div class="rules-body" v-loading="loading">
        <template v-if="tab === 'list'">
          <div class="split-view">
            <div class="list-pane" :style="{ width: listWidth + 'px' }">
              <div v-if="!loading && filteredAssets.length === 0" class="empty-state">
                <div class="empty-title">没有匹配的规则资产</div>
                <div class="empty-desc">调整筛选条件，或确认本机已安装对应 AI 工具</div>
              </div>
              <div
                v-for="asset in filteredAssets"
                :key="asset.id"
                class="asset-row"
                :class="{ active: selected?.id === asset.id }"
                @click="selectAsset(asset)"
              >
                <div class="asset-main">
                  <span class="soft-tag" :class="'tool-' + asset.toolId">{{ toolLabel(asset.toolId) }}</span>
                  <span class="soft-tag kind">{{ kindLabel(asset.kind) }}</span>
                  <span class="asset-title">{{ asset.title }}</span>
                </div>
                <div class="asset-meta">
                  <span class="asset-path" :title="asset.absPath">{{ asset.relPath }}</span>
                  <span class="asset-time">{{ formatTime(asset.mtime) }}</span>
                </div>
              </div>
            </div>

            <div
              class="split-handle"
              :class="{ resizing: isResizing }"
              @mousedown="startResize"
            />

            <div class="preview-pane">
              <template v-if="selected">
                <div class="preview-head">
                  <div>
                    <div class="preview-title">
                      {{ selected.title }}
                      <span v-if="isDirty" class="dirty-dot" title="未保存">●</span>
                    </div>
                    <div class="preview-path" :title="selected.absPath">{{ selected.absPath }}</div>
                  </div>
                  <div class="preview-actions">
                    <template v-if="isEditing">
                      <el-button size="small" :disabled="saving" @click="cancelEdit">取消</el-button>
                      <el-button
                        size="small"
                        type="primary"
                        :loading="saving"
                        :disabled="!isDirty"
                        @click="saveEdit"
                      >
                        保存
                      </el-button>
                    </template>
                    <template v-else>
                      <el-button size="small" @click="revealSelected">在访达中显示</el-button>
                      <el-button size="small" @click="openSelected">外部打开</el-button>
                      <el-button size="small" type="primary" @click="startEdit">编辑</el-button>
                    </template>
                  </div>
                </div>
                <textarea
                  v-if="isEditing"
                  v-model="editText"
                  class="preview-editor"
                  spellcheck="false"
                  @keydown="onEditorKeydown"
                />
                <pre v-else class="preview-content" v-loading="previewLoading">{{ previewText }}</pre>
                <div v-if="previewTruncated && !isEditing" class="preview-note">
                  内容过长，预览已截断；点击「编辑」将加载完整文件（上限 2MB）
                </div>
              </template>
              <div v-else class="preview-empty">
                选择左侧条目查看预览
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="compare-pane">
            <div class="compare-summary">
              共 {{ compareGroups.length }} 组 ·
              跨工具 {{ multiToolGroups.length }} 组 ·
              同内容 {{ identicalGroups.length }} 组
            </div>
            <div v-if="!loading && filteredCompareGroups.length === 0" class="empty-state">
              <div class="empty-title">暂无对照结果</div>
              <div class="empty-desc">扫描后将按归一化名称汇总各工具中的同名规则</div>
            </div>
            <div
              v-for="group in filteredCompareGroups"
              :key="group.slug"
              class="compare-card"
            >
              <div class="compare-card-head">
                <div class="compare-title">{{ group.title }}</div>
                <div class="compare-tags">
                  <span class="soft-tag" :class="'match-' + group.matchType">
                    {{ matchLabel(group.matchType) }}
                  </span>
                  <span
                    v-for="tid in group.toolIds"
                    :key="tid"
                    class="soft-tag"
                    :class="'tool-' + tid"
                  >
                    {{ toolLabel(tid) }}
                  </span>
                </div>
              </div>
              <div class="compare-assets">
                <button
                  v-for="asset in group.assets"
                  :key="asset.id"
                  type="button"
                  class="compare-asset"
                  @click="jumpToAsset(asset)"
                >
                  <span class="soft-tag" :class="'tool-' + asset.toolId">{{ toolLabel(asset.toolId) }}</span>
                  <span class="compare-asset-path">{{ asset.relPath }}</span>
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { compareAssets, type RuleAsset, type ToolId, type AssetKind, type CompareGroup } from '../utils/rulesCompare'

interface ToolSummary {
  toolId: ToolId
  label: string
  roots: string[]
  presentRoots: string[]
  detected: boolean
  counts: Record<AssetKind, number>
  total: number
}

const LIST_WIDTH = {
  MIN: 240,
  MAX: 520,
  DEFAULT: 300,
}

const loading = ref(false)
const previewLoading = ref(false)
const tools = ref<ToolSummary[]>([])
const assets = ref<RuleAsset[]>([])
const compareGroups = ref<CompareGroup[]>([])
const selected = ref<RuleAsset | null>(null)
const previewText = ref('')
const previewTruncated = ref(false)
const isEditing = ref(false)
const editText = ref('')
const savedText = ref('')
const saving = ref(false)
const keyword = ref('')
const filterTool = ref<ToolId | ''>('')
const filterKind = ref<AssetKind | ''>('')
const tab = ref<'list' | 'compare'>('list')
const listWidth = ref(LIST_WIDTH.DEFAULT)
const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)

const isDirty = computed(() => isEditing.value && editText.value !== savedText.value)

const kindOptions = [
  { value: 'rule' as AssetKind, label: '规则' },
  { value: 'skill' as AssetKind, label: '技能' },
  { value: 'agent' as AssetKind, label: 'Agent' },
  { value: 'prompt' as AssetKind, label: '提示词' },
  { value: 'other' as AssetKind, label: '其他' },
]

const toolLabel = (id: ToolId) => {
  const map: Record<ToolId, string> = {
    cursor: 'Cursor',
    claude: 'Claude',
    codex: 'Codex',
    trae: 'Trae',
    qoder: 'Qoder',
  }
  return map[id] || id
}

const kindLabel = (kind: AssetKind) => {
  const map: Record<AssetKind, string> = {
    rule: '规则',
    skill: '技能',
    agent: 'Agent',
    prompt: '提示词',
    other: '其他',
  }
  return map[kind]
}

const matchLabel = (t: CompareGroup['matchType']) => {
  if (t === 'identical') return '同内容'
  if (t === 'same-name') return '同名不同内容'
  return '仅一处'
}

const formatTime = (mtime: number) => {
  if (!mtime) return ''
  return new Date(mtime).toLocaleString()
}

const filteredAssets = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return assets.value.filter((a) => {
    if (filterTool.value && a.toolId !== filterTool.value) return false
    if (filterKind.value && a.kind !== filterKind.value) return false
    if (!q) return true
    return (
      a.title.toLowerCase().includes(q)
      || a.relPath.toLowerCase().includes(q)
      || a.slug.toLowerCase().includes(q)
      || a.absPath.toLowerCase().includes(q)
    )
  })
})

const multiToolGroups = computed(() =>
  compareGroups.value.filter((g) => g.toolIds.length > 1),
)

const identicalGroups = computed(() =>
  compareGroups.value.filter((g) => g.matchType === 'identical'),
)

const filteredCompareGroups = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return compareGroups.value.filter((g) => {
    if (filterTool.value && !g.toolIds.includes(filterTool.value)) return false
    if (filterKind.value && !g.assets.some((a) => a.kind === filterKind.value)) return false
    if (!q) return true
    return (
      g.title.toLowerCase().includes(q)
      || g.slug.toLowerCase().includes(q)
      || g.assets.some((a) => a.relPath.toLowerCase().includes(q))
    )
  })
})

const toggleToolFilter = (toolId: ToolId) => {
  filterTool.value = filterTool.value === toolId ? '' : toolId
}

const switchTab = async (next: 'list' | 'compare') => {
  if (tab.value === next) return
  if (next === 'compare' && !(await confirmDiscardIfDirty())) return
  if (next === 'compare') resetEditState()
  tab.value = next
}

const resetEditState = () => {
  isEditing.value = false
  editText.value = ''
  savedText.value = ''
  saving.value = false
}

const confirmDiscardIfDirty = async () => {
  if (!isDirty.value) return true
  try {
    await ElMessageBox.confirm('当前有未保存的修改，确定放弃吗？', '放弃修改', {
      confirmButtonText: '放弃',
      cancelButtonText: '继续编辑',
      type: 'warning',
    })
    return true
  } catch {
    return false
  }
}

const refresh = async () => {
  if (!(await confirmDiscardIfDirty())) return
  loading.value = true
  try {
    const result = await window.ipcRenderer.invoke('rules:scan')
    const nextAssets: RuleAsset[] = result.assets || []
    tools.value = result.tools || []
    assets.value = nextAssets
    // 在渲染进程本地对照，避免把 Vue Proxy 经 IPC structuredClone
    compareGroups.value = compareAssets(nextAssets)

    if (selected.value) {
      const still = assets.value.find((a) => a.id === selected.value?.id)
      if (still) {
        selected.value = still
        resetEditState()
        await loadPreview(still)
      } else {
        selected.value = null
        previewText.value = ''
        resetEditState()
      }
    }
  } catch (error: any) {
    console.error(error)
    ElMessage.error('扫描失败：' + (error?.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

const loadPreview = async (asset: RuleAsset, options?: { full?: boolean }) => {
  previewLoading.value = true
  try {
    const data = await window.ipcRenderer.invoke('rules:read', asset.absPath, options)
    previewText.value = data.content || ''
    previewTruncated.value = !!data.truncated
    return data
  } catch (error: any) {
    previewText.value = ''
    previewTruncated.value = false
    ElMessage.error('读取预览失败：' + (error?.message || '未知错误'))
    throw error
  } finally {
    previewLoading.value = false
  }
}

const selectAsset = async (asset: RuleAsset) => {
  if (selected.value?.id === asset.id && !isEditing.value) return
  if (!(await confirmDiscardIfDirty())) return
  resetEditState()
  selected.value = asset
  await loadPreview(asset)
}

const jumpToAsset = async (asset: RuleAsset) => {
  tab.value = 'list'
  filterTool.value = asset.toolId
  await selectAsset(asset)
}

const startEdit = async () => {
  if (!selected.value || isEditing.value) return
  try {
    const data = await loadPreview(selected.value, { full: true })
    if (data.truncated) {
      ElMessage.warning('文件超过 2MB，无法在应用内完整编辑，请用外部编辑器打开')
      return
    }
    savedText.value = data.content || ''
    editText.value = savedText.value
    isEditing.value = true
    await nextTick()
    const el = document.querySelector('.preview-editor') as HTMLTextAreaElement | null
    el?.focus()
  } catch {
    // loadPreview 已提示
  }
}

const cancelEdit = async () => {
  if (!(await confirmDiscardIfDirty())) return
  resetEditState()
}

const saveEdit = async () => {
  if (!selected.value || !isDirty.value || saving.value) return
  saving.value = true
  try {
    await window.ipcRenderer.invoke('rules:write', selected.value.absPath, editText.value)
    savedText.value = editText.value
    previewText.value = editText.value
    previewTruncated.value = false
    selected.value = {
      ...selected.value,
      size: new TextEncoder().encode(editText.value).length,
      mtime: Date.now(),
    }
    const idx = assets.value.findIndex((a) => a.id === selected.value?.id)
    if (idx >= 0 && selected.value) {
      assets.value[idx] = { ...selected.value }
    }
    ElMessage.success('已保存')
    isEditing.value = false
  } catch (error: any) {
    ElMessage.error('保存失败：' + (error?.message || '未知错误'))
  } finally {
    saving.value = false
  }
}

const onEditorKeydown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    saveEdit()
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    cancelEdit()
  }
}

const revealSelected = async () => {
  if (!selected.value) return
  try {
    await window.ipcRenderer.invoke('rules:reveal', selected.value.absPath)
  } catch (error: any) {
    ElMessage.error(error?.message || '无法在访达中显示')
  }
}

const openSelected = async () => {
  if (!selected.value) return
  try {
    await window.ipcRenderer.invoke('rules:open', selected.value.absPath)
  } catch (error: any) {
    ElMessage.error(error?.message || '无法打开文件')
  }
}

const startResize = (e: MouseEvent) => {
  isResizing.value = true
  resizeStartX.value = e.clientX
  resizeStartWidth.value = listWidth.value
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', stopResize)
}

const onResizeMove = (e: MouseEvent) => {
  if (!isResizing.value) return
  const next = resizeStartWidth.value + (e.clientX - resizeStartX.value)
  listWidth.value = Math.max(LIST_WIDTH.MIN, Math.min(LIST_WIDTH.MAX, next))
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', stopResize)
}

watch(filteredAssets, (list) => {
  if (selected.value && !list.some((a) => a.id === selected.value?.id)) {
    // keep selection even if filtered out for preview stability
  }
})

onMounted(() => {
  refresh()
})

onBeforeUnmount(() => {
  stopResize()
})
</script>

<style scoped>
.rules-page {
  height: 100%;
  padding: 16px 20px;
  box-sizing: border-box;
}

.rules-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--cz-surface);
  border: 1px solid var(--cz-border);
  border-radius: var(--cz-radius-card);
  box-shadow: var(--cz-shadow-sm);
  overflow: hidden;
}

.rules-toolbar {
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

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--cz-primary-hover);
  background: var(--cz-primary-soft);
  border: 1px solid rgba(59, 130, 246, 0.12);
  white-space: nowrap;
}

.search-input {
  width: 220px;
}

.tool-overview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--cz-border);
}

.tool-tile {
  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--cz-border);
  background: var(--cz-surface-secondary);
  cursor: pointer;
  transition: border-color var(--cz-transition), transform var(--cz-transition);
}

.tool-tile:hover {
  border-color: var(--cz-border-strong);
  transform: translateY(-1px);
}

.tool-tile.active {
  border-color: rgba(59, 130, 246, 0.45);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.08);
}

.tool-tile.muted {
  opacity: 0.7;
}

.tile-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.tile-name {
  font-size: 13px;
  font-weight: 650;
  color: var(--cz-text-primary);
}

.tile-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}

.tile-badge.ok {
  color: var(--cz-primary-hover);
  background: var(--cz-primary-soft);
}

.tile-badge.miss {
  color: var(--cz-text-tertiary);
  background: rgba(148, 163, 184, 0.16);
}

.tile-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  font-size: 11px;
  color: var(--cz-text-tertiary);
}

.tile-hint {
  font-size: 11px;
  color: var(--cz-text-tertiary);
}

.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--cz-border);
  flex-wrap: wrap;
}

.kind-chips,
.tab-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--cz-border);
  background: var(--cz-surface);
  color: var(--cz-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.chip.active {
  color: var(--cz-primary-hover);
  background: var(--cz-primary-soft);
  border-color: rgba(59, 130, 246, 0.18);
}

.rules-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.split-view {
  flex: 1;
  min-height: 0;
  display: flex;
  width: 100%;
}

.list-pane {
  width: 300px;
  flex-shrink: 0;
  overflow: auto;
  border-right: none;
}

.split-handle {
  width: 6px;
  flex-shrink: 0;
  cursor: ew-resize;
  background: transparent;
  position: relative;
  z-index: 2;
  transition: background-color var(--cz-transition);
}

.split-handle::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 2px;
  width: 1px;
  background: var(--cz-border);
}

.split-handle:hover,
.split-handle.resizing {
  background: rgba(59, 130, 246, 0.2);
}

.split-handle:hover::before,
.split-handle.resizing::before {
  background: rgba(59, 130, 246, 0.55);
}

.preview-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--cz-surface-secondary);
}

.asset-row {
  padding: 12px 14px;
  border-bottom: 1px solid var(--cz-border);
  cursor: pointer;
  transition: background-color var(--cz-transition);
}

.asset-row:hover,
.asset-row.active {
  background: var(--cz-primary-soft);
}

.asset-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin-bottom: 6px;
}

.asset-title {
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--cz-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
  color: var(--cz-text-tertiary);
}

.asset-path {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.soft-tag {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
  border: 1px solid transparent;
}

.soft-tag.kind {
  color: #64748b;
  background: rgba(148, 163, 184, 0.14);
}

.tool-cursor { color: #2563eb; background: rgba(59, 130, 246, 0.1); }
.tool-claude { color: #d97706; background: rgba(245, 158, 11, 0.14); }
.tool-codex { color: #0f766e; background: rgba(20, 184, 166, 0.12); }
.tool-trae { color: #7c3aed; background: rgba(124, 58, 237, 0.1); }
.tool-qoder { color: #db2777; background: rgba(236, 72, 153, 0.12); }

.match-identical { color: #16a34a; background: var(--cz-success-soft); }
.match-same-name { color: #d97706; background: var(--cz-warning-soft); }
.match-single { color: #64748b; background: rgba(148, 163, 184, 0.14); }

.preview-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--cz-border);
  background: var(--cz-surface);
}

.preview-title {
  font-size: 14px;
  font-weight: 650;
  color: var(--cz-text-primary);
}

.dirty-dot {
  margin-left: 6px;
  font-size: 10px;
  color: #d97706;
  vertical-align: middle;
}

.preview-path {
  margin-top: 4px;
  font-size: 11px;
  color: var(--cz-text-tertiary);
  word-break: break-all;
}

.preview-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  align-items: flex-start;
}

.preview-content,
.preview-editor {
  flex: 1;
  margin: 0;
  padding: 16px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--cz-text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.preview-editor {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  background: var(--cz-surface);
  color: var(--cz-text-primary);
  box-sizing: border-box;
}

.preview-note,
.preview-empty {
  padding: 12px 16px;
  font-size: 12px;
  color: var(--cz-text-tertiary);
}

.preview-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.compare-pane {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 16px 20px;
}

.compare-summary {
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--cz-text-tertiary);
}

.compare-card {
  padding: 12px 14px;
  margin-bottom: 10px;
  border-radius: 14px;
  border: 1px solid var(--cz-border);
  background: var(--cz-surface-secondary);
}

.compare-card-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.compare-title {
  font-size: 13px;
  font-weight: 650;
  color: var(--cz-text-primary);
}

.compare-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.compare-assets {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.compare-asset {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: var(--cz-surface);
  cursor: pointer;
  text-align: left;
}

.compare-asset:hover {
  border-color: var(--cz-border-strong);
}

.compare-asset-path {
  min-width: 0;
  font-size: 12px;
  color: var(--cz-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-state {
  padding: 48px 20px;
  text-align: center;
}

.empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--cz-text-primary);
}

.empty-desc {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cz-text-tertiary);
}

@media (prefers-reduced-motion: reduce) {
  .tool-tile,
  .asset-row {
    transition: none;
  }
}
</style>
