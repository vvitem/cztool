import { ElMessage } from 'element-plus'

export function invokeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message?: unknown }).message || '')
    if (msg) return msg
  }
  return fallback
}

export function copyText(text: string, successTip = '已复制'): void {
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success(successTip)
  } catch {
    ElMessage.error('复制失败')
  }
}

export function formatHistoryTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

export function historyStatusText(status: string): string {
  if (status === 'success') return '成功'
  if (status === 'error') return '失败'
  if (status === 'running') return '进行中'
  return '未知'
}
