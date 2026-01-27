const KEY = 'awis_console_session_v1'

export type StoredSession = {
  baseUrl: string
  empresaId: number
  deviceId: string
  accessToken: string
  refreshToken: string
}

const EMPTY: StoredSession = {
  baseUrl: '',
  empresaId: 128,
  deviceId: '',
  accessToken: '',
  refreshToken: '',
}

export function loadSession(): StoredSession {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw) as Partial<StoredSession>
    return {
      baseUrl: String(parsed.baseUrl ?? '').trim().replace(/\/+$/, ''),
      empresaId: Number(parsed.empresaId ?? EMPTY.empresaId) || EMPTY.empresaId,
      deviceId: String(parsed.deviceId ?? '').trim(),
      accessToken: String(parsed.accessToken ?? '').trim(),
      refreshToken: String(parsed.refreshToken ?? '').trim(),
    }
  } catch {
    return { ...EMPTY }
  }
}

export function saveSession(data: StoredSession) {
  const v: StoredSession = {
    baseUrl: String(data.baseUrl ?? '').trim().replace(/\/+$/, ''),
    empresaId: Number(data.empresaId ?? EMPTY.empresaId) || EMPTY.empresaId,
    deviceId: String(data.deviceId ?? '').trim(),
    accessToken: String(data.accessToken ?? '').trim().replace(/^Bearer\s+/i, ''),
    refreshToken: String(data.refreshToken ?? '').trim(),
  }
  localStorage.setItem(KEY, JSON.stringify(v))
}

export function clearSession() {
  localStorage.removeItem(KEY)
}
