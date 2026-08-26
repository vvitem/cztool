/**
 * CZTool unlock API — reads activation codes from EdgeKey `Card` table (shared D1),
 * binds one code to one device, issues 24h session tokens.
 */

import { issueToken, sessionTtlMs, verifyToken } from './token'

export interface Env {
  DB: D1Database
  TOKEN_SECRET: string
  /** Optional: only accept cards from this EdgeKey product id */
  CZTOOL_PRODUCT_ID?: string
}

interface CardRow {
  id: number
  content: string
  status: string
  productId: number
}

interface BindingRow {
  code: string
  card_id: number
  device_id: string
  token: string
  bound_at: number
  expires_at: number
}

const ALLOWED_CARD_STATUS = new Set(['SOLD', 'UNUSED'])

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase()
}

function mapCardError(status: string) {
  if (status === 'DISABLED') return '验证码已停用'
  if (status === 'LOCKED') return '验证码处理中，请稍后再试'
  return '验证码无效或尚未发放'
}

async function findCard(db: D1Database, code: string, productIdFilter?: string): Promise<CardRow | null> {
  const row = await db
    .prepare(
      `SELECT id, content, status, productId
       FROM Card
       WHERE UPPER(TRIM(content)) = ?
       LIMIT 1`,
    )
    .bind(code)
    .first<CardRow>()

  if (!row) return null
  if (productIdFilter && String(row.productId) !== productIdFilter) return null
  return row
}

async function getBinding(db: D1Database, code: string) {
  return db
    .prepare('SELECT * FROM cztool_unlock_binding WHERE code = ?')
    .bind(code)
    .first<BindingRow>()
}

async function upsertBinding(
  db: D1Database,
  data: { code: string; cardId: number; deviceId: string; token: string; expiresAt: number },
) {
  const now = Date.now()
  await db
    .prepare(
      `INSERT INTO cztool_unlock_binding (code, card_id, device_id, token, bound_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET
         device_id = excluded.device_id,
         token = excluded.token,
         expires_at = excluded.expires_at`,
    )
    .bind(data.code, data.cardId, data.deviceId, data.token, now, data.expiresAt)
    .run()
}

async function handleVerify(request: Request, env: Env) {
  const body = await request.json().catch(() => ({})) as {
    code?: string
    deviceId?: string
    appVersion?: string
  }

  const code = normalizeCode(String(body.code || ''))
  const deviceId = String(body.deviceId || '').trim()

  if (!code) return json({ error: '请输入验证码' }, 400)
  if (!deviceId) return json({ error: '设备标识无效' }, 400)

  const card = await findCard(env.DB, code, env.CZTOOL_PRODUCT_ID)
  if (!card) return json({ error: '验证码无效' }, 400)
  if (!ALLOWED_CARD_STATUS.has(card.status)) {
    return json({ error: mapCardError(card.status) }, 400)
  }

  const binding = await getBinding(env.DB, code)
  if (binding && binding.device_id !== deviceId) {
    return json({ error: '该验证码已被其他设备使用' }, 403)
  }

  const expiresAt = Date.now() + sessionTtlMs()
  const token = await issueToken(env.TOKEN_SECRET, { deviceId, code, expiresAt })

  await upsertBinding(env.DB, {
    code,
    cardId: card.id,
    deviceId,
    token,
    expiresAt,
  })

  return json({ ok: true, token, expiresAt })
}

async function handleRefresh(request: Request, env: Env) {
  const body = await request.json().catch(() => ({})) as {
    deviceId?: string
    token?: string
  }

  const deviceId = String(body.deviceId || '').trim()
  const token = String(body.token || '').trim()

  if (!deviceId || !token) return json({ error: '会话无效' }, 401)

  const parsed = await verifyToken(env.TOKEN_SECRET, token, deviceId)
  if (!parsed.ok) return json({ error: '会话已失效，请重新输入验证码' }, 401)

  const binding = await getBinding(env.DB, parsed.code)
  if (!binding || binding.device_id !== deviceId) {
    return json({ error: '会话已失效，请重新输入验证码' }, 401)
  }

  // Allow refresh within grace: binding existed; extend 24h from now
  const expiresAt = Date.now() + sessionTtlMs()
  const newToken = await issueToken(env.TOKEN_SECRET, {
    deviceId,
    code: parsed.code,
    expiresAt,
  })

  await upsertBinding(env.DB, {
    code: parsed.code,
    cardId: binding.card_id,
    deviceId,
    token: newToken,
    expiresAt,
  })

  return json({ ok: true, token: newToken, expiresAt })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return json({ ok: true })
    }

    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, service: 'cztool-unlock-api', edgekey: true })
    }

    if (request.method !== 'POST') {
      return json({ error: 'Not found' }, 404)
    }

    if (!env.TOKEN_SECRET) {
      return json({ error: '服务端未配置 TOKEN_SECRET' }, 500)
    }

    try {
      if (url.pathname === '/verify') return await handleVerify(request, env)
      if (url.pathname === '/refresh') return await handleRefresh(request, env)
      return json({ error: 'Not found' }, 404)
    } catch (error) {
      console.error(error)
      return json({ error: '服务器错误' }, 500)
    }
  },
}
