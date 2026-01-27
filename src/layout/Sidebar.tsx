import { NavLink } from 'react-router-dom'
import { useTheme } from '../theme/ThemeProvider'
import { useAuth } from '../auth/AuthContext'

type Props = {
  mobile?: boolean
  onNavigate?: () => void
  onClose?: () => void
}

export function Sidebar({ mobile, onNavigate, onClose }: Props) {
  const { theme } = useTheme()
  const { payload } = useAuth()
  const roles = payload?.roles ?? []
  const isAwis = roles.includes('AWIS')
  const isAdm = roles.includes('ADM')

  const rootClass = mobile
    ? 'awis-sidebar awis-sidebar--mobile'
    : 'awis-sidebar awis-sidebar--desktop'

  return (
    <aside className={rootClass}>
      <div className="awis-brand">
        {mobile ? (
          <button
            type="button"
            className="awis-sidebar-close"
            aria-label="Fechar menu"
            onClick={onClose}
          >
            ×
          </button>
        ) : null}
        <div className="awis-brand-logo" aria-label="AWIS">
          <img src="/assets/awis/icon.png" alt="AWIS" />
        </div>

        <div className="awis-brand-text">
          <div className="awis-brand-title">AWIS Console</div>
          <div className="awis-brand-sub">
            {theme === 'dark' ? 'Tema escuro' : 'Tema claro'} • Controle interno
          </div>
        </div>
      </div>

      <nav className="awis-nav">
        {isAwis ? (
          <NavLink
            to="/api-clients"
            onClick={onNavigate}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            API Clients
          </NavLink>
        ) : null}

        {isAwis || isAdm ? (
          <NavLink
            to="/users"
            onClick={onNavigate}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            Usuários
          </NavLink>
        ) : null}
      </nav>
    </aside>
  )
}
