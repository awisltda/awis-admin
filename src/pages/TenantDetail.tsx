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
  empresaId: number //  matriz (X-Progem-ID)
  escopos?: string
}

type ApiClientUnidade = {
  id: number
  apiClientId: number
  unidadeId: number
}

type TabKey = 'UNIDADES' | 'CREDENCIAIS' | 'WEBHOOKS' | 'ENV' | 'IDENTIDADE'

function toNumber(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function chunkScopes(scopes?: string) {
  const s = String(scopes ?? '').trim()
  if (!s) return []
  return s.split(/\s+/g).filter(Boolean)
}

export function TenantDetail() {
  const nav = useNavigate()
  const { id } = useParams()
  const apiClientId = toNumber(id)

  const [tab, setTab] = useState<TabKey>('UNIDADES')

  const [tenant, setTenant] = useState<ApiClientDetail | null>(null)
  const [vinculos, setVinculos] = useState<ApiClientUnidade[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)

  const [confirmToggle, setConfirmToggle] = useState<{ open: boolean }>({ open: false })
  const [confirmUnlink, setConfirmUnlink] = useState<{ open: boolean; unidadeId?: number }>({ open: false })

  // Campo operacional: outras unidades (sem pesquisa)
  const [outraUnidadeId, setOutraUnidadeId] = useState<string>('')
  const [linking, setLinking] = useState(false)

  // Somente UI (a API não retorna secret). Campo opcional para o operador colar e copiar.
  const [secretLocal, setSecretLocal] = useState<string>('')
  const [revealSecret, setRevealSecret] = useState(false)

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

  const scopesList = useMemo(() => chunkScopes(tenant?.escopos), [tenant?.escopos])

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
      setToast({
        kind: 'error',
        message: 'Esta unidade é a matriz (empresaId). Ela já deve estar vinculada automaticamente.',
      })
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

  function TabButton({ k, label }: { k: TabKey; label: string }) {
    const active = tab === k
    return (
      <button
        type="button"
        className={`awis-tab ${active ? 'awis-tab--active' : ''}`}
        onClick={() => setTab(k)}
        aria-current={active ? 'page' : undefined}
      >
        {label}
      </button>
    )
  }

  async function doCopy(label: string, value: string) {
    const ok = await copyToClipboard(value)
    setToast({
      kind: ok ? 'success' : 'error',
      message: ok ? `${label} copiado.` : `Não foi possível copiar ${label}.`,
    })
  }

  const envSnippet = useMemo(() => {
    const baseUrl = String((import.meta as any)?.env?.VITE_API_BASE_URL ?? 'https://SUA-API.EXEMPLO.COM')
    const clientId = tenant?.clientId ?? 'SEU_CLIENT_ID'
    const empresaId = tenant?.empresaId ?? 0

    return `# Exemplo de variáveis de ambiente / configuração do integrador
API_BASE_URL="${baseUrl}"

# Identificação do cliente (API Client)
CLIENT_ID="${clientId}"

# Segredo do cliente (não é retornado pela API por segurança)
CLIENT_SECRET="COLE_AQUI_O_CLIENT_SECRET"

# Header obrigatório nas chamadas: X-Progem-ID = empresaId (unidade)
X_PROGEM_ID="${empresaId || '274'}"

# Exemplo: Authorization (client credentials / token)
# AUTHORIZATION="Bearer SEU_TOKEN_AQUI"`
  }, [tenant?.clientId, tenant?.empresaId])

  const webhookGuide = useMemo(() => {
    return `Webhooks (em desenvolvimetno)`
  }, [])

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
        subtitle="Detalhes do API Client (tenants) e configurações operacionais."
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
            {/* Summary row */}
            <div className="awis-row awis-row--wrap" style={{ gap: 10 }}>
              <Badge>{tenant.ativo ? 'ATIVO' : 'INATIVO'}</Badge>

              <Badge variant="muted">
                clientId: <span className="awis-mono">{tenant.clientId}</span>
              </Badge>

              <Badge>
                X-Progem-ID (matriz): <span className="awis-mono">{tenant.empresaId}</span>
              </Badge>

              <Badge variant="muted">
                apiClientId: <span className="awis-mono">{tenant.id}</span>
              </Badge>

              <Button
                variant="ghost"
                onClick={() => doCopy('clientId', tenant.clientId)}
                title="Copiar clientId"
                aria-label="Copiar clientId"
              >
                Copiar clientId
              </Button>

              <Button
                variant="ghost"
                onClick={() => doCopy('X-Progem-ID', String(tenant.empresaId))}
                title="Copiar X-Progem-ID"
                aria-label="Copiar X-Progem-ID"
              >
                Copiar X-Progem-ID
              </Button>
            </div>

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

            {/* Tabs */}
            <div className="awis-tabs" role="tablist" aria-label="Seções do tenant">
              <TabButton k="UNIDADES" label="Unidades" />
              <TabButton k="CREDENCIAIS" label="Credenciais" />
              <TabButton k="WEBHOOKS" label="Webhooks" />
              <TabButton k="ENV" label=".env" />
              <TabButton k="IDENTIDADE" label="Identidade" />
            </div>

            <div className="awis-divider" />

            {/* TAB: UNIDADES */}
            {tab === 'UNIDADES' ? (
              <div className="awis-stack" style={{ gap: 14 }}>
                {/* MATRIZ */}
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

                {/* OUTRAS UNIDADES */}
                <div className="awis-grid-2">
                  <div>
                    <div className="awis-section-title">Vincular outras unidades</div>
                    <div className="awis-muted" style={{ marginTop: 4 }}>
                      Informe o <span className="awis-mono">unidadeId</span> (empresaId da unidade) para distribuir este
                      API Client para outras unidades além da matriz.
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
                      <Button variant="primary" onClick={vincularOutraUnidade} disabled={!outraUnidadeId.trim() || linking}>
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

                            <Button
                              variant="ghost"
                              onClick={() => setConfirmUnlink({ open: true, unidadeId: v.unidadeId })}
                            >
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

            {/* TAB: CREDENCIAIS */}
            {tab === 'CREDENCIAIS' ? (
              <div className="awis-stack" style={{ gap: 14 }}>
                <div>
                  <div className="awis-section-title">Credenciais</div>
                  <div className="awis-muted" style={{ marginTop: 4 }}>
                    As credenciais identificam o integrador (API Client). O <span className="awis-mono">clientSecret</span>{' '}
                    não é exibido pela API por segurança.
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
                        <Button variant="ghost" onClick={() => doCopy('clientId', tenant.clientId)}>
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
                        <Button variant="ghost" onClick={() => doCopy('X-Progem-ID', String(tenant.empresaId))}>
                          Copiar
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="awis-callout awis-callout--warn">
                    <div style={{ fontWeight: 700 }}>clientSecret</div>
                    <div className="awis-muted" style={{ marginTop: 6 }}>
                      Por padrão, este painel não lê o secret do backend. UX em desenvolvimento.
                    </div>

                    <div style={{ height: 10 }} />

                    <Input
                      label="clientSecret (local)"
                      placeholder="Cole aqui para copiar / testar"
                      value={secretLocal}
                      onChange={(e) => setSecretLocal(e.target.value)}
                      type={revealSecret ? 'text' : 'password'}
                      autoComplete="off"
                      rightSlot={
                        <button
                          type="button"
                          className="awis-input-action"
                          onClick={() => setRevealSecret((v) => !v)}
                          aria-label={revealSecret ? 'Ocultar clientSecret' : 'Mostrar clientSecret'}
                          title={revealSecret ? 'Ocultar' : 'Mostrar'}
                        >
                          {revealSecret ? 'Ocultar' : 'Mostrar'}
                        </button>
                      }
                    />

                    <div className="awis-row" style={{ gap: 10, marginTop: 10 }}>
                      <Button variant="ghost" onClick={() => setSecretLocal('')} disabled={!secretLocal}>
                        Limpar
                      </Button>
                      <Button variant="primary" onClick={() => doCopy('clientSecret', secretLocal)} disabled={!secretLocal}>
                        Copiar clientSecret
                      </Button>
                    </div>

                    <div className="hint" style={{ marginTop: 10 }}>
                      Recomendação: implementar “reset/rotate secret” no backend, com exibição única no momento da rotação.
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
                    <Button variant="ghost" onClick={() => doCopy('escopos', tenant.escopos ?? '')} disabled={!tenant.escopos}>
                      Copiar escopos
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* TAB: WEBHOOKS */}
            {tab === 'WEBHOOKS' ? (
              <div className="awis-stack" style={{ gap: 14 }}>
        

                <div className="awis-callout">
               

                  <div style={{ height: 10 }} />
                  <pre className="awis-code" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                    {webhookGuide}
                  </pre>
                </div>

               
                <div className="awis-divider" />
                <div className="awis-muted">
                  Configuração de endpoints para notificações de eventos.
                </div>
              </div>
            ) : null}

            {/* TAB: .env */}
            {tab === 'ENV' ? (
              <div className="awis-stack" style={{ gap: 14 }}>
                <div>
                  <div className="awis-section-title">.env / Integração</div>
                  <div className="awis-muted" style={{ marginTop: 4 }}>
                    Um arquivo pronto para o integrador configurar {' '}
                    <span className="awis-mono">X-Progem-ID</span>.
                  </div>
                </div>

                <div className="awis-callout">
              

                  <div style={{ height: 10 }} />Arquivo
                  <pre className="awis-code" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                    {envSnippet}
                  </pre>
                </div>

                <div className="awis-callout awis-callout--warn">
                  <div style={{ fontWeight: 700 }}>Regra de ouro</div>
                  <div className="awis-muted" style={{ marginTop: 6 }}>
                    O <span className="awis-mono">X-Progem-ID</span> é sempre o <span className="awis-mono">empresaId</span>{' '}
                    (unidade). O <span className="awis-mono">clientId</span> identifica o integrador. Não confundir.
                  </div>
                </div>
              </div>
            ) : null}

            {/* TAB: IDENTIDADE */}
            {tab === 'IDENTIDADE' ? (
              <div className="awis-stack" style={{ gap: 14 }}>
                <div>
                  <div className="awis-section-title">Identidade</div>
                  <div className="awis-muted" style={{ marginTop: 4 }}>
                    Identidade Visual com cores, imagens, ações e conteúdos.
                  </div>
                </div>

                <div className="awis-divider" />
                <div className="awis-muted">
                  Inicialmetne o json padrão e como sugestão de evolução a possibilidade de maior personalização feita pelo próprio implantador.
                </div>
              </div>
            ) : null}
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
