import type { ReactNode } from 'react'

export function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="awis-card">
      <div className="awis-card-head">
        <div className="awis-card-head-row">
          <div className="awis-card-head-main">
            <div className="awis-card-title">{title}</div>
            {subtitle ? <div className="awis-card-sub">{subtitle}</div> : null}
          </div>

          {right ? <div className="awis-card-head-right">{right}</div> : null}
        </div>
      </div>
      {children ? <div className="awis-card-body">{children}</div> : null}
    </section>
  )
}
