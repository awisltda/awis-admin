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

export function ApiClientsPage() {
  const [items, setItems] = useState<ApiClientResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [toast, setToast] = useState<ToastState>(null)

  // Escopos conhecidos (UX: seleção guiada + preview do payload)
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
    clientSecret?: string
    scopes?: string[]
    ativo?: boolean
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
      setToast({ kind: 'error', message: e?.message ?? 'Falha ao carregar API Clients.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function openNew() {
    setEditor({
      open: true,
      mode: 'NEW',
      nome: '',
      clientId: '',
      empresaId: '',
      clientSecret: '',
      // Por padrão, liberamos a suíte completa de escopos atuais.
      // Ajuste conforme o tipo de integração do parceiro.
      scopes: [...SCOPE_OPTIONS],
      ativo: true,
    })
  }

  function openEdit(it: ApiClientResponse) {
    setEditor({
      open: true,
      mode: 'EDIT',
      id: it.id,
      nome: it.nome ?? '',
      clientId: it.clientId ?? '',
      // Edição completa ainda não existe na API (por enquanto, apenas status).
      // Mantemos os campos para reutilizar a mesma tela de criação.
      empresaId: '',
      clientSecret: '',
      scopes: [...SCOPE_OPTIONS],
      ativo: !!it.ativo,
      originalAtivo: !!it.ativo,
    })
  }

  function closeEditor() {
    setEditor({ open: false })
  }

  async function saveEditor() {
    const nome = (editor.nome ?? '').trim()
    const clientId = (editor.clientId ?? '').trim()

    const isCreate = editor.mode !== 'EDIT'
    const empresaIdRaw = (editor.empresaId ?? '').trim()
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
    if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(clientId)) {
      setToast({
        kind: 'error',
        message:
          'clientId inválido. Use minúsculas, números e hífen (ex: "pax-santacruz").',
      })
      return
    }

    if (isCreate) {
      const empresaId = Number(empresaIdRaw)
      if (!empresaIdRaw || !Number.isFinite(empresaId) || empresaId <= 0) {
        setToast({ kind: 'error', message: 'Informe um empresaId válido (ex: 274).' })
        return
      }
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
        // Importante: ainda não existe endpoint de update completo do tenant.
        // Para evitar "Method Not Allowed", tratamos aqui apenas a atualização de STATUS.
        const nextAtivo = editor.ativo !== false

        if (editor.originalAtivo != null && editor.originalAtivo !== nextAtivo) {
          await http.patch(endpoints.apiClientToggleStatus(editor.id), { ativo: nextAtivo })
          setToast({ kind: 'success', message: 'Status do tenant atualizado com sucesso.' })
        } else {
          setToast({ kind: 'success', message: 'Nenhuma alteração para salvar.' })
        }
      } else {
        const payload = {
          nome,
          clientId,
          clientSecret,
          escopos,
          empresaId: Number(empresaIdRaw),
        }
        const created = await http.post<ApiClientResponse>(endpoints.apiClientCreate(), payload)
        // UX: ao criar, filtra automaticamente pelo ID recém criado
        if (created?.id != null) setQ(String(created.id))
        setToast({ kind: 'success', message: 'Tenant criado com sucesso.' })
      }
      closeEditor()
      await load()
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message ?? 'Falha ao salvar tenant.' })
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
      const id = String(x.id ?? '')
      return name.includes(s) || id.includes(s)
    })
  }, [items, q])

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
      setToast({
        kind: 'success',
        message: `Status atualizado: ${nextAtivo ? 'ATIVO' : 'INATIVO'}.`,
      })
      await load()
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message ?? 'Falha ao alterar status.' })
    }
  }

  const showTable = !loading && filtered.length > 0
  const showEmpty = !loading && filtered.length === 0

  return (
    <div className="awis-stack">
      {toast ? <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} /> : null}

      <Card
        title="Tenants"
        subtitle="Cadastro e controle de clientes da API (tenants)."
        right={
          <Button variant="primary" onClick={openNew}>
            Novo tenant
          </Button>
        }
      >
        <div className="awis-row awis-row--wrap" style={{ gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Input
              label="Buscar"
              placeholder="Buscar por nome ou ID..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <Button variant="ghost" onClick={load} disabled={loading}>
            {loading ? 'Atualizando...' : 'Recarregar'}
          </Button>
        </div>

        <div style={{ height: 14 }} />

        {/* Loading premium */}
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

        {/* Empty premium */}
        {showEmpty ? (
          <div className="awis-state">
            <div className="awis-state-title">Nenhum resultado</div>
            <div className="awis-state-sub">
              {q.trim()
                ? 'Não encontramos nenhum API Client com este termo. Tente buscar por ID ou outro nome.'
                : 'Ainda não há API Clients cadastrados.'}
            </div>
          </div>
        ) : null}

        {/* Table */}
        {showTable ? (
          <div className="awis-table" role="table" aria-label="Lista de tenants" style={{ ['--cols' as any]: '90px 1.2fr 130px 220px' }}>
            <div className="awis-tr awis-th" role="row">
              <div role="columnheader">ID</div>
              <div role="columnheader">Nome</div>
              <div role="columnheader">Status</div>
              <div role="columnheader" style={{ textAlign: 'right' }}>
                Ações
              </div>
            </div>

            {filtered.map((it) => (
              <div key={it.id} className="awis-tr" role="row">
                <div data-label="ID" className="awis-mono" role="cell">
                  {it.id}
                </div>

                <div data-label="Nome" className="awis-cell-name" role="cell">
                  {it.nome ? (
                    <Link className="awis-link" to={`/api-clients/${it.id}`}>
                      {it.nome}
                    </Link>
                  ) : (
                    <span className="awis-muted">—</span>
                  )}
                  <div className="awis-muted" style={{ fontSize: 12, marginTop: 2 }}>
                    clientId: <span className="awis-mono">{it.clientId}</span>
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
            ))}
          </div>
        ) : null}
      </Card>

      {/* Modal Create / Edit */}
      {editor.open ? (
        <div className="awis-modal-backdrop" role="dialog" aria-modal="true">
          <div className="awis-modal">
            <Card
              title={editor.mode === 'EDIT' ? 'Editar tenant' : 'Novo tenant'}
              subtitle="Nome e clientId determinam a identificação do tenant na integração."
              right={
                <Button variant="ghost" onClick={closeEditor} disabled={!!editor.loading}>
                  Fechar
                </Button>
              }
            >
              <div className="awis-modal-scroll">
                <div className="awis-stack" style={{ gap: 12 }}>
                <Input
                  label="Nome"
                  placeholder="Ex: FUNERÁRIA SÃO BENTO"
                  value={editor.nome ?? ''}
                  onChange={(e) => setEditor((s) => ({ ...s, nome: e.target.value }))}
                  disabled={!!editor.loading}
                />
                <Input
                  label="clientId"
                  placeholder="ex: saobento"
                  value={editor.clientId ?? ''}
                  onChange={(e) => setEditor((s) => ({ ...s, clientId: e.target.value.toLowerCase() }))}
                  disabled={!!editor.loading || editor.mode === 'EDIT'}
                />

                {editor.mode !== 'EDIT' ? (
                  <div className="awis-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Input
                      label="empresaId"
                      placeholder="ex: 274"
                      value={editor.empresaId ?? ''}
                      onChange={(e) => setEditor((s) => ({ ...s, empresaId: e.target.value }))}
                      disabled={!!editor.loading}
                    />
                    <Input
                      label="clientSecret"
                      placeholder="Ex: SENHA_SUPER_FORTE"
                      value={editor.clientSecret ?? ''}
                      onChange={(e) => setEditor((s) => ({ ...s, clientSecret: e.target.value }))}
                      disabled={!!editor.loading}
                      type="password"
                    />
                  </div>
                ) : null}

                {editor.mode !== 'EDIT' ? (
                  <details className="awis-details" open>
                    <summary className="awis-details-summary">
                      <div>
                        <div style={{ fontWeight: 700 }}>Escopos</div>
                        <div className="awis-muted" style={{ fontSize: 12, marginTop: 2 }}>
                          Definem quais recursos a integração poderá consumir.
                        </div>
                      </div>
                      <div className="awis-row" style={{ gap: 10 }}>
                        <Button variant="ghost" onClick={(e) => { e.preventDefault(); selectAllScopes() }} disabled={!!editor.loading}>
                          Selecionar tudo
                        </Button>
                        <Button variant="ghost" onClick={(e) => { e.preventDefault(); clearScopes() }} disabled={!!editor.loading}>
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
                            <span className="awis-mono" style={{ fontSize: 12 }}>{s}</span>
                          </label>
                        )
                      })}
                    </div>

                    <div className="awis-muted" style={{ fontSize: 12, marginTop: 10 }}>
                      Payload gerado: <span className="awis-mono">escopos</span> ={' '}
                      <span className="awis-mono">{(editor.scopes ?? []).join(' ') || '—'}</span>
                    </div>
                    </div>
                  </details>
                ) : null}

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
