import { useParams } from 'react-router-dom'
import { Card } from '../ui/Card'

export function TenantDetail() {
  const { id } = useParams()
  return (
    <Card title={`Tenant #${id}`} subtitle="Detalhes, filiais, credenciais, usuários do tenant.">
      <div className="awis-muted">
        Próximo passo: carregar tenant por ID e ações: ativar/desativar, gerenciar filiais e credenciais.
      </div>
    </Card>
  )
}
