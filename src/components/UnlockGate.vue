<template>
  <div class="unlock-gate">
    <WindowControls position="overlay" />

    <div class="unlock-card">
      <div class="unlock-brand">
        <div class="brand-mark">CZ</div>
        <div>
          <div class="brand-name">CZTool</div>
          <div class="brand-sub">请输入激活码解锁</div>
        </div>
      </div>

      <el-input
        v-model="code"
        class="unlock-input"
        placeholder="激活码 / 卡密"
        size="large"
        clearable
        :disabled="loading"
        @keyup.enter="submit"
      />

      <el-button
        type="primary"
        size="large"
        class="unlock-btn"
        :loading="loading"
        @click="submit"
      >
        解锁
      </el-button>

      <p v-if="error" class="unlock-error">{{ error }}</p>

      <div class="unlock-foot">
        <span class="device-label">设备 ID</span>
        <code class="device-id" :title="deviceId">{{ shortDeviceId }}</code>
        <el-button text size="small" @click="copyDeviceId">复制</el-button>
      </div>
      <p class="unlock-hint">
        激活码可在
        <a
          class="unlock-shop-link"
          :href="shopUrl"
          target="_blank"
          rel="noopener noreferrer"
          @click.prevent="openShop"
        >EdgeKey 商城</a>
        购买；一码仅可绑定一台设备，验证通过后 24 小时内免输。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import WindowControls from './WindowControls.vue'

const emit = defineEmits<{ unlocked: [] }>()

const code = ref('')
const loading = ref(false)
const error = ref('')
const deviceId = ref('')

const shopUrl = (
  (import.meta as any).env?.VITE_EDGEKEY_SHOP_URL
  || 'https://czt.oihome.dpdns.org/'
).replace(/\/?$/, '/')

const shortDeviceId = computed(() => {
  if (!deviceId.value) return '—'
  return `${deviceId.value.slice(0, 8)}…${deviceId.value.slice(-6)}`
})

onMounted(async () => {
  try {
    deviceId.value = await window.ipcRenderer.invoke('unlock:get-device-id')
  } catch {
    // ignore
  }
})

const openShop = async () => {
  try {
    await window.ipcRenderer.invoke('unlock:open-external', shopUrl)
  } catch {
    window.open(shopUrl, '_blank')
  }
}

const copyDeviceId = async () => {
  if (!deviceId.value) return
  try {
    await navigator.clipboard.writeText(deviceId.value)
    ElMessage.success('已复制设备 ID')
  } catch {
    ElMessage.error('复制失败')
  }
}

const submit = async () => {
  if (loading.value) return
  error.value = ''
  loading.value = true
  try {
    const result = await window.ipcRenderer.invoke('unlock:verify', code.value)
    if (result?.ok) {
      emit('unlocked')
      return
    }
    error.value = result?.message || '验证失败'
  } catch (e: any) {
    error.value = e?.message || '验证失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.unlock-gate {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    linear-gradient(160deg, rgba(239, 246, 255, 0.98), rgba(248, 250, 252, 0.98)),
    var(--cz-bg, #f8fafc);
  -webkit-app-region: drag;
}

.unlock-card {
  width: min(400px, calc(100vw - 48px));
  padding: 32px 28px 24px;
  border-radius: var(--cz-radius-card, 16px);
  background: var(--cz-surface, #fff);
  border: 1px solid var(--cz-border, #e2e8f0);
  box-shadow: var(--cz-shadow-sm, 0 4px 24px rgba(15, 23, 42, 0.08));
  -webkit-app-region: no-drag;
}

.unlock-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.brand-mark {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--cz-primary, #3b82f6), var(--cz-primary-hover, #2563eb));
}

.brand-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--cz-text-primary, #0f172a);
}

.brand-sub {
  font-size: 13px;
  color: var(--cz-text-tertiary, #94a3b8);
  margin-top: 2px;
}

.unlock-input {
  margin-bottom: 12px;
}

.unlock-btn {
  width: 100%;
}

.unlock-error {
  margin: 12px 0 0;
  font-size: 13px;
  color: #dc2626;
  text-align: center;
}

.unlock-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--cz-border, #e2e8f0);
  flex-wrap: wrap;
}

.device-label {
  font-size: 11px;
  color: var(--cz-text-tertiary, #94a3b8);
}

.device-id {
  font-size: 11px;
  color: var(--cz-text-secondary, #64748b);
  background: var(--cz-surface-tertiary, #f1f5f9);
  padding: 2px 6px;
  border-radius: 4px;
}

.unlock-hint {
  margin: 12px 0 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--cz-text-tertiary, #94a3b8);
}

.unlock-shop-link {
  color: var(--cz-primary-hover, #2563eb);
  text-decoration: none;
  font-weight: 600;
}

.unlock-shop-link:hover {
  text-decoration: underline;
}
</style>
