import { loadSession, saveSession } from '../lib/sessionStorage'
import {
  refreshSessionTokens,
  shouldAttemptAuthRefresh,
} from '../auth/session'
import { notifySessionInvalid, notifyTokensRefreshed } from '../auth/sessionBridge'

type ApiError = { status: number; message: string; details?: unknown }

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

async function request<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const session = loadSession()
  const baseUrl = normalizeBaseUrl(session.baseUrl || String(import.meta.env.VITE_API_BASE_URL ?? ''))
  if (!baseUrl) throw { status: 0, message: 'BaseUrl não configurada.' } satisfies ApiError

  const isForm = typeof FormData !== 'undefined' && init?.body instanceof FormData
  const hadBearer = Boolean(session.accessToken)

  const baseHeaders: Record<string, string> = {
    ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    ...(session.empresaId ? { 'X-Progem-ID': String(session.empresaId) } : {}),
    ...(session.deviceId ? { 'X-Device-ID': session.deviceId } : {}),
  }

  const contentHeaders: Record<string, string> = isForm ? {} : { 'Content-Type': 'application/json' }

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...contentHeaders,
      ...baseHeaders,
    },
  })

  if (
    retry &&
    shouldAttemptAuthRefresh(res.status, hadBearer, Boolean(session.refreshToken))
  ) {
    try {
      const refreshed = await refreshSessionTokens(session)
      saveSession({
        ...session,
        baseUrl,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
      })
      notifyTokensRefreshed(refreshed.accessToken, refreshed.refreshToken)
      return request<T>(path, init, false)
    } catch {
      notifySessionInvalid('session_expired')
      throw { status: 401, message: 'Sessão expirada. Faça login novamente.' } satisfies ApiError
    }
  }

  const text = await res.text()
  const body = text ? safeJson(text) : null

  if (!res.ok) {
    const msg = (body && (body.error || body.message || body.title)) || `Erro HTTP ${res.status}`
    throw { status: res.status, message: String(msg), details: body } satisfies ApiError
  }

  return body as T
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  patch: <T>(path: string, data?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),
  put: <T>(path: string, data?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  postForm: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', body: form }),
}
