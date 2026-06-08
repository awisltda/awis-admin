import { endpoints } from '../api/endpoints'
import { loadSession, type StoredSession } from '../lib/sessionStorage'
import { decodeJwt, isExpired } from './jwt'

export type RefreshResult = { accessToken: string; refreshToken: string }

let refreshPromise: Promise<RefreshResult> | null = null

export function tokenExpirySkewSec(): number {
  const raw = import.meta.env.VITE_TOKEN_EXPIRY_SKEW_SEC
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 60
}

export function hasSession(session: StoredSession): boolean {
  return Boolean(session.refreshToken?.trim())
}

export function isAccessValid(accessToken: string): boolean {
  const token = String(accessToken ?? '').trim()
  if (!token) return false
  return !isExpired(decodeJwt(token), tokenExpirySkewSec())
}

export function needsAccessRefresh(session: StoredSession): boolean {
  return hasSession(session) && !isAccessValid(session.accessToken)
}

function normalizeBaseUrl(url: string) {
  return String(url ?? '').trim().replace(/\/+$/, '')
}

function safeJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

async function doRefresh(baseUrl: string, deviceId: string, refreshToken: string): Promise<RefreshResult> {
  const res = await fetch(`${baseUrl}${endpoints.authRefresh()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(deviceId ? { 'X-Device-ID': deviceId } : {}),
    },
    body: JSON.stringify({ refreshToken, deviceId: deviceId || undefined }),
  })

  const text = await res.text()
  const body = text ? safeJson(text) : null

  if (!res.ok) {
    const msg = (body && (body.message || body.error || body.title)) || `Erro HTTP ${res.status}`
    throw new Error(String(msg))
  }

  const accessToken = String(body?.access_token ?? body?.accessToken ?? '').trim()
  const newRefreshToken = String(body?.refresh_token ?? body?.refreshToken ?? refreshToken).trim()
  if (!accessToken) throw new Error('Refresh não retornou access_token.')

  return { accessToken, refreshToken: newRefreshToken }
}

/** Renova tokens com deduplicação global (uma chamada por vez). */
export async function refreshSessionTokens(session?: StoredSession): Promise<RefreshResult> {
  const current = session ?? loadSession()
  const baseUrl = normalizeBaseUrl(current.baseUrl || String(import.meta.env.VITE_API_BASE_URL ?? ''))
  if (!baseUrl) throw new Error('BaseUrl não configurada.')
  if (!current.refreshToken) throw new Error('Refresh token ausente.')

  if (!refreshPromise) {
    refreshPromise = doRefresh(baseUrl, current.deviceId, current.refreshToken).finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export function shouldAttemptAuthRefresh(status: number, hadBearer: boolean, hasRefresh: boolean): boolean {
  if (!hadBearer || !hasRefresh) return false
  return status === 401 || status === 403
}
