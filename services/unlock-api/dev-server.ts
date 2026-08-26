/**
 * Local mock unlock API (in-memory EdgeKey Card + bindings).
 * Usage: TOKEN_SECRET=dev-secret npx tsx dev-server.ts
 * Test code: TEST-0001
 */

import { createServer } from 'node:http'
import { issueToken, sessionTtlMs, verifyToken } from './src/token.ts'

const PORT = Number(process.env.PORT || 8787)
const SECRET = process.env.TOKEN_SECRET || 'dev-secret'

type Card = { id: number; content: string; status: 'SOLD' | 'UNUSED' | 'DISABLED' }
const cards = new Map<string, Card>([
  ['TEST-0001', { id: 1, content: 'TEST-0001', status: 'SOLD' }],
])

type Binding = { cardId: number; deviceId: string; token: string; expiresAt: number }
const bindings = new Map<string, Binding>()

function json(res: import('node:http').ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

async function readBody(req: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch {
    return {}
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true, service: 'cztool-unlock-api-dev', edgekey: true })
  }

  if (req.method !== 'POST') {
    return json(res, 404, { error: 'Not found' })
  }

  const body = await readBody(req)
  const deviceId = String(body.deviceId || '').trim()

  if (url.pathname === '/verify') {
    const code = String(body.code || '').trim().toUpperCase()
    if (!code) return json(res, 400, { error: '请输入验证码' })
    if (!deviceId) return json(res, 400, { error: '设备标识无效' })

    const card = cards.get(code)
    if (!card || card.status === 'DISABLED') return json(res, 400, { error: '验证码无效' })

    const existing = bindings.get(code)
    if (existing && existing.deviceId !== deviceId) {
      return json(res, 403, { error: '该验证码已被其他设备使用' })
    }

    const expiresAt = Date.now() + sessionTtlMs()
    const token = await issueToken(SECRET, { deviceId, code, expiresAt })
    bindings.set(code, { cardId: card.id, deviceId, token, expiresAt })
    return json(res, 200, { ok: true, token, expiresAt })
  }

  if (url.pathname === '/refresh') {
    const token = String(body.token || '').trim()
    if (!deviceId || !token) return json(res, 401, { error: '会话已失效，请重新输入验证码' })

    const parsed = await verifyToken(SECRET, token, deviceId)
    if (!parsed.ok) return json(res, 401, { error: '会话已失效，请重新输入验证码' })

    const binding = bindings.get(parsed.code)
    if (!binding || binding.deviceId !== deviceId) {
      return json(res, 401, { error: '会话已失效，请重新输入验证码' })
    }

    const expiresAt = Date.now() + sessionTtlMs()
    const newToken = await issueToken(SECRET, { deviceId, code: parsed.code, expiresAt })
    bindings.set(parsed.code, { ...binding, token: newToken, expiresAt })
    return json(res, 200, { ok: true, token: newToken, expiresAt })
  }

  return json(res, 404, { error: 'Not found' })
})

server.listen(PORT, () => {
  console.log(`cztool unlock dev-server http://127.0.0.1:${PORT}`)
  console.log('Test code: TEST-0001')
})
