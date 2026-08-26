<template>
  <div class="rules-page">
    <div class="rules-panel">
      <div class="rules-toolbar">
        <div class="toolbar-copy">
          <div class="toolbar-title">AI 规则中心</div>
          <div class="toolbar-desc">
            {{
              scopeMode === 'project'
                ? (projectRoot ? `项目：${projectRoot}` : '打开项目目录以扫描仓库规则')
                : '盘点本机各 AI 编程工具的全局规则 / 技能 / Agent'
            }}
          </div>
        </div>
        <div class="toolbar-actions">
          <div class="scope-switch">
            <button
              type="button"
              class="chip"
              :class="{ active: scopeMode === 'global' }"
              @click="setScope('global')"
            >
              全局
            </button>
            <button
              type="button"
              class="chip"
              :class="{ active: scopeMode === 'project' }"
              @click="setScope('project')"
            >
              项目
            </button>
          </div>
          <span class="meta-chip">共 {{ assets.length }} 项</span>
          <el-input
            v-model="keyword"
            clearable
            placeholder="搜索标题、路径、slug…"
            class="search-input"
          />
          <el-button v-if="scopeMode === 'project'" @click="pickProject">打开项目…</el-button>
          <el-button
            v-if="scopeMode === 'project' && projectRoot"
            @click="clearProject"
          >
            关闭项目
          </el-button>
          <el-button v-if="scopeMode === 'global'" @click="openCreateDialog">新建</el-button>
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
          <div v-else class="tile-hint">
            {{ scopeMode === 'project' ? '项目中未找到此类配置' : '未找到全局配置目录' }}
          </div>
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
          <button type="button" class="chip" :class="{ active: tab === 'health' }" @click="switchTab('health')">
            健康度
            <span v-if="health?.issueCount" class="chip-count">{{ health.issueCount }}</span>
          </button>
        </div>
      </div>

      <div class="rules-body" v-loading="loading">
        <template v-if="tab === 'list'">
          <div class="split-view">
            <div class="list-pane" :style="{ width: listWidth + 'px' }">
              <div v-if="!loading && filteredAssets.length === 0" class="empty-state">
                <div class="empty-title">没有匹配的规则资产</div>
                <div class="empty-desc">
                  {{
                    scopeMode === 'project' && !projectRoot
                      ? '先点击「打开项目…」选择仓库目录'
                      : '调整筛选条件，或确认本机已安装对应 AI 工具'
                  }}
                </div>
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
                      <el-button
                        v-if="scopeMode === 'global' && selected.toolId !== 'workspace'"
                        size="small"
                        @click="openSyncDialog(selected)"
                      >
                        同步到…
                      </el-button>
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

        <template v-else-if="tab === 'compare'">
          <div class="compare-pane">
            <div class="compare-list">
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
                :data-slug="group.slug"
                :class="{ active: compareFocus?.slug === group.slug }"
                @click="openCompareSide(group)"
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
                  <div
                    v-for="asset in group.assets"
                    :key="asset.id"
                    class="compare-asset"
                    :class="{ active: compareFocus?.slug === group.slug && (sideLeftId === asset.id || sideRightId === asset.id) }"
                    @click.stop="previewAssetInCompare(group, asset)"
                  >
                    <div class="compare-asset-main">
                      <span class="soft-tag" :class="'tool-' + asset.toolId">{{ toolLabel(asset.toolId) }}</span>
                      <span class="compare-asset-path">{{ asset.relPath }}</span>
                    </div>
                    <el-button
                      size="small"
                      text
                      @click.stop="jumpToAsset(asset)"
                    >
                      资产列表打开
                    </el-button>
                  </div>
                </div>
              </div>
            </div>

            <div class="compare-side">
              <template v-if="compareFocus">
              <div class="compare-side-head">
                <div>
                  <div class="preview-title">{{ compareFocus.title }}</div>
                  <div class="preview-path">
                    {{
                      compareFocus.sameContent || compareFocus.matchType === 'identical'
                        ? '同内容'
                        : '内容不一致'
                    }}
                  </div>
                </div>
                <div class="preview-actions">
                  <el-button
                    v-if="sideLeft && scopeMode === 'global'"
                    size="small"
                    @click="openSyncDialog(sideLeft)"
                  >
                    以左侧为准同步…
                  </el-button>
                  <el-button
                    v-if="sideRight && scopeMode === 'global'"
                    size="small"
                    @click="openSyncDialog(sideRight)"
                  >
                    以右侧为准同步…
                  </el-button>
                  <el-button size="small" @click="closeCompareSide">关闭</el-button>
                </div>
              </div>
              <div class="side-by-side" v-loading="sideLoading">
                <div class="side-col">
                  <div class="side-col-head">
                    <el-select v-model="sideLeftId" size="small" style="width: 100%">
                      <el-option
                        v-for="a in (compareFocus?.assets || [])"
                        :key="a.id"
                        :label="`${toolLabel(a.toolId)} · ${a.relPath}`"
                        :value="a.id"
                      />
                    </el-select>
                  </div>
                  <pre class="side-pre">{{ sideLeftText }}</pre>
                </div>
                <div class="side-col">
                  <div class="side-col-head">
                    <el-select v-model="sideRightId" size="small" style="width: 100%">
                      <el-option
                        v-for="a in (compareFocus?.assets || [])"
                        :key="a.id"
                        :label="`${toolLabel(a.toolId)} · ${a.relPath}`"
                        :value="a.id"
                      />
                    </el-select>
                  </div>
                  <pre class="side-pre">{{ sideRightText }}</pre>
                </div>
              </div>
              </template>
              <div v-else class="preview-empty">
                选择左侧分组或文件后，在右侧进行并排对照
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="health-pane">
            <div class="health-list">
              <div class="health-summary">
                <button type="button" class="health-chip" @click="healthFilter = ''">
                  全部 {{ health?.issueCount || 0 }}
                </button>
                <button
                  type="button"
                  class="health-chip warn"
                  :class="{ active: healthFilter === 'drift' }"
                  @click="healthFilter = healthFilter === 'drift' ? '' : 'drift'"
                >
                  漂移 {{ health?.byType?.drift || 0 }}
                </button>
                <button
                  type="button"
                  class="health-chip"
                  :class="{ active: healthFilter === 'oversized' }"
                  @click="healthFilter = healthFilter === 'oversized' ? '' : 'oversized'"
                >
                  过大 {{ health?.byType?.oversized || 0 }}
                </button>
                <button
                  type="button"
                  class="health-chip"
                  :class="{ active: healthFilter === 'duplicate' }"
                  @click="healthFilter = healthFilter === 'duplicate' ? '' : 'duplicate'"
                >
                  重复 {{ health?.byType?.duplicate || 0 }}
                </button>
                <button
                  type="button"
                  class="health-chip"
                  :class="{ active: healthFilter === 'missing-entry' }"
                  @click="healthFilter = healthFilter === 'missing-entry' ? '' : 'missing-entry'"
                >
                  缺失入口 {{ health?.byType?.['missing-entry'] || 0 }}
                </button>
              </div>

              <div v-if="!loading && filteredHealthIssues.length === 0" class="empty-state">
                <div class="empty-title">暂无健康度问题</div>
                <div class="empty-desc">扫描后将检测过大、漂移、重复与缺失入口文件</div>
              </div>

              <div
                v-for="issue in filteredHealthIssues"
                :key="issue.id"
                class="health-card"
                :class="[issue.severity, { active: healthDetail?.issueId === issue.id }]"
                @click="openHealthDetail(issue)"
              >
                <div class="health-card-top">
                  <span class="soft-tag" :class="'health-' + issue.type">{{ healthTypeLabel(issue.type) }}</span>
                  <span class="health-title">{{ issue.title }}</span>
                </div>
                <div class="health-msg">{{ issue.message }}</div>
              </div>
            </div>

            <div v-if="healthDetail" class="health-detail">
              <div class="health-detail-head">
                <div>
                  <div class="preview-title">{{ healthDetail.title }}</div>
                  <div class="preview-path">{{ healthDetail.subtitle }}</div>
                </div>
                <div class="preview-actions">
                  <el-button
                    v-if="scopeMode === 'global' && healthDetail.mode === 'compare' && healthSideLeft"
                    size="small"
                    @click="openSyncDialog(healthSideLeft)"
                  >
                    以左侧为准同步…
                  </el-button>
                  <el-button
                    v-if="scopeMode === 'global' && healthDetail.mode === 'compare' && healthSideRight"
                    size="small"
                    @click="openSyncDialog(healthSideRight)"
                  >
                    以右侧为准同步…
                  </el-button>
                  <el-button
                    v-if="scopeMode === 'global' && healthDetail.mode === 'preview' && healthPreviewAsset"
                    size="small"
                    @click="openSyncDialog(healthPreviewAsset)"
                  >
                    同步到…
                  </el-button>
                  <el-button
                    v-if="healthDetail.mode === 'preview' && healthPreviewAsset"
                    size="small"
                    @click="openAssetByAbsPath(healthPreviewAsset.absPath)"
                  >
                    外部打开
                  </el-button>
                  <el-button size="small" @click="closeHealthDetail">关闭</el-button>
                </div>
              </div>

              <div v-if="healthDetail.mode === 'compare'" class="side-by-side" v-loading="healthDetailLoading">
                <div class="side-col">
                  <div class="side-col-head">
                    <el-select v-model="healthSideLeftId" size="small" style="width: 100%">
                      <el-option
                        v-for="a in healthDetail.assets"
                        :key="a.id"
                        :label="`${toolLabel(a.toolId)} · ${a.relPath}`"
                        :value="a.id"
                      />
                    </el-select>
                  </div>
                  <pre class="side-pre">{{ healthSideLeftText }}</pre>
                </div>
                <div class="side-col">
                  <div class="side-col-head">
                    <el-select v-model="healthSideRightId" size="small" style="width: 100%">
                      <el-option
                        v-for="a in healthDetail.assets"
                        :key="a.id"
                        :label="`${toolLabel(a.toolId)} · ${a.relPath}`"
                        :value="a.id"
                      />
                    </el-select>
                  </div>
                  <pre class="side-pre">{{ healthSideRightText }}</pre>
                </div>
              </div>

              <div v-else-if="healthDetail.mode === 'preview'" class="health-preview" v-loading="healthDetailLoading">
                <div v-if="healthDetail.assets.length > 1" class="side-col-head">
                  <el-select v-model="healthPreviewAssetId" size="small" style="width: 100%">
                    <el-option
                      v-for="a in healthDetail.assets"
                      :key="a.id"
                      :label="`${toolLabel(a.toolId)} · ${a.relPath}`"
                      :value="a.id"
                    />
                  </el-select>
                </div>
                <div v-else class="health-preview-meta">
                  {{ healthPreviewAsset ? `${toolLabel(healthPreviewAsset.toolId)} · ${healthPreviewAsset.relPath}` : '' }}
                </div>
                <pre class="side-pre">{{ healthPreviewText }}</pre>
              </div>

              <div v-else class="health-missing">
                <div class="empty-title">缺少入口文件</div>
                <div class="empty-desc">可在本页直接创建 AGENTS.md，无需跳转其他标签。</div>
                <el-button
                  v-if="scopeMode === 'global'"
                  type="primary"
                  @click="openCreateForMissingEntry()"
                >
                  创建 AGENTS.md
                </el-button>
                <div v-else class="empty-desc">项目模式下暂不支持创建全局入口，请切换到全局后再创建。</div>
              </div>
            </div>

            <div v-else class="health-detail health-detail-empty">
              选择左侧问题后，可在此直接预览、并排对照或同步，无需跳转其他标签
            </div>
          </div>
        </template>
      </div>
    </div>

    <el-dialog v-model="createVisible" title="新建规则资产" width="440px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="目标工具">
          <el-select v-model="createForm.toolId" style="width: 100%">
            <el-option
              v-for="t in createToolOptions"
              :key="t.toolId"
              :label="t.label"
              :value="t.toolId"
              :disabled="!t.detected"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="模板">
          <el-select v-model="createForm.template" style="width: 100%">
            <el-option label="AGENTS.md 精简版" value="agents" />
            <el-option label="SKILL.md 骨架" value="skill" />
            <el-option label="Cursor .mdc 骨架" value="mdc" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="createForm.template !== 'agents'" label="名称 / slug">
          <el-input v-model="createForm.slug" placeholder="例如 my-skill 或 team-conventions" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="syncVisible" title="同步到其他工具" width="460px" destroy-on-close>
      <div v-if="syncSource" class="sync-source">
        源：{{ toolLabel(syncSource.toolId) }} · {{ syncSource.relPath }}
      </div>
      <el-form label-position="top">
        <el-form-item label="目标工具">
          <el-checkbox-group v-model="syncTargets">
            <el-checkbox
              v-for="t in syncToolOptions"
              :key="t.toolId"
              :label="t.toolId"
              :disabled="!t.detected || t.toolId === syncSource?.toolId"
            >
              {{ t.label }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="syncOverwrite">覆盖已存在的目标文件</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="syncVisible = false">取消</el-button>
        <el-button type="primary" :loading="syncing" @click="submitSync">同步</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="healthSyncPickVisible"
      title="选择同步来源"
      width="520px"
      destroy-on-close
      :close-on-click-modal="false"
    >
      <div v-if="healthSyncPickAssets.length" class="sync-pick-list">
        <el-radio-group v-model="healthSyncPickSourceId">
          <div
            v-for="a in healthSyncPickAssets"
            :key="a.id"
            class="sync-pick-item"
          >
            <el-radio :label="a.id">
              {{ toolLabel(a.toolId) }} · {{ a.relPath }}
            </el-radio>
          </div>
        </el-radio-group>
      </div>
      <div v-else class="preview-empty" style="padding: 20px 0">
        未找到可同步的来源资产
      </div>
      <template #footer>
        <el-button @click="healthSyncPickVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!healthSyncPickSourceId"
          @click="confirmHealthSyncPick"
        >
          进入同步
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, toRaw } from 'vue'
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

type HealthIssueType = 'oversized' | 'drift' | 'duplicate' | 'missing-entry'

interface HealthIssue {
  id: string
  type: HealthIssueType
  severity: 'warn' | 'info'
  title: string
  message: string
  assetIds: string[]
  slug?: string
}

interface HealthReport {
  scannedAt?: number
  issueCount: number
  byType: Record<HealthIssueType, number>
  issues: HealthIssue[]
}

type TemplateId = 'agents' | 'skill' | 'mdc'
type TabId = 'list' | 'compare' | 'health'
type ScopeMode = 'global' | 'project'

const LIST_WIDTH = {
  MIN: 240,
  MAX: 520,
  DEFAULT: 300,
}

const loading = ref(false)
const previewLoading = ref(false)
const tools = ref<ToolSummary[]>([])
const assets = ref<RuleAsset[]>([])
const assetById = computed(() => new Map(assets.value.map((a) => [a.id, a])))
const compareGroups = ref<CompareGroup[]>([])
const health = ref<HealthReport | null>(null)
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
const tab = ref<TabId>('list')
const scopeMode = ref<ScopeMode>('global')
const projectRoot = ref<string | null>(null)
const healthFilter = ref<HealthIssueType | ''>('')
const listWidth = ref(LIST_WIDTH.DEFAULT)
const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)

const compareFocus = ref<CompareGroup | null>(null)
const sideLeftId = ref('')
const sideRightId = ref('')
const sideLeftText = ref('')
const sideRightText = ref('')
const sideLoading = ref(false)

const createVisible = ref(false)
const creating = ref(false)
const createForm = ref<{ toolId: ToolId; template: TemplateId; slug: string }>({
  toolId: 'cursor',
  template: 'agents',
  slug: '',
})

const syncVisible = ref(false)
const syncing = ref(false)
const syncSource = ref<RuleAsset | null>(null)
const syncTargets = ref<ToolId[]>([])
const syncOverwrite = ref(false)

const healthSyncPickVisible = ref(false)
const healthSyncPickAssets = ref<RuleAsset[]>([])
const healthSyncPickSourceId = ref<string>('')
const healthSyncPickIssue = ref<HealthIssue | null>(null)

interface HealthDetailState {
  issueId: string
  mode: 'compare' | 'preview' | 'missing'
  title: string
  subtitle: string
  assets: RuleAsset[]
}

const healthDetail = ref<HealthDetailState | null>(null)
const healthDetailLoading = ref(false)
const healthSideLeftId = ref('')
const healthSideRightId = ref('')
const healthSideLeftText = ref('')
const healthSideRightText = ref('')
const healthPreviewAssetId = ref('')
const healthPreviewText = ref('')

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
    workspace: '当前项目',
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

const healthTypeLabel = (t: HealthIssueType) => {
  const map: Record<HealthIssueType, string> = {
    oversized: '过大',
    drift: '漂移',
    duplicate: '重复',
    'missing-entry': '缺失',
  }
  return map[t]
}

const formatTime = (mtime: number) => {
  if (!mtime) return ''
  return new Date(mtime).toLocaleString()
}

const createToolOptions = computed(() =>
  tools.value.filter((t) => t.toolId !== 'workspace'),
)

const syncToolOptions = computed(() =>
  tools.value.filter((t) => t.toolId !== 'workspace'),
)

const sideLeft = computed(() =>
  compareFocus.value?.assets.find((a) => a.id === sideLeftId.value) || null,
)

const sideRight = computed(() =>
  compareFocus.value?.assets.find((a) => a.id === sideRightId.value) || null,
)

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

const filteredHealthIssues = computed(() => {
  let list = health.value?.issues || []

  if (healthFilter.value) {
    list = list.filter((i) => i.type === healthFilter.value)
  }

  if (filterTool.value) {
    const toolId = filterTool.value
    list = list.filter((issue) => {
      if (issue.type === 'missing-entry') {
        return issue.id === `missing:${toolId}` || issue.message.toLowerCase().includes(toolId)
      }
      return resolveHealthAssets(issue).some((a) => a.toolId === toolId)
    })
  }

  if (filterKind.value) {
    const kind = filterKind.value
    list = list.filter((issue) => {
      // 缺失入口没有具体资产类型；选了类型时不展示
      if (issue.type === 'missing-entry') return false
      return resolveHealthAssets(issue).some((a) => a.kind === kind)
    })
  }

  const q = keyword.value.trim().toLowerCase()
  if (q) {
    list = list.filter((issue) => {
      if (
        issue.title.toLowerCase().includes(q)
        || issue.message.toLowerCase().includes(q)
        || (issue.slug || '').toLowerCase().includes(q)
      ) {
        return true
      }
      return resolveHealthAssets(issue).some(
        (a) =>
          a.title.toLowerCase().includes(q)
          || a.relPath.toLowerCase().includes(q)
          || a.slug.toLowerCase().includes(q),
      )
    })
  }

  return list
})

const healthIssueAssets = (issue: HealthIssue) => resolveHealthAssets(issue)

/** 尽量从当前扫描结果解析出问题关联资产，避免 id 对不上时点击无响应 */
const resolveHealthAssets = (issue: HealthIssue): RuleAsset[] => {
  const ids = issue.assetIds || []
  const map = new Map<string, RuleAsset>()

  for (const id of ids) {
    const hit = assetById.value.get(id) || assets.value.find((a) => a.id === id)
    if (hit) map.set(hit.id, hit)
  }

  if (issue.slug) {
    for (const a of assets.value) {
      if (a.slug === issue.slug) map.set(a.id, a)
    }
    const group = compareGroups.value.find((g) => g.slug === issue.slug)
    if (group?.assets?.length) {
      for (const a of group.assets) map.set(a.id, a)
    }
  }

  // duplicate：若只靠 hash 关联，再按 id 列表保序
  if (map.size === 0 && ids.length) {
    for (const a of assets.value) {
      if (ids.includes(a.id)) map.set(a.id, a)
    }
  }

  const ordered: RuleAsset[] = []
  for (const id of ids) {
    const hit = map.get(id)
    if (hit && !ordered.some((x) => x.id === hit.id)) ordered.push(hit)
  }
  for (const hit of map.values()) {
    if (!ordered.some((x) => x.id === hit.id)) ordered.push(hit)
  }
  return ordered
}

const healthIssueFirstAsset = (issue: HealthIssue) => resolveHealthAssets(issue)[0] || null

const healthSideLeft = computed(() =>
  healthDetail.value?.assets.find((a) => a.id === healthSideLeftId.value) || null,
)

const healthSideRight = computed(() =>
  healthDetail.value?.assets.find((a) => a.id === healthSideRightId.value) || null,
)

const healthPreviewAsset = computed(() =>
  healthDetail.value?.assets.find((a) => a.id === healthPreviewAssetId.value) || null,
)

const openAssetByAbsPath = async (absPath?: string) => {
  if (!absPath) return
  try {
    await window.ipcRenderer.invoke('rules:open', absPath)
  } catch (error: any) {
    ElMessage.error('无法打开文件：' + (error?.message || '未知错误'))
  }
}

const closeHealthDetail = () => {
  healthDetail.value = null
  healthSideLeftId.value = ''
  healthSideRightId.value = ''
  healthSideLeftText.value = ''
  healthSideRightText.value = ''
  healthPreviewAssetId.value = ''
  healthPreviewText.value = ''
  healthDetailLoading.value = false
}

let healthContentSeq = 0

const loadHealthCompareContents = async () => {
  if (!healthDetail.value || healthDetail.value.mode !== 'compare') return
  const seq = ++healthContentSeq
  healthDetailLoading.value = true
  try {
    const left = healthDetail.value.assets.find((a) => a.id === healthSideLeftId.value)
    const right = healthDetail.value.assets.find((a) => a.id === healthSideRightId.value)
    const [l, r] = await Promise.all([
      left
        ? window.ipcRenderer.invoke('rules:read', left.absPath)
        : Promise.resolve({ content: '' }),
      right
        ? window.ipcRenderer.invoke('rules:read', right.absPath)
        : Promise.resolve({ content: '' }),
    ])
    if (seq !== healthContentSeq) return
    healthSideLeftText.value = l.content || ''
    healthSideRightText.value = r.content || ''
  } catch (error: any) {
    if (seq !== healthContentSeq) return
    ElMessage.error('加载对照内容失败：' + (error?.message || '未知错误'))
  } finally {
    if (seq === healthContentSeq) healthDetailLoading.value = false
  }
}

const loadHealthPreviewContent = async () => {
  if (!healthDetail.value || healthDetail.value.mode !== 'preview') return
  const seq = ++healthContentSeq
  const asset = healthDetail.value.assets.find((a) => a.id === healthPreviewAssetId.value)
  if (!asset) {
    healthPreviewText.value = ''
    return
  }
  healthDetailLoading.value = true
  try {
    const data = await window.ipcRenderer.invoke('rules:read', asset.absPath)
    if (seq !== healthContentSeq) return
    healthPreviewText.value = data.content || ''
  } catch (error: any) {
    if (seq !== healthContentSeq) return
    healthPreviewText.value = ''
    ElMessage.error('读取预览失败：' + (error?.message || '未知错误'))
  } finally {
    if (seq === healthContentSeq) healthDetailLoading.value = false
  }
}

const openHealthCompare = async (issue: HealthIssue) => {
  const list = resolveHealthAssets(issue)
  if (!list.length) {
    healthDetail.value = {
      issueId: issue.id,
      mode: 'preview',
      title: issue.title,
      subtitle: '未找到可对照的本地资产，请重新扫描后再试',
      assets: [],
    }
    healthPreviewAssetId.value = ''
    healthPreviewText.value = ''
    ElMessage.warning('未找到可对照的资产，请重新扫描')
    return
  }

  if (list.length < 2) {
    healthDetail.value = {
      issueId: issue.id,
      mode: 'preview',
      title: issue.title,
      subtitle: '仅找到 1 份关联资产，已就地预览',
      assets: list,
    }
    healthPreviewAssetId.value = list[0]?.id || ''
    await loadHealthPreviewContent()
    return
  }

  healthDetail.value = {
    issueId: issue.id,
    mode: 'compare',
    title: issue.title,
    subtitle: '就地并排对照（不离开健康度页）',
    assets: list,
  }
  // 先写入详情再改左右 id，避免 watch 读到空详情
  await nextTick()
  healthSideLeftId.value = list[0]?.id || ''
  healthSideRightId.value = list[1]?.id || list[0]?.id || ''
  await loadHealthCompareContents()
}

const openHealthPreview = async (issue: HealthIssue) => {
  const list = resolveHealthAssets(issue)
  if (!list.length) {
    healthDetail.value = {
      issueId: issue.id,
      mode: 'preview',
      title: issue.title,
      subtitle: '未找到对应资产，请重新扫描后再试',
      assets: [],
    }
    healthPreviewAssetId.value = ''
    healthPreviewText.value = ''
    ElMessage.warning('未找到对应资产，请重新扫描')
    return
  }
  healthDetail.value = {
    issueId: issue.id,
    mode: 'preview',
    title: issue.title,
    subtitle: '就地预览（不离开健康度页）',
    assets: list,
  }
  await nextTick()
  healthPreviewAssetId.value = list[0]?.id || ''
  await loadHealthPreviewContent()
}

const openHealthDetail = async (issue: HealthIssue) => {
  // 先标选中，避免“点了没反应”的感觉
  if (healthDetail.value?.issueId !== issue.id) {
    healthDetail.value = {
      issueId: issue.id,
      mode: issue.type === 'missing-entry' ? 'missing' : (issue.type === 'drift' || issue.type === 'duplicate' ? 'compare' : 'preview'),
      title: issue.title,
      subtitle: '加载中…',
      assets: healthDetail.value?.assets || [],
    }
  }

  if (issue.type === 'drift') {
    await openHealthCompare(issue)
    return
  }
  if (issue.type === 'duplicate') {
    await openHealthCompare(issue)
    return
  }
  if (issue.type === 'oversized') {
    await openHealthPreview(issue)
    return
  }
  if (issue.type === 'missing-entry') {
    healthDetail.value = {
      issueId: issue.id,
      mode: 'missing',
      title: issue.title,
      subtitle: issue.message,
      assets: [],
    }
  }
}

const openHealthIssueExternal = async (issue: HealthIssue) => {
  const asset = healthIssueFirstAsset(issue)
  if (!asset) {
    ElMessage.info('未找到对应资产，请重新扫描')
    return
  }
  await openAssetByAbsPath(asset.absPath)
}

const openCreateForMissingEntry = () => {
  createForm.value = {
    toolId: 'claude',
    template: 'agents',
    slug: '',
  }
  createVisible.value = true
}

const openHealthSyncPick = (issue: HealthIssue) => {
  if (scopeMode.value !== 'global') return
  const candidates = resolveHealthAssets(issue)
  if (!candidates.length) {
    ElMessage.info('未找到可同步的来源资产')
    return
  }
  healthSyncPickIssue.value = issue
  healthSyncPickAssets.value = candidates
  healthSyncPickSourceId.value = candidates[0]?.id || ''
  healthSyncPickVisible.value = true
}

const confirmHealthSyncPick = () => {
  const issue = healthSyncPickIssue.value
  if (!issue) {
    healthSyncPickVisible.value = false
    return
  }
  const src = assetById.value.get(healthSyncPickSourceId.value) || null
  if (!src) {
    ElMessage.error('未找到同步来源资产')
    return
  }

  // 开启同步弹窗
  openSyncDialog(src)

  // 期望目标：尽量限制到该健康问题涉及的其他工具（提升“一键可用性”）
  const desiredToolIds = Array.from(
    new Set(
      (issue.assetIds || [])
        .map((id) => assetById.value.get(id))
        .filter(Boolean)
        .map((a) => (a as RuleAsset).toolId),
    ),
  ).filter((tid) => tid !== src.toolId && tid !== 'workspace')
  if (desiredToolIds.length) syncTargets.value = desiredToolIds

  healthSyncPickVisible.value = false
}

const toggleToolFilter = (toolId: ToolId) => {
  filterTool.value = filterTool.value === toolId ? '' : toolId
}

const switchTab = async (next: TabId) => {
  if (tab.value === next) return
  if (next !== 'list' && !(await confirmDiscardIfDirty())) return
  if (next !== 'list') resetEditState()
  if (next !== 'compare') compareFocus.value = null
  if (next !== 'health') closeHealthDetail()
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

const loadHealth = async (nextTools: ToolSummary[], nextAssets: RuleAsset[]) => {
  try {
    // 避免把 Vue Proxy 经 IPC structuredClone
    health.value = await window.ipcRenderer.invoke('rules:health', {
      tools: nextTools.map((t) => ({ ...toRaw(t), counts: { ...toRaw(t).counts } })),
      assets: nextAssets.map((a) => ({ ...toRaw(a) })),
    })
  } catch (error: any) {
    console.error(error)
    health.value = null
  }
}

const applyScanResult = async (result: { tools?: ToolSummary[]; assets?: RuleAsset[] }) => {
  const nextAssets: RuleAsset[] = result.assets || []
  tools.value = result.tools || []
  assets.value = nextAssets
  compareGroups.value = compareAssets(nextAssets)
  await loadHealth(tools.value, nextAssets)

  if (compareFocus.value) {
    const refreshed = compareGroups.value.find((g) => g.slug === compareFocus.value?.slug)
    compareFocus.value = refreshed || null
  }

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
}

const refresh = async () => {
  if (!(await confirmDiscardIfDirty())) return
  loading.value = true
  try {
    if (scopeMode.value === 'project') {
      if (!projectRoot.value) {
        tools.value = []
        assets.value = []
        compareGroups.value = []
        health.value = null
        return
      }
      const result = await window.ipcRenderer.invoke('rules:scan-project', projectRoot.value)
      await applyScanResult(result)
    } else {
      const result = await window.ipcRenderer.invoke('rules:scan')
      await applyScanResult(result)
    }
  } catch (error: any) {
    console.error(error)
    ElMessage.error('扫描失败：' + (error?.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

const setScope = async (mode: ScopeMode) => {
  if (scopeMode.value === mode) return
  if (!(await confirmDiscardIfDirty())) return
  resetEditState()
  compareFocus.value = null
  closeHealthDetail()
  selected.value = null
  previewText.value = ''
  scopeMode.value = mode
  filterTool.value = ''
  await refresh()
}

const pickProject = async () => {
  if (!(await confirmDiscardIfDirty())) return
  try {
    const result = await window.ipcRenderer.invoke('rules:pick-project')
    if (result?.canceled) return
    projectRoot.value = result.projectRoot || null
    scopeMode.value = 'project'
    resetEditState()
    selected.value = null
    loading.value = true
    await applyScanResult(result)
  } catch (error: any) {
    ElMessage.error('打开项目失败：' + (error?.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

const clearProject = async () => {
  if (!(await confirmDiscardIfDirty())) return
  try {
    await window.ipcRenderer.invoke('rules:clear-project')
    projectRoot.value = null
    scopeMode.value = 'global'
    resetEditState()
    selected.value = null
    await refresh()
  } catch (error: any) {
    ElMessage.error(error?.message || '关闭项目失败')
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

const previewAssetInCompare = async (group: CompareGroup, asset: RuleAsset) => {
  compareFocus.value = group
  await nextTick()
  const other = group.assets.find((item) => item.id !== asset.id)
  sideLeftId.value = asset.id
  sideRightId.value = other?.id || asset.id
  await loadSideContents()
}

let compareContentSeq = 0

const openCompareSide = async (group: CompareGroup) => {
  if (!group?.assets?.length) {
    ElMessage.warning('该组没有可预览的资产')
    return
  }
  compareFocus.value = group
  await nextTick()
  sideLeftId.value = group.assets[0]?.id || ''
  sideRightId.value = group.assets[1]?.id || group.assets[0]?.id || ''
  await loadSideContents()
  await nextTick()
  try {
    const el = document.querySelector(`.compare-card[data-slug="${CSS.escape(group.slug)}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  } catch {
    // slug 含特殊字符时忽略滚动，不影响展示
  }
}

const closeCompareSide = () => {
  compareFocus.value = null
  sideLeftId.value = ''
  sideRightId.value = ''
  sideLeftText.value = ''
  sideRightText.value = ''
  sideLoading.value = false
}

const loadSideContents = async () => {
  if (!compareFocus.value) return
  const seq = ++compareContentSeq
  sideLoading.value = true
  try {
    const left = compareFocus.value.assets.find((a) => a.id === sideLeftId.value)
    const right = compareFocus.value.assets.find((a) => a.id === sideRightId.value)
    const [l, r] = await Promise.all([
      left
        ? window.ipcRenderer.invoke('rules:read', left.absPath)
        : Promise.resolve({ content: '' }),
      right
        ? window.ipcRenderer.invoke('rules:read', right.absPath)
        : Promise.resolve({ content: '' }),
    ])
    if (seq !== compareContentSeq) return
    sideLeftText.value = l.content || ''
    sideRightText.value = r.content || ''
  } catch (error: any) {
    if (seq !== compareContentSeq) return
    ElMessage.error('加载对照内容失败：' + (error?.message || '未知错误'))
  } finally {
    if (seq === compareContentSeq) sideLoading.value = false
  }
}

watch(filteredHealthIssues, (list) => {
  if (!healthDetail.value) return
  if (!list.some((i) => i.id === healthDetail.value?.issueId)) {
    closeHealthDetail()
  }
})

watch([sideLeftId, sideRightId], () => {
  if (compareFocus.value) loadSideContents()
})

watch([healthSideLeftId, healthSideRightId], () => {
  if (healthDetail.value?.mode === 'compare') loadHealthCompareContents()
})

watch(healthPreviewAssetId, () => {
  if (healthDetail.value?.mode === 'preview') loadHealthPreviewContent()
})

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
    compareGroups.value = compareAssets(assets.value)
    await loadHealth(tools.value, assets.value)
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

const openCreateDialog = () => {
  const first = createToolOptions.value.find((t) => t.detected)
  createForm.value = {
    toolId: first?.toolId || 'cursor',
    template: 'agents',
    slug: '',
  }
  createVisible.value = true
}

const submitCreate = async () => {
  if (createForm.value.template !== 'agents' && !createForm.value.slug.trim()) {
    ElMessage.warning('请填写名称 / slug')
    return
  }
  creating.value = true
  try {
    const asset = await window.ipcRenderer.invoke('rules:create', {
      toolId: createForm.value.toolId,
      template: createForm.value.template,
      slug: createForm.value.slug.trim() || undefined,
    })
    createVisible.value = false
    ElMessage.success('已创建')
    await refresh()
    // 健康度页创建后留在本页，避免又被拉去资产列表
    if (tab.value !== 'health' && asset?.id) {
      const found = assets.value.find((a) => a.id === asset.id)
      if (found) await jumpToAsset(found)
    } else if (tab.value === 'health') {
      closeHealthDetail()
    }
  } catch (error: any) {
    ElMessage.error('创建失败：' + (error?.message || '未知错误'))
  } finally {
    creating.value = false
  }
}

const openSyncDialog = (asset: RuleAsset) => {
  syncSource.value = asset
  syncTargets.value = syncToolOptions.value
    .filter((t) => t.detected && t.toolId !== asset.toolId)
    .map((t) => t.toolId)
  syncOverwrite.value = false
  syncVisible.value = true
}

const submitSync = async () => {
  if (!syncSource.value) return
  if (!syncTargets.value.length) {
    ElMessage.warning('请选择至少一个目标工具')
    return
  }
  if (syncOverwrite.value) {
    try {
      await ElMessageBox.confirm(
        '将覆盖目标工具中已存在的同名文件，确定继续？',
        '确认覆盖',
        { type: 'warning', confirmButtonText: '覆盖并同步', cancelButtonText: '取消' },
      )
    } catch {
      return
    }
  }
  syncing.value = true
  try {
    const src = syncSource.value
    const results = await window.ipcRenderer.invoke('rules:sync', {
      sourceAbsPath: src.absPath,
      sourceToolId: src.toolId,
      sourceKind: src.kind,
      sourceRelPath: src.relPath,
      sourceTitle: src.title,
      targetToolIds: syncTargets.value,
      overwrite: syncOverwrite.value,
    })
    const written = (results || []).filter((r: any) => !r.skipped).length
    const skipped = (results || []).filter((r: any) => r.skipped).length
    ElMessage.success(`同步完成：写入 ${written}，跳过 ${skipped}`)
    syncVisible.value = false
    await refresh()
  } catch (error: any) {
    ElMessage.error('同步失败：' + (error?.message || '未知错误'))
  } finally {
    syncing.value = false
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

onMounted(async () => {
  try {
    const proj = await window.ipcRenderer.invoke('rules:get-project')
    projectRoot.value = proj?.projectRoot || null
  } catch {
    projectRoot.value = null
  }
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
  max-width: 420px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.scope-switch {
  display: flex;
  gap: 4px;
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
  width: 200px;
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
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.chip.active {
  color: var(--cz-primary-hover);
  background: var(--cz-primary-soft);
  border-color: rgba(59, 130, 246, 0.18);
}

.chip-count {
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  border-radius: 999px;
  font-size: 10px;
  line-height: 16px;
  background: rgba(217, 119, 6, 0.18);
  color: #b45309;
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
.tool-workspace { color: #475569; background: rgba(100, 116, 139, 0.14); }

.match-identical { color: #16a34a; background: var(--cz-success-soft); }
.match-same-name { color: #d97706; background: var(--cz-warning-soft); }
.match-single { color: #64748b; background: rgba(148, 163, 184, 0.14); }

.health-oversized { color: #64748b; background: rgba(148, 163, 184, 0.14); }
.health-drift { color: #d97706; background: var(--cz-warning-soft); }
.health-duplicate { color: #2563eb; background: rgba(59, 130, 246, 0.1); }
.health-missing-entry { color: #dc2626; background: rgba(239, 68, 68, 0.1); }

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
  flex-wrap: wrap;
  justify-content: flex-end;
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
  overflow: hidden;
  padding: 12px 16px 20px;
  display: flex;
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
}

.compare-list {
  flex: 0 0 360px;
  max-width: 45%;
  min-width: 0;
  overflow: auto;
  padding-right: 2px;
}

.compare-side {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--cz-border);
  border-radius: 14px;
  background: var(--cz-surface);
  overflow: hidden;
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
  cursor: pointer;
  transition: border-color var(--cz-transition), box-shadow var(--cz-transition), background-color var(--cz-transition);
}

.compare-card.active {
  border-color: rgba(59, 130, 246, 0.55);
  background: rgba(59, 130, 246, 0.08);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
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
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--cz-border);
  background: var(--cz-surface);
  cursor: pointer;
}

.compare-asset:hover {
  border-color: var(--cz-border-strong);
}

.compare-asset.active {
  border-color: rgba(59, 130, 246, 0.45);
  background: var(--cz-primary-soft);
}

.compare-asset-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.compare-asset-path {
  min-width: 0;
  flex: 1;
  font-size: 12px;
  color: var(--cz-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.compare-card-actions {
  margin-top: 10px;
}

.compare-side {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--cz-border);
  border-radius: 14px;
  background: var(--cz-surface);
  overflow: hidden;
}

.compare-side-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--cz-border);
}

.side-by-side {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: minmax(0, 1fr);
  gap: 1px;
  background: var(--cz-border);
}

.side-col {
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--cz-surface-secondary);
}

.side-col-head {
  flex-shrink: 0;
  padding: 8px 10px;
  border-bottom: 1px solid var(--cz-border);
  background: var(--cz-surface);
}

.side-pre {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 12px;
  overflow: auto;
  overscroll-behavior: contain;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--cz-text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.health-pane {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
  padding: 12px 16px 20px;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.health-list {
  flex: 0 0 360px;
  max-width: 45%;
  min-width: 0;
  overflow: auto;
}

.health-detail {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--cz-border);
  border-radius: 14px;
  background: var(--cz-surface);
  overflow: hidden;
}

.health-detail-empty {
  align-items: center;
  justify-content: center;
  color: var(--cz-text-tertiary);
  font-size: 12px;
  padding: 24px;
  text-align: center;
}

.health-detail-head {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--cz-border);
}

.health-preview,
.health-missing {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.health-preview-meta {
  padding: 8px 10px;
  border-bottom: 1px solid var(--cz-border);
  font-size: 12px;
  color: var(--cz-text-tertiary);
}

.health-missing {
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
}

.health-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.health-chip {
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--cz-border);
  background: var(--cz-surface);
  color: var(--cz-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.health-chip.active,
.health-chip.warn.active {
  color: var(--cz-primary-hover);
  background: var(--cz-primary-soft);
  border-color: rgba(59, 130, 246, 0.18);
}

.health-chip.warn {
  color: #b45309;
}

.health-card {
  padding: 12px 14px;
  margin-bottom: 10px;
  border-radius: 14px;
  border: 1px solid var(--cz-border);
  background: var(--cz-surface-secondary);
  cursor: pointer;
  transition: border-color var(--cz-transition), background-color var(--cz-transition), box-shadow var(--cz-transition);
}

.health-card:hover {
  border-color: var(--cz-border-strong);
}

.health-card.active {
  border-color: rgba(59, 130, 246, 0.55);
  background: rgba(59, 130, 246, 0.08);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.health-card.warn {
  border-color: rgba(217, 119, 6, 0.35);
}

.health-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.health-title {
  font-size: 13px;
  font-weight: 650;
  color: var(--cz-text-primary);
}

.health-msg {
  font-size: 12px;
  color: var(--cz-text-tertiary);
}

.sync-pick-list {
  max-height: 320px;
  overflow: auto;
  padding-right: 6px;
}

.sync-pick-item {
  padding: 6px 0;
}

.sync-source {
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--cz-text-secondary);
  word-break: break-all;
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
  .asset-row,
  .health-card {
    transition: none;
  }
}
</style>
