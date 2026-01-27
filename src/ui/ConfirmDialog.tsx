import { Button } from './Button'
import { Card } from './Card'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onClose,
  danger,
}: {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="awis-modal-backdrop" role="dialog" aria-modal="true">
      <div className="awis-modal">
        <Card title={title} subtitle={description}>
          <div className="awis-row" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <Button variant="ghost" onClick={onClose}>
              {cancelText}
            </Button>
            <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
              {confirmText}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
