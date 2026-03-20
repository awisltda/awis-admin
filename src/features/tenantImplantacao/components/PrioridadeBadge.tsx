import { Badge } from '../../../ui/Badge'
import { getPrioridadeLabel } from '../helpers'
import type { TenantImplantacaoPrioridade } from '../types'

function getVariant(prioridade?: TenantImplantacaoPrioridade) {
  switch (prioridade) {
    case 'P0':
    case 'P1':
      return 'default' as const
    default:
      return 'muted' as const
  }
}

export function PrioridadeBadge({
  prioridade,
}: {
  prioridade?: TenantImplantacaoPrioridade | null
}) {
  return <Badge variant={getVariant(prioridade ?? undefined)}>{getPrioridadeLabel(prioridade ?? undefined)}</Badge>
}
