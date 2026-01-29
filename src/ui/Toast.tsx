import { createPortal } from 'react-dom'

export function Toast({
  kind,
  message,
  onClose,
}: {
  kind: 'success' | 'error'
  message: string
  onClose: () => void
}) {
  const node = (
    <div className={`awis-toast awis-toast-${kind}`} role="status" aria-live="polite">
      <div className="awis-toast-msg">{message}</div>
      <button className="awis-toast-x" onClick={onClose} aria-label="Fechar">
        ×
      </button>
    </div>
  )

  // Portal: garante visibilidade acima de modais/drawers
  return createPortal(node, document.body)
}
