import { loadSession, saveSession } from '../lib/sessionStorage'

type ApiError = { status: number; message: string; details?: unknown }

let refreshPromise: Promise<{ accessToken: string; refreshToken?: string }> | null = null

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

async function doRefresh(
  baseUrl: string,
  deviceId: string,
  refreshToken: string
): Promise<{ accessToken: string; refreshToken?: string }> {
  const res = await fetch(`${baseUrl}/api/v1/app/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(deviceId ? { 'X-Device-ID': deviceId } : {}),
    },
    body: JSON.stringify({ refreshToken }),
  })

  const text = await res.text()
  const body = text ? safeJson(text) : null

  if (!res.ok) {
    const msg = (body && (body.message || body.error || body.title)) || `Erro HTTP ${res.status}`
    throw { status: res.status, message: String(msg), details: body } satisfies ApiError
  }

  const accessToken = String(body?.access_token ?? body?.accessToken ?? '').trim()
  const newRefreshToken = String(body?.refresh_token ?? body?.refreshToken ?? '').trim()
  if (!accessToken) {
    throw { status: 0, message: 'Refresh não retornou access_token.', details: body } satisfies ApiError
  }
  return { accessToken, refreshToken: newRefreshToken || undefined }
}

async function request<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const session = loadSession()
  const baseUrl = normalizeBaseUrl(session.baseUrl || String(import.meta.env.VITE_API_BASE_URL ?? ''))
  if (!baseUrl) throw { status: 0, message: 'BaseUrl não configurada.' } satisfies ApiError

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'Content-Type': 'application/json',
      ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(session.empresaId ? { 'X-Progem-ID': String(session.empresaId) } : {}),
      ...(session.deviceId ? { 'X-Device-ID': session.deviceId } : {}),
    },
  })

  // Tenta refresh automático uma vez em 401
  if (res.status === 401 && retry && session.refreshToken) {
    try {
      if (!refreshPromise) {
        refreshPromise = doRefresh(baseUrl, session.deviceId, session.refreshToken).finally(() => {
          refreshPromise = null
        })
      }
      const refreshed = await refreshPromise
      saveSession({
        ...session,
        baseUrl,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? session.refreshToken,
      })
      return request<T>(path, init, false)
    } catch (e) {
      // Se refresh falhar, segue para o tratamento padrão do 401
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
}
