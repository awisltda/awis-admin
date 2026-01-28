import type { InputHTMLAttributes, ReactNode } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  rightSlot?: ReactNode
}

export function Input({ label, rightSlot, ...props }: Props) {
  return (
    <label className="awis-field">
      {label ? <div className="awis-label">{label}</div> : null}

      <div className="awis-input-wrap">
        <input className={`awis-input ${rightSlot ? 'awis-input-with-right' : ''}`} {...props} />
        {rightSlot ? <div className="awis-input-right-in">{rightSlot}</div> : null}
      </div>
    </label>
  )
}
