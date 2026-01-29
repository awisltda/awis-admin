import { Badge } from '../../../ui/Badge'

export function TenantTabEnv(props: { envSnippet: string }) {
  const { envSnippet } = props
  return (
    <div className="awis-stack" style={{ gap: 14 }}>
      <div>
        <div className="awis-section-title">.env / Integração</div>
        <div className="awis-muted" style={{ marginTop: 4 }}>
          Um arquivo pronto para o integrador configurar <span className="awis-mono">X-Progem-ID</span>.
        </div>
      </div>

      <div className="awis-callout">
       
        <pre className="awis-code" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
          {envSnippet}
        </pre>
      </div>

      <div className="awis-callout awis-callout--warn">
        <div style={{ fontWeight: 700 }}>Regra de ouro</div>
        <div className="awis-muted" style={{ marginTop: 6 }}>
          O <span className="awis-mono">X-Progem-ID</span> é sempre o <span className="awis-mono">empresaId</span> (unidade).
          O <span className="awis-mono">clientId</span> identifica o integrador. Não confundir.
        </div>
      </div>

      <Badge variant="muted">Dica: copie e cole no integrador</Badge>
    </div>
  )
}
