import { Card } from '../ui/Card'

export function Tenants() {
  return (
    <Card title="Tenants" subtitle="Cadastro, status, filiais e distribuição do whitelabel.">
      <div className="awis-muted">
        Próximo passo: listar tenants via API e navegar para detalhes (/tenants/:id).
      </div>
    </Card>
  )
}
