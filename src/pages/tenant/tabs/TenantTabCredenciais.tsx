// src/pages/tenant/tabs/TenantTabCredenciais.tsx
import { Badge } from '../../../ui/Badge'
import { Button } from '../../../ui/Button'
import type { ApiClientDetail } from '../types'

export function TenantTabCredenciais(props: {
  tenant: ApiClientDetail
  tenantDomain: string
  scopesList: string[]
  onCopy: (label: string, value: string) => void

  rotatingSecret: boolean
  onOpenRotate: () => void
}) {
  const { tenant, tenantDomain, scopesList, onCopy, rotatingSecret, onOpenRotate } = props

  return (
    <div className="awis-stack" style={{ gap: 14 }}>
      <div>
        <div className="awis-section-title">Credenciais</div>
        <div className="awis-muted" style={{ marginTop: 4 }}>
          As credenciais identificam o integrador (API Client). O <span className="awis-mono">clientSecret</span> é exibido
          apenas no momento da rotação (exibição única).
        </div>
      </div>

      <div className="awis-grid-2" style={{ gap: 14 }}>
        <div className="awis-callout">
          <div style={{ fontWeight: 700 }}>Identificadores</div>
          <div style={{ height: 10 }} />

          <div className="awis-list" role="list">
            <div className="awis-list-item" role="listitem">
              <div style={{ minWidth: 0 }}>
                <div className="awis-list-title">clientId</div>
                <div className="awis-muted" style={{ fontSize: 12 }}>
                  <span className="awis-mono">{tenant.clientId}</span>
                </div>
              </div>
              <Button variant="ghost" onClick={() => onCopy('clientId', tenant.clientId)}>
                Copiar
              </Button>
            </div>

            <div className="awis-list-item" role="listitem">
              <div style={{ minWidth: 0 }}>
                <div className="awis-list-title">X-Progem-ID (empresaId)</div>
                <div className="awis-muted" style={{ fontSize: 12 }}>
                  <span className="awis-mono">{tenant.empresaId}</span>
                </div>
              </div>
              <Button variant="ghost" onClick={() => onCopy('X-Progem-ID', String(tenant.empresaId))}>
                Copiar
              </Button>
            </div>

            <div className="awis-list-item" role="listitem">
              <div style={{ minWidth: 0 }}>
                <div className="awis-list-title">Domínio do tenant</div>
                <div className="awis-muted" style={{ fontSize: 12 }}>
                  <span className="awis-mono">{tenantDomain || '—'}</span>
                </div>
              </div>
              <Button variant="ghost" onClick={() => onCopy('domínio', tenantDomain)} disabled={!tenantDomain}>
                Copiar
              </Button>
            </div>
          </div>
        </div>

        <div className="awis-callout awis-callout--warn">
          <div className="awis-row" style={{ justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontWeight: 700 }}>clientSecret</div>
            <Badge variant="muted">EXIBIÇÃO ÚNICA</Badge>
          </div>

          <div className="awis-muted" style={{ marginTop: 6 }}>
            Para segurança, este painel não lê o secret do backend. Use rotação para gerar um novo valor e copiar na hora.
          </div>

          <div style={{ height: 12 }} />

          <Button variant="danger" onClick={onOpenRotate} disabled={rotatingSecret}>
            {rotatingSecret ? 'Rotacionando…' : 'Rotacionar clientSecret'}
          </Button>

          <div className="hint" style={{ marginTop: 10 }}>
            Rotacionar invalida o secret anterior. Integrações precisam ser atualizadas imediatamente.
          </div>
        </div>
      </div>

      <div className="awis-divider" />

      <div>
        <div className="awis-section-title">Escopos</div>
        <div className="awis-muted" style={{ marginTop: 4 }}>
          Estes escopos definem o que a integração pode consumir. Ideal para auditoria, suporte e governança.
        </div>

        <div style={{ height: 10 }} />

        {scopesList.length === 0 ? (
          <div className="awis-state" style={{ padding: 14 }}>
            <div className="awis-state-title">Sem escopos</div>
            <div className="awis-state-sub">Nenhum escopo foi registrado para este API Client.</div>
          </div>
        ) : (
          <div className="awis-list" role="list">
            {scopesList.map((s) => (
              <div key={s} className="awis-list-item" role="listitem">
                <div className="awis-list-title">
                  <span className="awis-mono" style={{ fontSize: 12 }}>
                    {s}
                  </span>
                </div>
                <Badge variant="muted">SCOPE</Badge>
              </div>
            ))}
          </div>
        )}

        <div className="awis-row" style={{ gap: 10, marginTop: 10 }}>
          <Button variant="ghost" onClick={() => onCopy('escopos', tenant.escopos ?? '')} disabled={!tenant.escopos}>
            Copiar escopos
          </Button>
        </div>
      </div>
    </div>
  )
}