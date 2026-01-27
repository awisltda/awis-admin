import type { ReactNode } from 'react'

export function Badge({
  children,
  variant = 'default',
}: {
  children: ReactNode
  variant?: 'default' | 'muted'
}) {
  return <span className={`awis-badge awis-badge-${variant}`}>{children}</span>
}
