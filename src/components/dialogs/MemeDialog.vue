<template>
  <div class="cz-dialog-body meme-dialog">
    <section class="query-block">
      <div class="toolbar">
        <el-input v-model="keyword" placeholder="搜索名称" size="large" clearable />
        <el-button :loading="loadingTemplates" @click="loadTemplates">刷新</el-button>
      </div>
      <div v-if="filtered.length" class="template-grid">
        <button
          v-for="m in filtered"
          :key="m.id"
          type="button"
          class="tpl"
          :class="{ active: selectedId === m.id }"
          @click="selectedId = m.id"
        >
          <img :src="m.url" :alt="m.name" />
          <span>{{ m.name }}</span>
        </button>
      </div>
      <div v-else-if="!loadingTemplates" class="empty-hint">
        {{ templates.length ? '没有匹配的表情包' : '暂无数据' }}
      </div>
    </section>

    <section class="preview-stage">
      <div v-if="selected" class="result-card">
        <img :src="selected.url" :alt="selected.name" class="preview" />
        <div class="preview-name">{{ selected.name }}</div>
        <div class="action-row">
          <el-button type="primary" size="small" @click="copyText(selected.url)">复制图片链接</el-button>
          <el-button size="small" @click="openExternal(selected.url)">打开</el-button>
        </div>
      </div>
      <div v-else class="empty-card">
        <div class="empty-title">选择一张表情包</div>
        <div class="empty-desc">热门模板列表，点击即可预览</div>
      </div>
    </section>

    <p class="attribution">Source: Imgflip · https://imgflip.com</p>

    <div class="cz-dialog-footer">
      <el-button @click="$emit('close')">关闭</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { invoke, openExternal } from '../../api/desktop'
import { copyText, invokeErrorMessage } from '../../utils/toolHelpers'

interface MemeTpl {
  id: string
  name: string
  url: string
}

const templates = ref<MemeTpl[]>([])
const selectedId = ref('')
const keyword = ref('')
const loadingTemplates = ref(false)

const filtered = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return templates.value
  return templates.value.filter((m) => m.name.toLowerCase().includes(q))
})

const selected = computed(() => templates.value.find((m) => m.id === selectedId.value) || null)

const loadTemplates = async () => {
  loadingTemplates.value = true
  try {
    const data = await invoke<{ data?: { memes?: MemeTpl[] } }>('meme:get-templates')
    templates.value = (data?.data?.memes || []).map((m) => ({
      ...m,
      id: String(m.id),
    }))
    if (!selectedId.value && templates.value[0]) {
      selectedId.value = templates.value[0].id
    }
  } catch (error) {
    ElMessage.error(invokeErrorMessage(error, '加载失败'))
  } finally {
    loadingTemplates.value = false
  }
}

onMounted(() => {
  void loadTemplates()
})

defineEmits(['close'])
</script>

<style scoped>
.meme-dialog { max-height: min(82vh, 780px); }
.query-block { display: flex; flex-direction: column; gap: 8px; }
.toolbar { display: flex; align-items: center; gap: 10px; }
.toolbar .el-input { flex: 1; }
.template-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  max-height: 240px; overflow: auto; padding: 4px;
}
.tpl {
  border: 1px solid var(--cz-border); border-radius: 8px; background: var(--cz-surface);
  padding: 4px; cursor: pointer; text-align: center;
}
.tpl.active { border-color: var(--cz-primary); box-shadow: 0 0 0 2px var(--cz-primary-soft); }
.tpl img { width: 100%; height: 64px; object-fit: cover; border-radius: 4px; display: block; }
.tpl span {
  display: block; margin-top: 4px; font-size: 10px; color: var(--cz-text-tertiary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.empty-hint {
  min-height: 80px; display: flex; align-items: center; justify-content: center;
  font-size: 13px; color: var(--cz-text-tertiary);
}
.preview-stage { min-height: 160px; }
.result-card, .empty-card {
  padding: 12px; border-radius: var(--cz-radius-sm); border: 1px solid var(--cz-border);
  background: var(--cz-surface-secondary);
}
.empty-card { min-height: 140px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center; }
.empty-title { font-size: 14px; font-weight: 600; }
.empty-desc { font-size: 12px; color: var(--cz-text-tertiary); }
.preview { max-width: 100%; max-height: 220px; display: block; margin: 0 auto; border-radius: 8px; }
.preview-name { margin-top: 8px; text-align: center; font-size: 13px; font-weight: 600; }
.action-row { margin-top: 10px; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
.attribution { margin: 10px 0 0; font-size: 11px; color: var(--cz-text-tertiary); }
</style>
