import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { useTheme } from '../theme/ThemeProvider'

type Props = {
  onOpenNav?: () => void
}

export function Topbar({ onOpenNav }: Props) {
  const { payload, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const logo = theme === 'dark' ? '/assets/awis/logo-dark.png' : '/assets/awis/logo-light.png'

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (ev: MouseEvent | TouchEvent) => {
      const el = menuRef.current
      if (!el) return
      if (ev.target instanceof Node && el.contains(ev.target)) return
      setMenuOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('touchstart', onDown, { passive: true })
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('touchstart', onDown)
    }
  }, [menuOpen])

  return (
    <header className="awis-topbar">
      <div className="awis-topbar-left">
        <button
          type="button"
          className="awis-menu-btn"
          aria-label="Abrir menu"
          onClick={onOpenNav}
        >
          {/* wrapper para o hamburger premium */}
          <span className="awis-menu-icon" aria-hidden="true">
            <span className="awis-menu-line" />
            <span className="awis-menu-line" />
            <span className="awis-menu-line" />
          </span>
        </button>

        <img src={logo} alt="AWIS" className="awis-logo" />
        <Badge>AWIS</Badge>
      </div>

      <div className="awis-topbar-right" ref={menuRef}>
        {/* Desktop actions */}
        <div className="awis-topbar-actions awis-topbar-actions-desktop">
          <Button variant="ghost" onClick={toggleTheme}>
            {theme === 'dark' ? 'Claro' : 'Escuro'}
          </Button>

          <div className="awis-user">{payload?.sub ?? 'awis'}</div>

          <Button variant="ghost" onClick={logout}>
            Sair
          </Button>
        </div>

        {/* Mobile actions (compact) */}
        <div className="awis-topbar-actions awis-topbar-actions-mobile">
          <button
            type="button"
            className="awis-ellipsis-btn"
            aria-label="Abrir ações"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((s) => !s)}
          >
            <span className="awis-ellipsis-dot" />
            <span className="awis-ellipsis-dot" />
            <span className="awis-ellipsis-dot" />
          </button>

          <div className={menuOpen ? 'awis-topbar-menu is-open' : 'awis-topbar-menu'} role="menu">
            <div className="awis-topbar-menu-head">
              <div className="awis-topbar-menu-title">{payload?.sub ?? 'awis'}</div>
              <div className="awis-topbar-menu-sub">Controle interno</div>
            </div>

            <div className="awis-topbar-menu-actions">
              <button
                type="button"
                className="awis-topbar-menu-item"
                onClick={() => {
                  toggleTheme()
                  setMenuOpen(false)
                }}
              >
                Alternar tema ({theme === 'dark' ? 'Claro' : 'Escuro'})
              </button>

              <button
                type="button"
                className="awis-topbar-menu-item danger"
                onClick={() => {
                  setMenuOpen(false)
                  logout()
                }}
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
