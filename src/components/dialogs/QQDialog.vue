<template>
  <el-form class="qq-dialog" label-position="top">
    <el-form-item label="请输入QQ号或手机号">
      <el-input
        v-model="searchInput"
        placeholder="请输入QQ号或手机号"
        @keydown.enter.prevent="handleSubmit"
        @keydown.esc.prevent="$emit('close')"
        clearable
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </el-form-item>

    <div class="tip-message">
      <el-alert
        title="声明：本工具仅供学习交流使用"
        type="info"
        :closable="false"
      />
    </div>

    <div class="result-container">
      <div class="result" v-if="result">
        <el-descriptions :column="1" border>
          <el-descriptions-item class="qq-info-item">
            <template #label>
              <div class="info-label">基本信息</div>
            </template>
            <div class="basic-info">
              <div class="avatar-section">
                <img v-if="result.avatar" :src="result.avatar" class="qq-avatar" alt="QQ头像" />
                <div class="qq-details">
                  <div class="qq-number" v-if="result.qq">QQ：{{ result.qq }}</div>
                  <div class="qq-nickname" v-if="result.nickname">昵称：{{ result.nickname }}</div>
                  <div class="qq-location" v-if="result.phonediqu">归属地：{{ result.phonediqu }}</div>
                  <div class="qq-phone" v-if="result.phone">手机号：{{ result.phone }}</div>
                </div>
              </div>
            </div>
          </el-descriptions-item>

          <el-descriptions-item v-if="result.lol && (result.lol.name || result.lol.daqu)">
            <template #label>
              <div class="info-label">英雄联盟信息</div>
            </template>
            <div class="lol-info">
              <div class="lol-content">
                <el-row :gutter="10" class="lol-row" v-if="result.lol.name">
                  <el-col :span="6">
                    <span class="label">名称</span>
                  </el-col>
                  <el-col :span="18">
                    <span class="value lol-name">{{ result.lol.name }}</span>
                  </el-col>
                </el-row>
                <el-row :gutter="10" class="lol-row" v-if="result.lol.daqu">
                  <el-col :span="6">
                    <span class="label">大区</span>
                  </el-col>
                  <el-col :span="18">
                    <span class="value lol-area">{{ result.lol.daqu }}</span>
                  </el-col>
                </el-row>
              </div>
            </div>
          </el-descriptions-item>

          <el-descriptions-item v-if="result.wb">
            <template #label>
              <div class="info-label">微博信息</div>
            </template>
            <div class="weibo-info">
              <div class="weibo-content">
                <el-row :gutter="10" class="weibo-row">
                  <el-col :span="6">
                    <span class="label">ID</span>
                  </el-col>
                  <el-col :span="18">
                    <span class="value weibo-id">{{ result.wb.id }}</span>
                  </el-col>
                </el-row>
                <el-row :gutter="10" class="weibo-row">
                  <el-col :span="6">
                    <span class="label">主页</span>
                  </el-col>
                  <el-col :span="18">
                    <a :href="result.wb.url" target="_blank" class="weibo-link">
                      <el-button type="primary" size="small" class="weibo-button">
                        <el-icon class="weibo-icon"><Link /></el-icon>
                        访问主页
                      </el-button>
                    </a>
                  </el-col>
                </el-row>
              </div>
            </div>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </div>

    <div class="button-group">
      <el-button @click="$emit('close')">关闭</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        {{ loading ? '查询中...' : '查询' }}
      </el-button>
    </div>
  </el-form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Link } from '@element-plus/icons-vue'

interface QQResult {
  qq?: string
  nickname?: string
  avatar?: string
  phone?: string
  phonediqu?: string
  lol?: {
    name?: string
    daqu?: string
    level?: string
    rank?: string
    win_rate?: string
    hero?: string
  }
  wb?: {
    id: string
    url: string
    displayUrl: string
  }
}

const searchInput = ref('')
const loading = ref(false)
const result = ref<QQResult | null>(null)

const getWeiboProfileUrl = (weiboId: string) => {
  return `https://weibo.com/u/${weiboId}`
}

const getNickname = async (qq: string): Promise<string | undefined> => {
  try {
    const response = await window.ipcRenderer.invoke('fetch-qq-nickname', qq);
    if (response && response.code === 200) {
      return response.qqnicheng;
    }
    return undefined;
  } catch (error) {
    console.error('QQ昵称查询失败:', error);
    return undefined;
  }
};

const queryByQQ = async (qq: string) => {
  const [qqPromise, lolPromise] = [
    fetch(`https://api.xywlapi.cc/qqapi?qq=${qq}`).then(r => r.json()),
    fetch(`https://api.xywlapi.cc/qqlol?qq=${qq}`).then(r => r.json())
  ]

  // 单独处理昵称查询
  const nickname = await getNickname(qq);

  const [qqData, lolData] = await Promise.all([qqPromise, lolPromise])
  
  if (qqData.status !== 200) {
    throw new Error(qqData.message || 'QQ查询失败')
  }

  const finalResult: QQResult = {
    ...qqData,
    nickname,
    avatar: `http://q1.qlogo.cn/g?b=qq&nk=${qq}&s=100&t=${Date.now()}`
  }

  if (lolData.status === 200) {
    finalResult.lol = {
      name: lolData.name,
      daqu: lolData.daqu,
      level: lolData.level,
      rank: lolData.rank,
      win_rate: lolData.win_rate,
      hero: lolData.hero
    }
  }

  return finalResult
}

const handleSubmit = async () => {
  if (!searchInput.value.trim()) {
    ElMessage.error('请输入QQ号或手机号')
    return
  }

  loading.value = true
  result.value = null
  
  try {
    let finalResult: QQResult

    try {
      // 先尝试QQ查询
      finalResult = await queryByQQ(searchInput.value)
    } catch (error) {
      // QQ查询失败，尝试手机号查询
      const phoneResponse = await fetch(`https://api.xywlapi.cc/qqphone?phone=${searchInput.value}`)
      const phoneData = await phoneResponse.json()
      
      if (phoneData.status !== 200) {
        throw new Error('未找到相关信息')
      }

      // 用查到的QQ继续查询详细信息
      finalResult = await queryByQQ(phoneData.qq)
    }

    // 查询微博信息
    if (finalResult.phone) {
      try {
        const weiboResponse = await fetch(`https://api.xywlapi.cc/wbphone?phone=${finalResult.phone}`)
        const weiboData = await weiboResponse.json()
        
        if (weiboData.status === 200 && weiboData.id) {
          const weiboProfileUrl = getWeiboProfileUrl(weiboData.id)
          finalResult.wb = {
            id: `ID: ${weiboData.id}`,
            url: weiboProfileUrl,
            displayUrl: weiboProfileUrl
          }
        }
      } catch (error) {
        console.error('微博查询失败:', error)
      }
    }

    result.value = finalResult

    // 添加历史记录
    try {
      await window.ipcRenderer.invoke('history:add', {
        moduleName: 'QQ查询',
        appName: 'QQ',
        content: JSON.stringify({
          qq: finalResult.qq,
          nickname: finalResult.nickname,
          avatar: finalResult.avatar,
          phonediqu: finalResult.phonediqu,
          phone: finalResult.phone,
          lol: finalResult.lol ? {
            name: finalResult.lol.name,
            daqu: finalResult.lol.daqu
          } : null,
          wb: finalResult.wb ? {
            id: finalResult.wb.id,
            url: finalResult.wb.url
          } : null
        }),
        status: 'success',
        contentType: 'qq-query'
      })
    } catch (error) {
      console.error('添加历史记录失败:', error)
    }
  } catch (error) {
    console.error('Error:', error)
    ElMessage.error(error instanceof Error ? error.message : '查询失败，请稍后重试')

    // 添加失败记录
    try {
      await window.ipcRenderer.invoke('history:add', {
        moduleName: 'QQ查询',
        appName: 'QQ',
        content: `查询失败: ${searchInput.value} (${error instanceof Error ? error.message : '未知错误'})`,
        status: 'error'
      })
    } catch (historyError) {
      console.error('添加历史记录失败:', historyError)
    }
  } finally {
    loading.value = false
  }
}

defineEmits(['close'])
</script>

<style scoped>
.qq-dialog {
  padding: 20px;
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 80vh;
}

.result-container {
  flex: 1;
  overflow-y: auto;
  margin: 15px 0;
}

.info-label {
  font-weight: 600;
  color: #409EFF;
  font-size: 16px;
}

.basic-info {
  padding: 10px;
}

.avatar-section {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

.qq-avatar {
  width: 100px;
  height: 100px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  border: 2px solid #fff;
  transition: transform 0.3s ease;
}

.qq-avatar:hover {
  transform: scale(1.02);
}

.qq-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 5px 0;
}

.qq-number, .qq-nickname, .qq-location, .qq-phone {
  font-size: 14px;
  line-height: 1.5;
  color: #606266;
}

.lol-info, .weibo-info {
  padding: 15px;
}

.lol-content {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
}

.lol-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.lol-row:last-child {
  margin-bottom: 0;
}

.lol-name, .lol-area {
  background-color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
}

.info-item {
  margin-bottom: 10px;
  line-height: 1.5;
}

.label {
  color: #909399;
  margin-right: 8px;
  font-size: 14px;
}

.value {
  color: #606266;
  font-size: 14px;
}

.weibo-link {
  color: #409EFF;
  text-decoration: none;
  transition: color 0.3s ease;
}

.weibo-link:hover {
  color: #66b1ff;
  text-decoration: underline;
}

.tip-message {
  margin-bottom: 15px;
}

.button-group {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 15px;
}

:deep(.el-descriptions__cell) {
  padding: 12px 20px;
}

:deep(.el-descriptions__label) {
  width: 120px;
  text-align: center;
  background-color: #f5f7fa;
}

.weibo-info {
  padding: 15px;
}

.weibo-content {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
}

.weibo-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.weibo-row:last-child {
  margin-bottom: 0;
}

.weibo-id {
  font-family: 'Courier New', monospace;
  background-color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
}

.weibo-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: all 0.3s ease;
}

.weibo-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
}

.weibo-icon {
  font-size: 14px;
}
</style>
