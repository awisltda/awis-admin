import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Input } from '../ui/Input'
import { Toast } from '../ui/Toast'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { http } from '../api/http'
import { endpoints } from '../api/endpoints'

type ToastState = { kind: 'success' | 'error'; message: string } | null

type ApiClientDetail = {
  id: number
  nome: string
  clientId: string
  ativo: boolean
  empresaId: number // ✅ matriz
  escopos?: string
}

type ApiClientUnidade = {
  id: number
  apiClientId: number
  unidadeId: number
}

function toNumber(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function TenantDetail() {
  const nav = useNavigate()
  const { id } = useParams()
  const apiClientId = toNumber(id)

  const [tenant, setTenant] = useState<ApiClientDetail | null>(null)
  const [vinculos, setVinculos] = useState<ApiClientUnidade[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)

  const [confirmToggle, setConfirmToggle] = useState<{ open: boolean }>({ open: false })
  const [confirmUnlink, setConfirmUnlink] = useState<{ open: boolean; unidadeId?: number }>({ open: false })

  // ✅ Campo operacional: outras unidades (sem pesquisa)
  const [outraUnidadeId, setOutraUnidadeId] = useState<string>('')
  const [linking, setLinking] = useState(false)

  async function loadAll() {
    if (!apiClientId) return
    setLoading(true)
    try {
      const [t, v] = await Promise.all([
        http.get<ApiClientDetail>(endpoints.apiClientDetail(apiClientId)),
        http.get<ApiClientUnidade[]>(endpoints.apiClientUnidades(apiClientId)),
      ])
      setTenant(t)
      setVinculos(Array.isArray(v) ? v : [])
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message ?? 'Falha ao carregar detalhes do tenant.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiClientId])

  const matrizId = tenant?.empresaId ?? 0

  const vinculosOrdenados = useMemo(() => {
    return [...vinculos].sort((a, b) => a.unidadeId - b.unidadeId)
  }, [vinculos])

  const temMatrizVinculada = useMemo(() => {
    if (!matrizId) return false
    return vinculos.some((v) => v.unidadeId === matrizId)
  }, [vinculos, matrizId])

  const outrasUnidades = useMemo(() => {
    if (!matrizId) return vinculosOrdenados
    return vinculosOrdenados.filter((v) => v.unidadeId !== matrizId)
  }, [vinculosOrdenados, matrizId])

  async function toggleTenant() {
    if (!tenant) return
    const nextAtivo = !tenant.ativo
    setConfirmToggle({ open: false })
    try {
      await http.patch(endpoints.apiClientStatus(tenant.id, nextAtivo))
      setToast({ kind: 'success', message: `Status atualizado: ${nextAtivo ? 'ATIVO' : 'INATIVO'}.` })
      await loadAll()
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message ?? 'Falha ao alterar status.' })
    }
  }

  async function unlinkUnidade() {
    const unidadeId = confirmUnlink.unidadeId
    if (!tenant || !unidadeId) return

    // 🔒 Proteção: não permitir desvincular matriz
    if (unidadeId === tenant.empresaId) {
      setConfirmUnlink({ open: false })
      setToast({ kind: 'error', message: 'A matriz não pode ser desvinculada. Ela é obrigatória.' })
      return
    }

    setConfirmUnlink({ open: false })
    try {
      await http.del(endpoints.apiClientDesvincularUnidade(tenant.id, unidadeId))
      setToast({ kind: 'success', message: 'Unidade desvinculada com sucesso.' })
      await loadAll()
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message ?? 'Falha ao desvincular unidade.' })
    }
  }

  async function vincularOutraUnidade() {
    if (!tenant) return

    const unidadeId = Number(String(outraUnidadeId ?? '').trim())
    if (!outraUnidadeId.trim() || !Number.isFinite(unidadeId) || unidadeId <= 0) {
      setToast({ kind: 'error', message: 'Informe um unidadeId válido (empresaId da unidade), ex: 234.' })
      return
    }

    if (unidadeId === tenant.empresaId) {
      setToast({ kind: 'error', message: 'Esta unidade é a matriz (empresaId). Ela já deve estar vinculada automaticamente.' })
      return
    }

    setLinking(true)
    try {
      await http.put(endpoints.apiClientVincularUnidade(tenant.id, unidadeId))
      setToast({ kind: 'success', message: `Unidade vinculada com sucesso (#${unidadeId}).` })
      setOutraUnidadeId('')
      await loadAll()
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message ?? 'Falha ao vincular unidade.' })
    } finally {
      setLinking(false)
    }
  }

  if (!apiClientId) {
    return (
      <Card title="Tenant inválido" subtitle="ID inválido.">
        <Button variant="ghost" onClick={() => nav('/api-clients')}>
          Voltar
        </Button>
      </Card>
    )
  }

  return (
    <div className="awis-stack">
      {toast ? <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} /> : null}

      <Card
        title={tenant ? tenant.nome : `Tenant #${apiClientId}`}
        subtitle="Detalhes do API Client e distribuição de unidades."
        right={
          <div className="awis-row" style={{ gap: 10 }}>
            <Button variant="ghost" onClick={() => nav('/api-clients')}>
              Voltar
            </Button>
            {tenant ? (
              <Button variant={tenant.ativo ? 'danger' : 'primary'} onClick={() => setConfirmToggle({ open: true })}>
                {tenant.ativo ? 'Desativar' : 'Ativar'}
              </Button>
            ) : null}
          </div>
        }
      >
        {loading ? (
          <div className="awis-state">
            <div className="awis-state-title">Carregando detalhes…</div>
            <div className="awis-state-sub">Aguarde um instante.</div>
            <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
              <div className="awis-skeleton" style={{ width: '55%' }} />
              <div className="awis-skeleton" style={{ width: '78%' }} />
              <div className="awis-skeleton" style={{ width: '66%' }} />
            </div>
          </div>
        ) : null}

        {!loading && tenant ? (
          <div className="awis-stack" style={{ gap: 14 }}>
            <div className="awis-row awis-row--wrap" style={{ gap: 10 }}>
              <Badge>{tenant.ativo ? 'ATIVO' : 'INATIVO'}</Badge>

              <Badge variant="muted">
                clientId: <span className="awis-mono">{tenant.clientId}</span>
              </Badge>

              {/* ✅ DESTAQUE: X-Progem-ID = empresaId */}
              <Badge>
                X-Progem-ID (matriz): <span className="awis-mono">{tenant.empresaId}</span>
              </Badge>

              <Badge variant="muted">
                apiClientId: <span className="awis-mono">{tenant.id}</span>
              </Badge>
            </div>

            {!temMatrizVinculada ? (
              <div className="awis-callout awis-callout--warn">
                <div style={{ fontWeight: 700 }}>Atenção</div>
                <div className="awis-muted" style={{ marginTop: 4 }}>
                  A unidade matriz (<span className="awis-mono">{tenant.empresaId}</span>) não aparece vinculada em{' '}
                  <span className="awis-mono">api_client_unidades</span>. Isso indica inconsistência em base antiga.
                  Crie o vínculo da matriz automaticamente no backend (create/update) ou execute um reparo.
                </div>
              </div>
            ) : null}

            <div className="awis-divider" />

            {/* MATRIZ (fixa) */}
            <div>
              <div className="awis-section-title">Matriz (fixa)</div>
              <div className="awis-muted" style={{ marginTop: 4 }}>
                A matriz é definida por <span className="awis-mono">api_client.empresa_id</span> e sempre deve estar
                vinculada automaticamente na tabela <span className="awis-mono">api_client_unidades</span>.
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

            {/* OUTRAS UNIDADES (operacional) */}
            <div className="awis-grid-2">
              <div>
                <div className="awis-section-title">Vincular outras unidades</div>
                <div className="awis-muted" style={{ marginTop: 4 }}>
                  Informe o <span className="awis-mono">unidadeId</span> (empresaId da unidade) para distribuir este
                  API Client para outras unidades além da matriz. Sem pesquisa.
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
                    />
                  </div>
                  <Button variant="primary" onClick={vincularOutraUnidade} disabled={!outraUnidadeId.trim() || linking}>
                    {linking ? 'Vinculando…' : 'Vincular unidade'}
                  </Button>
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

                        <Button variant="ghost" onClick={() => setConfirmUnlink({ open: true, unidadeId: v.unidadeId })}>
                          Desvincular
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="awis-divider" />
            <div className="awis-muted">
              <span className="awis-mono">Dica:</span> volte para{' '}
              <Link className="awis-link" to="/api-clients">
                API Clients
              </Link>{' '}
              para visualizar todos os tenants.
            </div>
          </div>
        ) : null}
      </Card>

      <ConfirmDialog
        open={confirmToggle.open}
        title={`${tenant?.ativo ? 'Desativar' : 'Ativar'} API Client`}
        description={
          tenant?.ativo
            ? `Confirma desativar o cliente "${tenant?.nome}"? Essa ação pode impactar integrações e acessos.`
            : `Confirma ativar o cliente "${tenant?.nome}"?`
        }
        confirmText={tenant?.ativo ? 'Desativar' : 'Ativar'}
        danger={Boolean(tenant?.ativo)}
        onConfirm={toggleTenant}
        onClose={() => setConfirmToggle({ open: false })}
      />

      <ConfirmDialog
        open={confirmUnlink.open}
        title="Desvincular unidade"
        description="Confirma desvincular esta unidade adicional deste tenant?"
        confirmText="Desvincular"
        danger
        onConfirm={unlinkUnidade}
        onClose={() => setConfirmUnlink({ open: false })}
      />
    </div>
  )
}
