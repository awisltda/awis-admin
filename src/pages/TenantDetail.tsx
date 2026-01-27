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

type ApiClient = {
  id: number
  nome: string
  clientId: string
  ativo: boolean
}

type ApiClientUnidade = {
  id: number
  apiClientId: number
  unidadeId: number
}

type UnidadeDetalhada = {
  id: number
  nomeFantasia: string
  razaoSocial: string
  cnpj: string
  contato?: { telefone?: string; email?: string }
  endereco?: {
    cep?: string
    cidade?: string
    uf?: string
    bairro?: string
    logradouro?: string
    numero?: string
    complemento?: string
    latitude?: string
    longitude?: string
  }
  corPrincipal?: string
  corSecundaria?: string
  urlLogo?: string
}

function toNumber(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function TenantDetail() {
  const nav = useNavigate()
  const { id } = useParams()
  const apiClientId = toNumber(id)

  const [tenant, setTenant] = useState<ApiClient | null>(null)
  const [vinculos, setVinculos] = useState<ApiClientUnidade[]>([])
  const [unidades, setUnidades] = useState<UnidadeDetalhada[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)

  const [confirmToggle, setConfirmToggle] = useState<{ open: boolean; nextAtivo?: boolean }>({ open: false })
  const [confirmUnlink, setConfirmUnlink] = useState<{ open: boolean; unidadeId?: number; nome?: string }>({
    open: false,
  })

  const [q, setQ] = useState('')
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string>('')
  const [linking, setLinking] = useState(false)

  async function loadAll() {
    if (!apiClientId) return
    setLoading(true)
    try {
      const [t, v, u] = await Promise.all([
        http.get<ApiClient>(endpoints.apiClientById(apiClientId)),
        http.get<ApiClientUnidade[]>(endpoints.apiClientUnidades(apiClientId)),
        http.get<UnidadeDetalhada[]>(endpoints.empresaUnidades()),
      ])

      setTenant(t)
      setVinculos(Array.isArray(v) ? v : [])
      setUnidades(Array.isArray(u) ? u : [])
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

  const unidadesById = useMemo(() => {
    const map = new Map<number, UnidadeDetalhada>()
    for (const u of unidades) map.set(u.id, u)
    return map
  }, [unidades])

  const vinculadas = useMemo(() => {
    return vinculos
      .map((v) => ({ v, u: unidadesById.get(v.unidadeId) }))
      .sort((a, b) => (a.u?.nomeFantasia ?? '').localeCompare(b.u?.nomeFantasia ?? ''))
  }, [vinculos, unidadesById])

  const vinculadasIds = useMemo(() => new Set(vinculos.map((v) => v.unidadeId)), [vinculos])

  const disponiveis = useMemo(() => {
    const s = q.trim().toLowerCase()
    return unidades
      .filter((u) => !vinculadasIds.has(u.id))
      .filter((u) => {
        if (!s) return true
        return (
          u.nomeFantasia.toLowerCase().includes(s) ||
          u.razaoSocial.toLowerCase().includes(s) ||
          u.cnpj.replace(/\D/g, '').includes(s.replace(/\D/g, '')) ||
          String(u.id).includes(s)
        )
      })
      .slice(0, 25)
  }, [unidades, vinculadasIds, q])

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
    setConfirmUnlink({ open: false })
    try {
      await http.del(endpoints.apiClientDesvincularUnidade(tenant.id, unidadeId))
      setToast({ kind: 'success', message: 'Unidade desvinculada com sucesso.' })
      await loadAll()
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message ?? 'Falha ao desvincular unidade.' })
    }
  }

  async function linkUnidade() {
    const unidadeId = Number(selectedUnidadeId)
    if (!tenant || !unidadeId) return
    setLinking(true)
    try {
      await http.put(endpoints.apiClientVincularUnidade(tenant.id, unidadeId))
      setToast({ kind: 'success', message: 'Unidade vinculada com sucesso.' })
      setSelectedUnidadeId('')
      setQ('')
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
        subtitle="Detalhes do API Client, vínculo de unidades e distribuição do tenant."
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
              <Badge variant="muted">
                id: <span className="awis-mono">{tenant.id}</span>
              </Badge>
            </div>

            <div className="awis-divider" />

            {/* Vincular unidade */}
            <div className="awis-grid-2">
              <div>
                <div className="awis-section-title">Vincular unidade</div>
                <div className="awis-muted" style={{ marginTop: 4 }}>
                  Selecione uma unidade da empresa (Progem) para disponibilizar este tenant.
                </div>

                <div style={{ height: 10 }} />
                <Input
                  label="Buscar unidade"
                  placeholder="Buscar por nome, CNPJ ou ID…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />

                <div style={{ height: 10 }} />

                <div className="awis-select">
                  <label className="awis-label">Unidade disponível</label>
                  <select value={selectedUnidadeId} onChange={(e) => setSelectedUnidadeId(e.target.value)}>
                    <option value="">Selecione…</option>
                    {disponiveis.map((u) => (
                      <option key={u.id} value={String(u.id)}>
                        {u.nomeFantasia} (#{u.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ height: 12 }} />
                <Button disabled={!selectedUnidadeId || linking} onClick={linkUnidade}>
                  {linking ? 'Vinculando…' : 'Vincular'}
                </Button>
              </div>

              <div>
                <div className="awis-section-title">Unidades vinculadas</div>
                <div className="awis-muted" style={{ marginTop: 4 }}>
                  Estas unidades já estão distribuídas para este tenant.
                </div>

                <div style={{ height: 10 }} />

                {vinculadas.length === 0 ? (
                  <div className="awis-state" style={{ padding: 14 }}>
                    <div className="awis-state-title">Nenhuma unidade vinculada</div>
                    <div className="awis-state-sub">Vincule ao menos uma unidade para liberar o uso.</div>
                  </div>
                ) : (
                  <div className="awis-list" role="list">
                    {vinculadas.map(({ v, u }) => {
                      const nome = u?.nomeFantasia ?? `Unidade #${v.unidadeId}`
                      return (
                        <div key={v.id} className="awis-list-item" role="listitem">
                          <div style={{ minWidth: 0 }}>
                            <div className="awis-list-title">{nome}</div>
                            <div className="awis-muted" style={{ fontSize: 12 }}>
                              unidadeId: <span className="awis-mono">{v.unidadeId}</span>
                              {u?.cnpj ? (
                                <>
                                  {' '}
                                  • CNPJ: <span className="awis-mono">{u.cnpj}</span>
                                </>
                              ) : null}
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            onClick={() => setConfirmUnlink({ open: true, unidadeId: v.unidadeId, nome })}
                          >
                            Desvincular
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="awis-divider" />
            <div className="awis-muted">
              <span className="awis-mono">Dica:</span> volte para <Link className="awis-link" to="/api-clients">API Clients</Link> para visualizar todos os tenants.
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
        description={`Confirma desvincular a unidade "${confirmUnlink.nome ?? '—'}" deste tenant?`}
        confirmText="Desvincular"
        danger
        onConfirm={unlinkUnidade}
        onClose={() => setConfirmUnlink({ open: false })}
      />
    </div>
  )
}
