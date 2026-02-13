import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  rightSlot?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, rightSlot, className, readOnly, ...props },
  ref
) {
  return (
    <label className="awis-field">
      {label ? <div className="awis-label">{label}</div> : null}

      <div className="awis-input-wrap">
        <input
          ref={ref}
          className={[
            'awis-input',
            rightSlot ? 'awis-input-with-right' : '',
            readOnly ? 'awis-input-readonly' : '',
            className ?? '',
          ].join(' ')}
          readOnly={readOnly}
          {...props}
        />
        {rightSlot ? <div className="awis-input-right-in">{rightSlot}</div> : null}
      </div>
    </label>
  )
})
