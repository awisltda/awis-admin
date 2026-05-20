import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { endpoints } from '../api/endpoints'
import { decodeJwt, type JwtPayload } from './jwt'
import { loadSession, saveSession, type StoredSession } from '../lib/sessionStorage'
import { hasSession, isAccessValid, needsAccessRefresh, refreshSessionTokens } from './session'
import { registerSessionBridge } from './sessionBridge'

type AuthState = {
  baseUrl: string
  empresaId: number
  deviceId: string
  accessToken: string
  refreshToken: string
  payload: JwtPayload | null
  isAuthed: boolean
  sessionReady: boolean
  isBootstrapping: boolean
}

type AuthApi = AuthState & {
  setBaseUrl: (baseUrl: string) => void
  setEmpresaId: (empresaId: number) => void
  setDeviceId: (deviceId: string) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  login: (session: StoredSession) => void
  logout: () => Promise<void>
}

const Ctx = createContext<AuthApi | null>(null)

function normalizeBaseUrl(url: string) {
  return String(url ?? '').trim().replace(/\/+$/, '')
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StoredSession>(() => loadSession())
  const [sessionReady, setSessionReady] = useState(false)
  const [isBootstrapping, setIsBootstrapping] = useState(false)

  const payload = useMemo(
    () => (session.accessToken ? decodeJwt(session.accessToken) : null),
    [session.accessToken]
  )

  const accessValid = isAccessValid(session.accessToken)
  const sessionExists = hasSession(session)
  const isAuthed = sessionExists && (accessValid || isBootstrapping)

  const commit = useCallback((next: StoredSession) => {
    saveSession(next)
    setSession(next)
  }, [])

  const setTokens = useCallback((accessToken: string, refreshToken: string) => {
    setSession((prev) => {
      const next = { ...prev, accessToken, refreshToken }
      saveSession(next)
      return next
    })
  }, [])

  const clearTokensLocal = useCallback(() => {
    const current = loadSession()
    const next: StoredSession = {
      baseUrl: current.baseUrl,
      empresaId: current.empresaId,
      deviceId: current.deviceId,
      accessToken: '',
      refreshToken: '',
    }
    commit(next)
  }, [commit])

  const logout = useCallback(async () => {
    const current = loadSession()
    const baseUrl = normalizeBaseUrl(current.baseUrl || String(import.meta.env.VITE_API_BASE_URL ?? ''))

    if (baseUrl && current.accessToken && isAccessValid(current.accessToken)) {
      try {
        await fetch(`${baseUrl}${endpoints.authLogout()}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${current.accessToken}`,
            'X-Progem-ID': String(current.empresaId),
            'X-Device-ID': current.deviceId,
          },
          body: JSON.stringify({ deviceId: current.deviceId }),
        })
      } catch {
        // best-effort
      }
    }

    clearTokensLocal()
  }, [clearTokensLocal])

  useEffect(() => {
    registerSessionBridge(
      (accessToken, refreshToken) => {
        setSession((prev) => {
          const next = { ...prev, accessToken, refreshToken }
          saveSession(next)
          return next
        })
      },
      () => {
        void (async () => {
          await logout()
          if (window.location.pathname !== '/login') {
            window.location.assign('/login?session_expired=1')
          }
        })()
      }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      const stored = loadSession()
      setSession(stored)

      if (!needsAccessRefresh(stored)) {
        if (!cancelled) setSessionReady(true)
        return
      }

      if (!cancelled) setIsBootstrapping(true)
      try {
        const refreshed = await refreshSessionTokens(stored)
        if (!cancelled) {
          commit({
            ...stored,
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
          })
        }
      } catch {
        if (!cancelled) clearTokensLocal()
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false)
          setSessionReady(true)
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [clearTokensLocal, commit])

  function setBaseUrl(baseUrl: string) {
    commit({ ...session, baseUrl })
  }

  function setEmpresaId(empresaId: number) {
    commit({ ...session, empresaId })
  }

  function setDeviceId(deviceId: string) {
    commit({ ...session, deviceId })
  }

  function login(s: StoredSession) {
    commit(s)
    setSessionReady(true)
  }

  const api = useMemo<AuthApi>(
    () => ({
      baseUrl: session.baseUrl,
      empresaId: session.empresaId,
      deviceId: session.deviceId,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      payload,
      isAuthed,
      sessionReady,
      isBootstrapping,
      setBaseUrl,
      setEmpresaId,
      setDeviceId,
      setTokens,
      login,
      logout,
    }),
    [session, payload, isAuthed, sessionReady, isBootstrapping, setTokens, login, logout]
  )

  if (!sessionReady) {
    return (
      <div className="awis-center" style={{ minHeight: '100vh' }}>
        <div className="awis-muted">Restaurando sessão…</div>
      </div>
    )
  }

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
