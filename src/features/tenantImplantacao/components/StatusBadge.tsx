import { Badge } from '../../../ui/Badge'
import { getStatusLabel } from '../helpers'
import type { TenantImplantacaoStatus } from '../types'

function getVariant(status?: TenantImplantacaoStatus) {
  switch (status) {
    case 'CONCLUIDO':
    case 'EM_IMPLANTACAO':
    case 'HOMOLOGACAO':
      return 'default' as const
    default:
      return 'muted' as const
  }
}

export function StatusBadge({ status }: { status?: TenantImplantacaoStatus | null }) {
  return <Badge variant={getVariant(status ?? undefined)}>{getStatusLabel(status ?? undefined)}</Badge>
}
