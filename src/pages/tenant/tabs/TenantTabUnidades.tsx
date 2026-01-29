import { Link } from 'react-router-dom'
import { Badge } from '../../../ui/Badge'
import { Button } from '../../../ui/Button'
import { Input } from '../../../ui/Input'
import type { ApiClientDetail, ApiClientUnidade } from '../types'

export function TenantTabUnidades(props: {
  tenant: ApiClientDetail
  temMatrizVinculada: boolean
  outrasUnidades: ApiClientUnidade[]
  outraUnidadeId: string
  setOutraUnidadeId: (v: string) => void
  linking: boolean
  onVincularOutraUnidade: () => void
  onConfirmUnlink: (unidadeId: number) => void
}) {
  const {
    tenant,
    temMatrizVinculada,
    outrasUnidades,
    outraUnidadeId,
    setOutraUnidadeId,
    linking,
    onVincularOutraUnidade,
    onConfirmUnlink,
  } = props

  return (
    <div className="awis-stack" style={{ gap: 14 }}>
      {!temMatrizVinculada ? (
        <div className="awis-callout awis-callout--warn">
          <div style={{ fontWeight: 700 }}>Atenção</div>
          <div className="awis-muted" style={{ marginTop: 4 }}>
            A unidade matriz (<span className="awis-mono">{tenant.empresaId}</span>) não aparece vinculada em{' '}
            <span className="awis-mono">api_client_unidades</span>. Isso indica inconsistência em base antiga.
            Garanta o vínculo automático no backend (create/update) ou execute um reparo.
          </div>
        </div>
      ) : null}

      {/* MATRIZ */}
      <div>
        <div className="awis-section-title">Matriz (fixa)</div>
        <div className="awis-muted" style={{ marginTop: 4 }}>
          A matriz é definida por <span className="awis-mono">api_client.empresa_id</span> e sempre deve estar vinculada
          automaticamente na tabela <span className="awis-mono">api_client_unidades</span>.
        </div>

        <div style={{ height: 10 }} />

        <div className="awis-list" role="list">
          <div className="awis-list-item" role="listitem">
            <div style={{ minWidth: 0 }}>
              <div className="awis-list-title">Unidade matriz #{tenant.empresaId}</div>
              <div className="awis-muted" style={{ fontSize: 12 }}>
                X-Progem-ID: <span className="awis-mono">{tenant.empresaId}</span>
              </div>
            </div>
            <Badge variant="muted">OBRIGATÓRIA</Badge>
          </div>
        </div>
      </div>

      <div className="awis-divider" />

      {/* OUTRAS UNIDADES */}
      <div className="awis-grid-2">
        <div>
          <div className="awis-section-title">Vincular outras unidades</div>
          <div className="awis-muted" style={{ marginTop: 4 }}>
            Informe o <span className="awis-mono">unidadeId</span> (empresaId da unidade) para distribuir este API Client
            para outras unidades além da matriz.
          </div>

          <div style={{ height: 10 }} />
          <div className="awis-row awis-row--wrap" style={{ gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <Input
                label="unidadeId (empresaId)"
                placeholder="Ex: 234"
                value={outraUnidadeId}
                onChange={(e) => setOutraUnidadeId(e.target.value)}
                disabled={linking}
                inputMode="numeric"
              />
            </div>
            <Button variant="primary" onClick={onVincularOutraUnidade} disabled={!outraUnidadeId.trim() || linking}>
              {linking ? 'Vinculando…' : 'Vincular unidade'}
            </Button>
          </div>

          <div className="hint" style={{ marginTop: 8 }}>
            A matriz é automática. Aqui você vincula apenas unidades adicionais.
          </div>
        </div>

        <div>
          <div className="awis-section-title">Unidades adicionais</div>
          <div className="awis-muted" style={{ marginTop: 4 }}>
            Unidades vinculadas além da matriz. Aqui pode desvincular.
          </div>

          <div style={{ height: 10 }} />

          {outrasUnidades.length === 0 ? (
            <div className="awis-state" style={{ padding: 14 }}>
              <div className="awis-state-title">Nenhuma unidade adicional vinculada</div>
              <div className="awis-state-sub">Vincule uma unidade pelo ID para distribuir o tenant.</div>
            </div>
          ) : (
            <div className="awis-list" role="list">
              {outrasUnidades.map((v) => (
                <div key={v.id} className="awis-list-item" role="listitem">
                  <div style={{ minWidth: 0 }}>
                    <div className="awis-list-title">Unidade #{v.unidadeId}</div>
                    <div className="awis-muted" style={{ fontSize: 12 }}>
                      unidadeId: <span className="awis-mono">{v.unidadeId}</span>
                    </div>
                  </div>

                  <Button variant="ghost" onClick={() => onConfirmUnlink(v.unidadeId)}>
                    Desvincular
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      
    </div>
  )
}
