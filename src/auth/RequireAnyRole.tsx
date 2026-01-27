import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'

export function RequireAnyRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { isAuthed, payload, logout } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()

  const current = payload?.roles ?? []
  const ok = isAuthed && roles.some((r) => current.includes(r))

  useEffect(() => {
    if (!isAuthed) {
      nav('/login', { replace: true, state: { from: loc.pathname } })
    }
  }, [isAuthed, nav, loc.pathname])

  const hasTokenButNoRole = useMemo(
    () => isAuthed && !roles.some((r) => current.includes(r)),
    [isAuthed, current, roles]
  )

  if (ok) return <>{children}</>

  if (hasTokenButNoRole) {
    return (
      <div className="awis-center">
        <Card title="Acesso negado" subtitle="Você não possui permissão para acessar esta área.">
          <div className="awis-row awis-row--wrap" style={{ justifyContent: 'space-between' }}>
            <Badge>Necessário: {roles.join(' ou ')}</Badge>
            {current.length ? <Badge variant="muted">Roles atuais: {current.join(', ')}</Badge> : null}
          </div>
          <div style={{ height: 12 }} />
          <div className="awis-muted">
            Usuário: <span className="awis-mono">{payload?.sub ?? '—'}</span>
          </div>

          <div style={{ height: 16 }} />
          <Button
            variant="ghost"
            onClick={() => {
              logout()
              nav('/login', { replace: true })
            }}
          >
            Sair e trocar usuário
          </Button>
        </Card>
      </div>
    )
  }

  return null
}
