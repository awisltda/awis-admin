import type { ReactNode } from 'react'

export function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: ReactNode
}) {
  return (
    <section className="awis-card">
      <div className="awis-card-head">
        <div className="awis-card-title">{title}</div>
        {subtitle ? <div className="awis-card-sub">{subtitle}</div> : null}
      </div>
      {children ? <div className="awis-card-body">{children}</div> : null}
    </section>
  )
}
