export function Toast({
  kind,
  message,
  onClose,
}: {
  kind: 'success' | 'error'
  message: string
  onClose: () => void
}) {
  return (
    <div className={`awis-toast awis-toast-${kind}`}>
      <div>{message}</div>
      <button className="awis-toast-x" onClick={onClose} aria-label="Fechar">
        ×
      </button>
    </div>
  )
}
