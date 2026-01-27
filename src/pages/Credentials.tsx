import { Card } from '../ui/Card'

export function Credentials() {
  return (
    <Card title="Credenciais" subtitle="API Keys, rotação e auditoria.">
      <div className="awis-muted">
        Próximo passo: endpoints para listar/rotacionar/revogar chaves por tenant.
      </div>
    </Card>
  )
}
