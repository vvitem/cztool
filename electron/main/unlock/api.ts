import fetch from 'node-fetch'
import { app } from 'electron'

const DEFAULT_API_URL = 'http://127.0.0.1:8787'
const REQUEST_TIMEOUT_MS = 15_000

function getApiBaseUrl(): string {
  return (
    process.env.CZTOOL_UNLOCK_API_URL
    || process.env.VITE_UNLOCK_API_URL
    || DEFAULT_API_URL
  ).replace(/\/$/, '')
}

export interface VerifyResult {
  ok: true
  token: string
  expiresAt: number
}

export interface ApiError {
  ok: false
  message: string
  status?: number
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T | ApiError> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const data = await response.json().catch(() => ({})) as Record<string, unknown>

    if (!response.ok) {
      const message = typeof data.error === 'string'
        ? data.error
        : mapStatusMessage(response.status)
      return { ok: false, message, status: response.status }
    }

    return data as T
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return { ok: false, message: '网络请求超时，请稍后重试' }
    }
    return { ok: false, message: '网络连接失败，请检查网络后重试' }
  } finally {
    clearTimeout(timer)
  }
}

function mapStatusMessage(status: number): string {
  if (status === 403) return '该验证码已被其他设备使用'
  if (status === 400) return '验证码无效'
  if (status === 401) return '会话已失效，请重新输入验证码'
  return '验证失败，请稍后重试'
}

export async function verifyCode(code: string, deviceId: string) {
  return postJson<VerifyResult>('/verify', {
    code: code.trim().toUpperCase(),
    deviceId,
    appVersion: app.getVersion(),
  })
}

export async function refreshSession(deviceId: string, token: string) {
  return postJson<VerifyResult>('/refresh', { deviceId, token })
}
