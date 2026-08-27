<template>
  <div class="cz-history-detail">
    <div class="hd-meta">
      <span class="hd-pill" :class="'status-' + (record.status || 'info')">
        {{ historyStatusText(record.status) }}
      </span>
      <span class="hd-time">
        <el-icon><Clock /></el-icon>
        {{ formatHistoryTime(record.operationTime) }}
      </span>
    </div>

    <div class="hd-hero">
      <img
        v-if="content.avatar"
        :src="content.avatar"
        class="hd-avatar circle"
        alt="头像"
      />
      <div v-else class="hd-avatar circle" />
      <div>
        <div class="hd-hero-title">{{ content.nickname || '未获取到昵称' }}</div>
        <div class="hd-hero-sub">{{ content.qq || '—' }}</div>
      </div>
    </div>

    <div class="hd-card">
      <div class="hd-field" v-if="content.qq">
        <div class="hd-label">QQ 号</div>
        <div class="hd-chips">
          <span class="hd-chip">
            {{ content.qq }}
            <button type="button" @click="copyText(content.qq, 'QQ 号已复制')">
              <el-icon><CopyDocument /></el-icon>
            </button>
          </span>
        </div>
      </div>

      <div class="hd-field" v-if="content.phones.length">
        <div class="hd-label">手机号</div>
        <div class="hd-chips">
          <span v-for="phone in content.phones" :key="phone" class="hd-chip">
            {{ phone }}
            <button type="button" @click="copyText(phone, '手机号已复制')">
              <el-icon><CopyDocument /></el-icon>
            </button>
          </span>
        </div>
      </div>

      <div class="hd-field" v-else>
        <div class="hd-label">手机号</div>
        <div class="hd-value-row">
          <span class="hd-value-text" style="color: var(--cz-text-tertiary)">暂无关联号码</span>
        </div>
      </div>

      <div class="hd-field" v-if="content.phonediqu">
        <div class="hd-label">归属地</div>
        <div class="hd-value-row">
          <span class="hd-value-text">{{ content.phonediqu }}</span>
        </div>
      </div>
    </div>

    <div class="hd-card" v-if="content.lol">
      <div class="hd-section-title">英雄联盟</div>
      <div class="hd-field" v-if="content.lol.name">
        <div class="hd-label">名称</div>
        <div class="hd-value-row">
          <span class="hd-value-text">{{ content.lol.name }}</span>
          <el-button text type="primary" :icon="CopyDocument" @click="copyText(content.lol.name, '已复制')" />
        </div>
      </div>
      <div class="hd-field" v-if="content.lol.daqu">
        <div class="hd-label">大区</div>
        <div class="hd-value-row">
          <span class="hd-value-text">{{ content.lol.daqu }}</span>
        </div>
      </div>
    </div>

    <div class="hd-card" v-if="content.wb">
      <div class="hd-section-title">微博</div>
      <div class="hd-field">
        <div class="hd-label">ID</div>
        <div class="hd-value-row">
          <span class="hd-value-text mono">{{ content.wb.id }}</span>
          <el-button text type="primary" :icon="CopyDocument" @click="copyText(String(content.wb.id), '微博 ID 已复制')" />
        </div>
      </div>
      <div class="hd-actions" style="margin-top: 12px">
        <el-button type="primary" size="small" @click="openUrl(`https://weibo.com/u/${content.wb.id}`)">
          打开微博主页
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Clock, CopyDocument } from '@element-plus/icons-vue'
import type { HistoryRecord } from '../../types'
import { openExternal } from '../../api/desktop'
import { copyText, formatHistoryTime, historyStatusText } from '../../utils/toolHelpers'

const props = defineProps<{ record: HistoryRecord }>()

const content = computed(() => {
  try {
    const data = JSON.parse(props.record.content)
    const phones: string[] = Array.isArray(data.phones) && data.phones.length
      ? data.phones.map((item: unknown) => String(item)).filter(Boolean)
      : (data.phone ? [String(data.phone)] : [])
    return {
      qq: data.qq || '',
      nickname: data.nickname || '',
      avatar: data.avatar || '',
      phones,
      phonediqu: data.phonediqu || '',
      lol: data.lol || null,
      wb: data.wb
        ? { ...data.wb, id: String(data.wb.id).replace(/[^\d]/g, '') }
        : null,
    }
  } catch {
    return {
      qq: '',
      nickname: '',
      avatar: '',
      phones: [] as string[],
      phonediqu: '',
      lol: null as null | { name?: string; daqu?: string },
      wb: null as null | { id: string },
    }
  }
})

const openUrl = async (url: string) => {
  await openExternal(url)
}
</script>
