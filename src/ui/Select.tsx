import type { SelectHTMLAttributes } from 'react'

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
}

export function Select({ label, children, ...props }: Props) {
  return (
    <label className="awis-field">
      {label ? <div className="awis-label">{label}</div> : null}
      <div className="awis-input-wrap">
        <select className="awis-input" {...props}>
          {children}
        </select>
      </div>
    </label>
  )
}
