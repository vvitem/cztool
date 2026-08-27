<template>
  <div class="address-list">
    <div v-for="(row, idx) in items" :key="idx" class="address-card">
      <div class="card-top">
        <div class="avatar">{{ initials(row) }}</div>
        <div class="identity">
          <div class="name">{{ row.fullName || '—' }}</div>
          <div class="sub">
            <span v-if="row.gender" class="chip">{{ genderLabel(row.gender) }}</span>
            <span v-if="row.email" class="chip muted">{{ row.email }}</span>
          </div>
        </div>
        <el-button size="small" text type="primary" @click="copyText(row.fullAddress || '', '地址已复制')">
          复制地址
        </el-button>
      </div>

      <div class="addr-block" @click="copyText(row.fullAddress || '', '地址已复制')">
        {{ row.fullAddress || '—' }}
      </div>

      <div class="meta-grid">
        <div v-if="row.phone" class="meta-item">
          <span class="meta-label">电话</span>
          <span class="meta-value mono" @click="copyText(String(row.phone), '电话已复制')">{{ row.phone }}</span>
        </div>
        <div v-if="row.street" class="meta-item">
          <span class="meta-label">街道</span>
          <span class="meta-value">{{ row.street }}<template v-if="row.unit"> · {{ row.unit }}</template></span>
        </div>
        <div v-if="row.city || row.state || row.zipCode" class="meta-item">
          <span class="meta-label">城市</span>
          <span class="meta-value">
            {{ [row.city, row.state || row.stateName, row.zipCode].filter(Boolean).join(', ') }}
          </span>
        </div>
        <div v-if="row.country" class="meta-item">
          <span class="meta-label">国家</span>
          <span class="meta-value">{{ row.country }}</span>
        </div>
      </div>
    </div>

    <div v-if="!items.length" class="list-empty">暂无地址</div>
  </div>
</template>

<script setup lang="ts">
import { copyText } from '../utils/toolHelpers'

export interface AddressItem {
  fullName?: string
  firstName?: string
  lastName?: string
  gender?: string
  email?: string
  phone?: string
  street?: string
  unit?: string
  city?: string
  state?: string
  stateName?: string
  zipCode?: string
  country?: string
  fullAddress?: string
  [key: string]: unknown
}

defineProps<{
  items: AddressItem[]
}>()

const genderLabel = (g: string) => {
  if (g === 'male') return '男'
  if (g === 'female') return '女'
  return g
}

const initials = (row: AddressItem) => {
  const first = String(row.firstName || row.fullName || '?').trim()
  return first.slice(0, 1).toUpperCase()
}
</script>

<style scoped>
.address-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  max-height: 520px;
  overflow: auto;
  padding-right: 2px;
}

.address-card {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--cz-surface);
  border: 1px solid var(--cz-border);
}

.card-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #64748b;
  background: rgba(148, 163, 184, 0.16);
  border: 1px solid rgba(148, 163, 184, 0.2);
  flex-shrink: 0;
}

.identity {
  min-width: 0;
  flex: 1;
}

.name {
  font-size: 13px;
  font-weight: 650;
  color: var(--cz-text-primary);
  line-height: 1.3;
}

.sub {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  background: rgba(148, 163, 184, 0.14);
}

.chip.muted {
  font-weight: 500;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.addr-block {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--cz-surface-secondary);
  border: 1px solid var(--cz-border);
  font-size: 12px;
  line-height: 1.5;
  color: var(--cz-text-primary);
  cursor: pointer;
  word-break: break-word;
}

.addr-block:hover {
  border-color: var(--cz-border-strong);
}

.meta-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
}

.meta-item {
  min-width: 0;
}

.meta-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--cz-text-tertiary);
  margin-bottom: 2px;
}

.meta-value {
  font-size: 12px;
  color: var(--cz-text-secondary);
  word-break: break-word;
}

.meta-value.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  cursor: pointer;
}

.meta-value.mono:hover {
  color: var(--cz-primary-hover);
}

.list-empty {
  padding: 24px;
  text-align: center;
  font-size: 12px;
  color: var(--cz-text-tertiary);
}
</style>
