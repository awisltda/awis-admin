// src/pages/api-clients/ApiClientsPage.tsx
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../ui/Card'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { Badge } from '../../ui/Badge'
import { Toast } from '../../ui/Toast'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { http } from '../../api/http'
import { endpoints } from '../../api/endpoints'
import type { ApiClientResponse } from './types'

type ToastState = { kind: 'success' | 'error'; message: string } | null

function isValidClientId(v: string) {
  return /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(v)
}

/**
 * Domínio: aceitamos "https://x.com/", "x.com", "sub.x.com.br"
 * Guardamos normalizado (sem protocolo e sem barra final).
 */
function normalizeDomain(raw: string) {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return ''
  let d = s.replace(/^https?:\/\//, '')
  while (d.endsWith('/')) d = d.slice(0, -1)
  return d.trim()
}

function toHttpUrl(domain: string) {
  const d = normalizeDomain(domain)
  if (!d) return ''
  return `https://${d}`
}

/**
 * UX: feedback claro. Prioriza message do backend (ApiExceptionHandler),
 * com fallback para axios/fetch errors.
 */
function extractApiMessage(e: any, fallback: string) {
  const apiMsg =
    e?.response?.data?.message ??
    e?.data?.message ??
    e?.message ??
    (typeof e === 'string' ? e : null)

  if (apiMsg && String(apiMsg).trim()) return String(apiMsg)

  const status = e?.response?.status
  if (status === 409) return 'Conflito de dados. Verifique clientId, X-Progem-ID (empresaId) e domínio.'
  if (status === 400) return 'Dados inválidos. Verifique os campos e tente novamente.'
  if (status === 401) return 'Não autenticado. Faça login novamente.'
  if (status === 403) return 'Sem permissão para esta ação.'
  return fallback
}

function toNumberSafe(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function ApiClientsPage() {
  const [items, setItems] = useState<ApiClientResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [toast, setToast] = useState<ToastState>(null)
  const [revealSecret, setRevealSecret] = useState(false)

  const SCOPE_OPTIONS = useMemo(
    () =>
      [
        'read:unidades',
        'read:pessoas',
        'write:pessoas',
        'read:contratos',
        'write:contratos',
        'read:dependentes',
        'write:dependentes',
        'read:duplicatas',
        'read:planos',
        'read:parceiros',
        'read:notas',
        'write:notas',
      ] as const,
    []
  )

  const [editor, setEditor] = useState<{
    open: boolean
    mode?: 'NEW' | 'EDIT'
    loading?: boolean
    id?: number
    nome?: string
    clientId?: string
    empresaId?: string
    dominio?: string
    clientSecret?: string
    scopes?: string[]
    ativo?: boolean
    originalAtivo?: boolean
  }>({ open: false })

  const [confirm, setConfirm] = useState<{
    open: boolean
    id?: number
    nextAtivo?: boolean
    name?: string
  }>({ open: false })

  async function load() {
    setLoading(true)
    try {
      const data = await http.get<ApiClientResponse[]>(endpoints.apiClients())
      setItems(Array.isArray(data) ? data : [])
    } catch (e: any) {
      setToast({ kind: 'error', message: extractApiMessage(e, 'Falha ao carregar API Clients.') })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function openNew() {
    setQ('')
    setRevealSecret(false)
    setEditor({
      open: true,
      mode: 'NEW',
      nome: '',
      clientId: '',
      empresaId: '',
      dominio: '',
      clientSecret: '',
      scopes: [...SCOPE_OPTIONS],
      ativo: true,
    })
  }

  function openEdit(it: ApiClientResponse) {
    setRevealSecret(false)
    setEditor({
      open: true,
      mode: 'EDIT',
      id: it.id,
      nome: it.nome ?? '',
      clientId: it.clientId ?? '',
      empresaId: it.empresaId != null ? String(it.empresaId) : '',
      dominio: it.dominio ?? '',
      clientSecret: '',
      scopes: [...SCOPE_OPTIONS],
      ativo: !!it.ativo,
      originalAtivo: !!it.ativo,
    })
  }

  function closeEditor() {
    if (editor.mode === 'NEW') setQ('')
    setRevealSecret(false)
    setEditor({ open: false })
  }

  async function saveEditor() {
    const nome = (editor.nome ?? '').trim()
    const clientId = (editor.clientId ?? '').trim().toLowerCase()

    const empresaIdRaw = (editor.empresaId ?? '').trim()
    const empresaId = Number(empresaIdRaw)

    const dominio = normalizeDomain(editor.dominio ?? '')

    const clientSecret = (editor.clientSecret ?? '').trim()
    const scopesList = (editor.scopes ?? []).filter(Boolean)
    const escopos = scopesList.join(' ').trim()

    if (!nome) {
      setToast({ kind: 'error', message: 'Informe o nome do tenant.' })
      return
    }
    if (!clientId) {
      setToast({ kind: 'error', message: 'Informe o clientId do tenant.' })
      return
    }
    if (!isValidClientId(clientId)) {
      setToast({
        kind: 'error',
        message: 'clientId inválido. Use minúsculas, números e hífen (ex: "pax-santacruz").',
      })
      return
    }
    if (!empresaIdRaw || !Number.isFinite(empresaId) || empresaId <= 0) {
      setToast({ kind: 'error', message: 'Informe um X-Progem-ID (empresaId) válido (ex: 128).' })
      return
    }

    if (dominio) {
      if (dominio.includes(' ') || dominio.length < 4 || !dominio.includes('.')) {
        setToast({
          kind: 'error',
          message: 'Domínio inválido. Use algo como "empresa.com.br" (sem http://).',
        })
        return
      }
    }

    if (editor.mode !== 'EDIT') {
      if (!clientSecret || clientSecret.length < 8) {
        setToast({ kind: 'error', message: 'Informe um clientSecret com pelo menos 8 caracteres.' })
        return
      }
      if (!escopos) {
        setToast({ kind: 'error', message: 'Selecione ao menos 1 escopo de acesso.' })
        return
      }
    }

    setEditor((s) => ({ ...s, loading: true }))
    try {
      if (editor.mode === 'EDIT' && editor.id) {
        const payload: any = {
          nome,
          clientId,
          empresaId,
          escopos,
          dominio: dominio || null,
        }
        if (clientSecret) payload.clientSecret = clientSecret

        await http.put<ApiClientResponse>(endpoints.apiClientUpdate(editor.id), payload)

        const nextAtivo = editor.ativo !== false
        if (editor.originalAtivo != null && editor.originalAtivo !== nextAtivo) {
          await http.patch<ApiClientResponse>(endpoints.apiClientStatus(editor.id, nextAtivo))
        }

        setQ(String(empresaId))
        setToast({ kind: 'success', message: 'Tenant atualizado com sucesso.' })
      } else {
        const payload = {
          nome,
          clientId,
          clientSecret,
          escopos,
          empresaId,
          dominio: dominio || null,
        }
        await http.post<ApiClientResponse>(endpoints.apiClientCreate(), payload)

        // ✅ após criar, filtra pelo X-Progem-ID
        setQ(String(empresaId))
        setToast({ kind: 'success', message: 'Tenant criado com sucesso.' })
      }

      closeEditor()
      await load()
    } catch (e: any) {
      setToast({ kind: 'error', message: extractApiMessage(e, 'Falha ao salvar tenant.') })
      setEditor((s) => ({ ...s, loading: false }))
    }
  }

  function toggleScope(scope: string) {
    setEditor((s) => {
      const cur = new Set<string>(s.scopes ?? [])
      if (cur.has(scope)) cur.delete(scope)
      else cur.add(scope)
      return { ...s, scopes: Array.from(cur) }
    })
  }

  function selectAllScopes() {
    setEditor((s) => ({ ...s, scopes: [...SCOPE_OPTIONS] }))
  }

  function clearScopes() {
    setEditor((s) => ({ ...s, scopes: [] }))
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return items
    return items.filter((x) => {
      const name = String(x.nome ?? '').toLowerCase()
      const clientId = String(x.clientId ?? '').toLowerCase()
      const empresaId = String(x.empresaId ?? '')
      const dominio = String(x.dominio ?? '').toLowerCase()
      return name.includes(s) || clientId.includes(s) || empresaId.includes(s) || dominio.includes(s)
    })
  }, [items, q])

  const stats = useMemo(() => {
    const total = items.length
    const ativo = items.filter((x) => !!x.ativo).length
    const inativo = total - ativo
    return { total, ativo, inativo }
  }, [items])

  function askToggle(item: ApiClientResponse) {
    setConfirm({
      open: true,
      id: item.id,
      nextAtivo: !item.ativo,
      name: item.nome ?? `#${item.id}`,
    })
  }

  async function doToggle() {
    const id = confirm.id
    const nextAtivo = confirm.nextAtivo
    if (!id || nextAtivo === undefined) return

    setConfirm({ open: false })

    try {
      await http.patch<ApiClientResponse>(endpoints.apiClientStatus(id, nextAtivo))
      setToast({ kind: 'success', message: `Status atualizado: ${nextAtivo ? 'ATIVO' : 'INATIVO'}.` })
      await load()
    } catch (e: any) {
      setToast({ kind: 'error', message: extractApiMessage(e, 'Falha ao alterar status.') })
    }
  }

  const showTable = !loading && filtered.length > 0
  const showEmpty = !loading && filtered.length === 0

  const escoposPreview = useMemo(() => (editor.scopes ?? []).join(' ') || '—', [editor.scopes])

  return (
    <div className="awis-stack">
      {toast ? <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} /> : null}

      <Card
        title="Tenants"
        subtitle="Cadastro e controle de clientes da API (tenants)."
        right={
          <div className="awis-row" style={{ gap: 10 }}>
            <Button variant="ghost" onClick={load} disabled={loading}>
              {loading ? 'Atualizando...' : 'Recarregar'}
            </Button>
            <Button variant="primary" onClick={openNew}>
              Novo tenant
            </Button>
          </div>
        }
      >
        {/* KPI row */}
        <div className="awis-row awis-row--wrap" style={{ gap: 10, alignItems: 'center' }}>
          <Badge variant="muted">
            Total: <span className="awis-mono">{stats.total}</span>
          </Badge>
          <Badge>
            Ativos: <span className="awis-mono">{stats.ativo}</span>
          </Badge>
          <Badge variant="muted">
            Inativos: <span className="awis-mono">{stats.inativo}</span>
          </Badge>
        </div>

        <div style={{ height: 12 }} />

        <div className="awis-row awis-row--wrap" style={{ gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Input
              label="Buscar"
              placeholder="Buscar por nome, clientId, X-Progem-ID ou domínio…"
              name="tenant-search"
              autoComplete="off"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div style={{ height: 14 }} />

        {loading ? (
          <div className="awis-state">
            <div className="awis-state-title">Carregando clientes…</div>
            <div className="awis-state-sub">Aguarde um instante.</div>

            <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
              <div className="awis-skeleton" style={{ width: '62%' }} />
              <div className="awis-skeleton" style={{ width: '86%' }} />
              <div className="awis-skeleton" style={{ width: '74%' }} />
              <div className="awis-skeleton" style={{ width: '80%' }} />
            </div>
          </div>
        ) : null}

        {showEmpty ? (
          <div className="awis-state">
            <div className="awis-state-title">Nenhum resultado</div>
            <div className="awis-state-sub">
              {q.trim()
                ? 'Não encontramos nenhum API Client com este termo. Tente buscar por clientId, X-Progem-ID ou domínio.'
                : 'Ainda não há API Clients cadastrados.'}
            </div>
          </div>
        ) : null}

        {showTable ? (
          <div
            className="awis-table"
            role="table"
            aria-label="Lista de tenants"
            // ✅ colunas: X-Progem-ID | Domínio | Nome | Status | Ações
            style={{ ['--cols' as any]: '140px 260px 1.1fr 130px 220px' }}
          >
            <div className="awis-tr awis-th" role="row">
              <div role="columnheader">X-Progem-ID</div>
              <div role="columnheader">Domínio</div>
              <div role="columnheader">Nome</div>
              <div role="columnheader">Status</div>
              <div role="columnheader" style={{ textAlign: 'right' }}>
                Ações
              </div>
            </div>

            {filtered.map((it) => {
              const domainRaw = String(it.dominio ?? '')
              const domain = normalizeDomain(domainRaw)
              const url = domain ? toHttpUrl(domain) : ''
              return (
                <div key={it.id} className="awis-tr" role="row">
                  <div data-label="X-Progem-ID" className="awis-mono" role="cell">
                    {it.empresaId != null ? it.empresaId : <span className="awis-muted">—</span>}
                  </div>

                  <div data-label="Domínio" role="cell">
                    {domain ? (
                      <a
                        className="awis-link"
                        href={url}
                        target="_blank"
                        rel="noreferrer noopener"
                        title={`Abrir ${url}`}
                        style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}
                      >
                        <span className="awis-mono" style={{ fontSize: 12 }}>
                          {domain}
                        </span>
                      </a>
                    ) : (
                      <span className="awis-muted">—</span>
                    )}
                  </div>

                  <div data-label="Nome" className="awis-cell-name" role="cell">
                    {it.nome ? (
                      <Link className="awis-link" to={`/api-clients/${it.id}`}>
                        {it.nome}
                      </Link>
                    ) : (
                      <span className="awis-muted">—</span>
                    )}

                    {/* ✅ Removido o domínio daqui (fica apenas na 2ª coluna) */}
                    <div className="awis-muted" style={{ fontSize: 12, marginTop: 2 }}>
                      clientId: <span className="awis-mono">{it.clientId}</span>
                      <span className="awis-muted"> · </span>
                      X-Progem-ID: <span className="awis-mono">{it.empresaId ?? '—'}</span>
                    </div>
                  </div>

                  <div data-label="Status" role="cell">
                    {it.ativo ? <Badge>ATIVO</Badge> : <Badge variant="muted">INATIVO</Badge>}
                  </div>

                  <div data-label="Ações" className="awis-cell-actions" role="cell">
                    <Button variant="ghost" onClick={() => openEdit(it)}>
                      Editar
                    </Button>
                    <Button variant={it.ativo ? 'danger' : 'primary'} onClick={() => askToggle(it)}>
                      {it.ativo ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
      </Card>

      {/* Modal Create / Edit */}
      {editor.open ? (
        <div className="awis-modal-backdrop" role="dialog" aria-modal="true">
          <div className="awis-modal">
            <Card
              title={editor.mode === 'EDIT' ? 'Editar tenant' : 'Novo tenant'}
              subtitle="Edite nome, clientId, X-Progem-ID (empresaId), domínio, escopos e (opcionalmente) o clientSecret."
              right={
                <Button variant="ghost" onClick={closeEditor} disabled={!!editor.loading}>
                  Fechar
                </Button>
              }
            >
              <div className="awis-modal-scroll">
                <div className="awis-stack" style={{ gap: 14 }}>
                  {/* Context chips */}
                  <div className="awis-row awis-row--wrap" style={{ gap: 10 }}>
                    <Badge variant="muted">
                      Modo: <span className="awis-mono">{editor.mode === 'EDIT' ? 'EDIT' : 'NEW'}</span>
                    </Badge>
                    {editor.mode === 'EDIT' && editor.id != null ? (
                      <Badge variant="muted">
                        apiClientId: <span className="awis-mono">{editor.id}</span>
                      </Badge>
                    ) : null}
                    {editor.empresaId ? (
                      <Badge>
                        X-Progem-ID: <span className="awis-mono">{editor.empresaId}</span>
                      </Badge>
                    ) : null}
                    {normalizeDomain(editor.dominio ?? '') ? (
                      <Badge variant="muted">
                        domínio: <span className="awis-mono">{normalizeDomain(editor.dominio ?? '')}</span>
                      </Badge>
                    ) : null}
                  </div>

                  <Input
                    label="Nome"
                    placeholder="Ex: FUNERÁRIA SÃO BENTO"
                    name="tenant-nome"
                    autoComplete="off"
                    value={editor.nome ?? ''}
                    onChange={(e) => setEditor((s) => ({ ...s, nome: e.target.value }))}
                    disabled={!!editor.loading}
                  />

                  <div className="awis-grid-2" style={{ gap: 14 }}>
                    <Input
                      label="clientId"
                      placeholder="ex: saobento"
                      name="tenant-clientId"
                      autoComplete="off"
                      value={editor.clientId ?? ''}
                      onChange={(e) => setEditor((s) => ({ ...s, clientId: e.target.value.toLowerCase() }))}
                      disabled={!!editor.loading}
                    />

                    <Input
                      label="X-Progem-ID (empresaId)"
                      placeholder="ex: 128"
                      name="tenant-empresaId"
                      autoComplete="off"
                      inputMode="numeric"
                      value={editor.empresaId ?? ''}
                      onChange={(e) => setEditor((s) => ({ ...s, empresaId: e.target.value }))}
                      disabled={!!editor.loading}
                    />
                  </div>

                  <Input
                    label="Domínio (opcional)"
                    placeholder='ex: "empresa.com.br" (sem http://)'
                    name="tenant-dominio"
                    autoComplete="off"
                    value={editor.dominio ?? ''}
                    onChange={(e) => setEditor((s) => ({ ...s, dominio: e.target.value }))}
                    disabled={!!editor.loading}
                  />
                  <div className="hint" style={{ marginTop: -6 }}>
                    Se informado, o domínio é normalizado (remove <span className="awis-mono">http(s)://</span> e barra
                    final). Recomendado manter único por tenant.
                  </div>

                  <Input
                    label={editor.mode === 'EDIT' ? 'clientSecret (opcional)' : 'clientSecret'}
                    placeholder={editor.mode === 'EDIT' ? 'Deixe em branco para manter o atual' : 'Ex: SENHA_SUPER_FORTE'}
                    name="tenant-clientSecret"
                    autoComplete="new-password"
                    value={editor.clientSecret ?? ''}
                    onChange={(e) => setEditor((s) => ({ ...s, clientSecret: e.target.value }))}
                    disabled={!!editor.loading}
                    type={revealSecret ? 'text' : 'password'}
                    rightSlot={
                      <button
                        type="button"
                        className="awis-input-action"
                        onClick={() => setRevealSecret((v) => !v)}
                        disabled={!!editor.loading}
                        aria-label={revealSecret ? 'Ocultar clientSecret' : 'Mostrar clientSecret'}
                        title={revealSecret ? 'Ocultar' : 'Mostrar'}
                      >
                        {revealSecret ? 'Ocultar' : 'Mostrar'}
                      </button>
                    }
                  />

                  <div className="hint" style={{ marginTop: -6 }}>
                    {editor.mode === 'EDIT'
                      ? 'Para manter o clientSecret atual, deixe este campo em branco.'
                      : 'Guarde este clientSecret com segurança. Ele será usado na autenticação do cliente.'}
                  </div>

                  <details className="awis-details" open>
                    <summary className="awis-details-summary">
                      <div>
                        <div style={{ fontWeight: 700 }}>Escopos</div>
                        <div className="awis-muted" style={{ fontSize: 12, marginTop: 2 }}>
                          Definem quais recursos a integração poderá consumir.
                        </div>
                      </div>
                      <div className="awis-row" style={{ gap: 10 }}>
                        <Button
                          variant="ghost"
                          onClick={(e) => {
                            e.preventDefault()
                            selectAllScopes()
                          }}
                          disabled={!!editor.loading}
                        >
                          Selecionar tudo
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={(e) => {
                            e.preventDefault()
                            clearScopes()
                          }}
                          disabled={!!editor.loading}
                        >
                          Limpar
                        </Button>
                      </div>
                    </summary>

                    <div className="awis-scope-box">
                      <div className="awis-grid awis-scope-grid">
                        {SCOPE_OPTIONS.map((s) => {
                          const checked = (editor.scopes ?? []).includes(s)
                          return (
                            <label
                              key={s}
                              className="awis-row"
                              style={{ gap: 10, userSelect: 'none', padding: '8px 10px', borderRadius: 12 }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleScope(s)}
                                disabled={!!editor.loading}
                              />
                              <span className="awis-mono" style={{ fontSize: 12 }}>
                                {s}
                              </span>
                            </label>
                          )
                        })}
                      </div>

                      <div className="awis-muted" style={{ fontSize: 12, marginTop: 10 }}>
                        Escopos selecionados: <span className="awis-mono">escopos</span> ={' '}
                        <span className="awis-mono">{escoposPreview}</span>
                      </div>
                    </div>
                  </details>

                  <div className="awis-row" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <label className="awis-row" style={{ gap: 10, userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={editor.ativo !== false}
                        onChange={(e) => setEditor((s) => ({ ...s, ativo: e.target.checked }))}
                        disabled={!!editor.loading}
                      />
                      <span style={{ fontWeight: 600 }}>Ativo</span>
                    </label>

                    <div className="awis-row" style={{ gap: 10 }}>
                      <Button variant="primary" onClick={saveEditor} disabled={!!editor.loading}>
                        {editor.loading ? 'Salvando…' : 'Salvar'}
                      </Button>
                    </div>
                  </div>

                  <div className="awis-muted" style={{ fontSize: 12 }}>
                    <span className="awis-mono">clientId</span>:{' '}
                    <span className="awis-mono">{editor.clientId && isValidClientId(editor.clientId) ? 'ok' : '—'}</span>
                    <span className="awis-muted"> · </span>
                    <span className="awis-mono">X-Progem-ID</span>:{' '}
                    <span className="awis-mono">{toNumberSafe(editor.empresaId) > 0 ? 'ok' : '—'}</span>
                    <span className="awis-muted"> · </span>
                    <span className="awis-mono">domínio</span>:{' '}
                    <span className="awis-mono">{normalizeDomain(editor.dominio ?? '') ? 'ok' : '—'}</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm.open}
        title={`${confirm.nextAtivo ? 'Ativar' : 'Desativar'} API Client`}
        description={
          confirm.nextAtivo
            ? `Confirma ativar o cliente "${confirm.name}"?`
            : `Confirma desativar o cliente "${confirm.name}"? Essa ação pode impactar integrações e acessos.`
        }
        confirmText={confirm.nextAtivo ? 'Ativar' : 'Desativar'}
        danger={!confirm.nextAtivo}
        onConfirm={doToggle}
        onClose={() => setConfirm({ open: false })}
      />
    </div>
  )
}
