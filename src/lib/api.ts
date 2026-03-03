import { loadAuth } from './storage'

type ApiError = { status: number; message: string; details?: unknown }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, token } = loadAuth()
  if (!baseUrl) throw { status: 0, message: 'BaseUrl não configurada.' } satisfies ApiError

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  const text = await res.text()
  const body = text ? safeJson(text) : null

  if (!res.ok) {
    const msg =
      (body && (body.message || body.error || body.title)) ||
      `Erro HTTP ${res.status}`
    throw { status: res.status, message: String(msg), details: body } satisfies ApiError
  }

  return body as T
}

function safeJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
