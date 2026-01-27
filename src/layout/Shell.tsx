import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

type DrawerState = 'closed' | 'open' | 'closing'

export function Shell() {
  const [drawer, setDrawer] = useState<DrawerState>('closed')
  const loc = useLocation()

  const drawerVisible = drawer !== 'closed'
  const drawerOpen = drawer === 'open'

  const closeDrawer = () => {
    if (drawer !== 'open') return
    setDrawer('closing')
    window.setTimeout(() => setDrawer('closed'), 180)
  }

  const openDrawer = () => {
    setDrawer('open')
  }

  // Swipe-to-close (mobile)
  const drag = useRef({ active: false, startX: 0, lastX: 0 })
  const drawerEl = useRef<HTMLElement | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    const x = e.touches?.[0]?.clientX ?? 0
    drag.current = { active: true, startX: x, lastX: x }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!drag.current.active) return
    const x = e.touches?.[0]?.clientX ?? 0
    drag.current.lastX = x
    const delta = x - drag.current.startX
    // apenas arrasto para a esquerda (fechar)
    if (delta < 0 && drawerEl.current) {
      const px = Math.max(delta, -280)
      drawerEl.current.style.transform = `translateX(${px}px)`
    }
  }

  const onTouchEnd = () => {
    if (!drag.current.active) return
    const delta = drag.current.lastX - drag.current.startX
    drag.current.active = false

    // reset inline transform
    if (drawerEl.current) drawerEl.current.style.transform = ''

    if (delta < -80) closeDrawer()
  }

  // Fecha o menu mobile ao navegar.
  useEffect(() => {
    setDrawer('closed')
  }, [loc.pathname])

  // Previne scroll do body quando o drawer estiver aberto
  useEffect(() => {
    const prev = document.body.style.overflow
    if (drawerVisible) document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [drawerVisible])

  // ESC fecha drawer
  useEffect(() => {
    if (!drawerVisible) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') closeDrawer()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerVisible])

  const backdropClass = useMemo(() => {
    if (!drawerVisible) return 'awis-drawer-backdrop'
    return `awis-drawer-backdrop ${drawerOpen ? 'is-open' : 'is-closing'}`
  }, [drawerOpen, drawerVisible])

  const drawerClass = useMemo(() => {
    if (!drawerVisible) return 'awis-drawer'
    return `awis-drawer ${drawerOpen ? 'is-open' : 'is-closing'}`
  }, [drawerOpen, drawerVisible])

  return (
    <div className="awis-shell">
      {/* Sidebar desktop */}
      <Sidebar />

      {/* Sidebar mobile (drawer) */}
      {drawerVisible ? (
        <div className={backdropClass} onClick={closeDrawer}>
          <aside
            ref={(el) => {
              drawerEl.current = el
            }}
            className={drawerClass}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <Sidebar mobile onNavigate={closeDrawer} onClose={closeDrawer} />
          </aside>
        </div>
      ) : null}

      <div className="awis-main">
        <Topbar onOpenNav={openDrawer} />
        <div className="awis-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
