import { Card } from '../ui/Card'

export function Dashboard() {
  return (
    <div className="awis-grid">
      <Card title="Visão geral" subtitle="Métricas e saúde da plataforma (em breve).">
        <div className="awis-muted">
          Próximo passo: consumir endpoints de métricas/tenants e exibir cards.
        </div>
      </Card>
      <Card title="Ações rápidas" subtitle="Atalhos operacionais.">
        <ul className="awis-list">
          <li>Criar novo Tenant</li>
          <li>Ativar/Desativar Tenant</li>
          <li>Rotacionar API Key</li>
        </ul>
      </Card>
    </div>
  )
}
