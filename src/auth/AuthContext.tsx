import { createContext, useContext, useMemo, useState } from 'react'
import { decodeJwt, isExpired, type JwtPayload } from './jwt'
import { loadSession, saveSession, type StoredSession } from '../lib/sessionStorage'

type AuthState = {
  baseUrl: string
  empresaId: number
  deviceId: string
  accessToken: string
  refreshToken: string
  payload: JwtPayload | null
  isAuthed: boolean
}

type AuthApi = AuthState & {
  setBaseUrl: (baseUrl: string) => void
  setEmpresaId: (empresaId: number) => void
  setDeviceId: (deviceId: string) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  login: (session: StoredSession) => void
  logout: () => void
}

const Ctx = createContext<AuthApi | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StoredSession>(() => loadSession())

  const payload = useMemo(() => (session.accessToken ? decodeJwt(session.accessToken) : null), [session.accessToken])
  const isAuthed = Boolean(session.accessToken) && !isExpired(payload)

  function commit(next: StoredSession) {
    saveSession(next)
    setSession(next)
  }

  function setBaseUrl(baseUrl: string) {
    commit({ ...session, baseUrl })
  }

  function setEmpresaId(empresaId: number) {
    commit({ ...session, empresaId })
  }

  function setDeviceId(deviceId: string) {
    commit({ ...session, deviceId })
  }

  function setTokens(accessToken: string, refreshToken: string) {
    commit({ ...session, accessToken, refreshToken })
  }

  function login(s: StoredSession) {
    commit(s)
  }

  function logout() {
    const current = loadSession()
    const next: StoredSession = {
      baseUrl: current.baseUrl,
      empresaId: current.empresaId,
      deviceId: current.deviceId,
      accessToken: '',
      refreshToken: '',
    }
    saveSession(next)
    setSession(next)
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
      setBaseUrl,
      setEmpresaId,
      setDeviceId,
      setTokens,
      login,
      logout,
    }),
    [session, payload, isAuthed]
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
