const SESSION_TTL_MS = 24 * 60 * 60 * 1000

export function sessionTtlMs() {
  return SESSION_TTL_MS
}

function toBase64Url(bytes: ArrayBuffer) {
  const bin = String.fromCharCode(...new Uint8Array(bytes))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const bin = atob(padded + pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function hmacSign(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return toBase64Url(sig)
}

export async function issueToken(
  secret: string,
  payload: { deviceId: string; code: string; expiresAt: number },
) {
  const body = JSON.stringify(payload)
  const encoded = toBase64Url(new TextEncoder().encode(body).buffer)
  const sig = await hmacSign(secret, encoded)
  return `${encoded}.${sig}`
}

export async function verifyToken(
  secret: string,
  token: string,
  deviceId: string,
): Promise<{ ok: true; code: string; expiresAt: number } | { ok: false }> {
  const [encoded, sig] = token.split('.')
  if (!encoded || !sig) return { ok: false }

  const expected = await hmacSign(secret, encoded)
  if (expected !== sig) return { ok: false }

  try {
    const json = new TextDecoder().decode(fromBase64Url(encoded))
    const payload = JSON.parse(json) as { deviceId?: string; code?: string; expiresAt?: number }
    if (payload.deviceId !== deviceId) return { ok: false }
    if (!payload.code || typeof payload.expiresAt !== 'number') return { ok: false }
    return { ok: true, code: payload.code, expiresAt: payload.expiresAt }
  } catch {
    return { ok: false }
  }
}
