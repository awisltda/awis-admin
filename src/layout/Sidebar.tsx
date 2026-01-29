import { NavLink } from 'react-router-dom'
import { useTheme } from '../theme/ThemeProvider'
import { useAuth } from '../auth/AuthContext'

type Props = {
  mobile?: boolean
  onNavigate?: () => void
  onClose?: () => void
}

function normalize(url: string) {
  return String(url ?? '').trim().replace(/\/+$/, '').toLowerCase()
}

export function Sidebar({ mobile, onNavigate, onClose }: Props) {
  const { theme } = useTheme()
  const { payload, baseUrl } = useAuth()
  const roles = payload?.roles ?? []
  const isAwis = roles.includes('AWIS')
  const isAdm = roles.includes('ADM')

  const b = normalize(baseUrl)
  const isSandbox = b.includes('sandbox-api.progem.com.br') || b.includes('localhost')
  const isProd = !isSandbox && b.includes('api.progem.com.br')

  const tools = isSandbox
    ? {
        logs: 'https://awis.com.br/urls/',
        metrics: 'https://sandbox-api.progem.com.br/admin/metrics/index.html',
        docs: 'https://sandbox-api.progem.com.br/docs/index.html',
      }
    : isProd
      ? {
          metrics: 'https://api.progem.com.br/admin/metrics/index.html',
          docs: 'https://api.progem.com.br/docs/index.html',
        }
      : null

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

        {tools ? (
          <div className="awis-nav-section" aria-label="Ferramentas">
            <div className="awis-nav-section-title">Ferramentas</div>



            <a
              className="awis-nav-external"
              href={tools.metrics}
              target="_blank"
              rel="noreferrer"
              onClick={onNavigate}
            >
              Métricas API
            </a>

            <a
              className="awis-nav-external"
              href={tools.docs}
              target="_blank"
              rel="noreferrer"
              onClick={onNavigate}
            >
              Documentação API
            </a>


                        {'logs' in tools ? (
              <a
                className="awis-nav-external"
                href={tools.logs}
                target="_blank"
                rel="noreferrer"
                onClick={onNavigate}
              >
                Logs
              </a>
            ) : null}
            
          </div>
        ) : null}
      </nav>
    </aside>
  )
}
