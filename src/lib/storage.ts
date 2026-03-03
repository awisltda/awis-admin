const KEY = 'awis_console_auth_v1'

export type StoredAuth = {
  baseUrl: string
  token: string
}

export function loadAuth(): StoredAuth {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { baseUrl: '', token: '' }
    const parsed = JSON.parse(raw) as Partial<StoredAuth>
    return {
      baseUrl: String(parsed.baseUrl ?? '').trim(),
      token: String(parsed.token ?? '').trim(),
    }
  } catch {
    return { baseUrl: '', token: '' }
  }
}

export function saveAuth(data: StoredAuth) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function clearAuth() {
  localStorage.removeItem(KEY)
}
