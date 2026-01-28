import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../ui/Card'
import { Input } from '../../ui/Input'
import { Select } from '../../ui/Select'
import { Button } from '../../ui/Button'
import { Badge } from '../../ui/Badge'
import { Toast } from '../../ui/Toast'
import { http } from '../../api/http'
import { endpoints } from '../../api/endpoints'
import { useAuth } from '../../auth/AuthContext'
import type { AdminUserListItem, PageResponse, RolesResponse, UsuarioAppRoleName, UsuarioStatus } from './types'

type ToastState = { kind: 'success' | 'error'; message: string } | null

const ROLE_OPTIONS: UsuarioAppRoleName[] = ['AWIS', 'ADM', 'PARCEIRO', 'ASSOCIADO']

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

function fmtDate(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR')
}

export function UsersPage() {
  const { payload, empresaId } = useAuth()
  const roles = payload?.roles ?? []
  const isAwis = roles.includes('AWIS')

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<AdminUserListItem[]>([])
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)
  const [total, setTotal] = useState<number | null>(null)

  const [q, setQ] = useState('')
  // default da tela: ATIVO
  const [status, setStatus] = useState<UsuarioStatus | ''>('ATIVO')
  const [role, setRole] = useState<UsuarioAppRoleName | ''>('')
  const [empresaFilter, setEmpresaFilter] = useState<string>(() => (isAwis ? '' : String(empresaId || '')))

  const [toast, setToast] = useState<ToastState>(null)

  function clearFilters() {
    setQ('')
    // ao limpar, volta para o padrão da tela
    setStatus('ATIVO')
    setRole('')
    setEmpresaFilter(isAwis ? '' : String(empresaId || ''))
    load({ page: 0 })
  }

  const [rolesModal, setRolesModal] = useState<{
    open: boolean
    user?: AdminUserListItem
    loading?: boolean
    roles?: UsuarioAppRoleName[]
  }>({ open: false })

  async function load(next?: { page?: number; size?: number }) {
    const nextPage = next?.page ?? page
    const nextSize = next?.size ?? size
    setLoading(true)
    try {
      const data = await http.get<PageResponse<AdminUserListItem>>(
        endpoints.adminUsers({
          q,
          status: status || undefined,
          role: role || undefined,
          empresaId: isAwis ? (empresaFilter.trim() || undefined) : empresaId,
          page: nextPage,
          size: nextSize,
          sort: 'id,desc',
        })
      )

      const content = Array.isArray(data?.content) ? data.content : Array.isArray(data as any) ? (data as any) : []
      setItems(content)
      setTotal(typeof data?.totalElements === 'number' ? data.totalElements : null)
      setPage(typeof data?.number === 'number' ? data.number : nextPage)
      setSize(typeof data?.size === 'number' ? data.size : nextSize)
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message ?? 'Falha ao carregar usuários.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // primeira carga (já com status ATIVO)
    load({ page: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Quando filtros mudam, volta para página 0 (manual pelo botão “Buscar” para UX mais previsível)

  const pageInfo = useMemo(() => {
    if (total == null) return null
    const from = page * size + 1
    const to = Math.min(total, (page + 1) * size)
    return { total, from: Math.min(from, to), to }
  }, [total, page, size])

  const canPrev = page > 0
  const canNext = total == null ? items.length === size : (page + 1) * size < total

  async function openRoles(u: AdminUserListItem) {
    setRolesModal({ open: true, user: u, loading: true, roles: [] })
    try {
      const res = await http.get<RolesResponse>(endpoints.adminUserRoles(u.id))
      setRolesModal({ open: true, user: u, loading: false, roles: uniq(res?.roles ?? []) })
    } catch (e: any) {
      setRolesModal({ open: true, user: u, loading: false, roles: [] })
      setToast({ kind: 'error', message: e?.message ?? 'Falha ao carregar roles.' })
    }
  }

  function closeRoles() {
    setRolesModal({ open: false })
  }

  async function toggleRole(u: AdminUserListItem, r: UsuarioAppRoleName, enabled: boolean) {
    try {
      if (enabled) {
        await http.del(endpoints.adminUserRemoveRole(u.id, r))
      } else {
        await http.post(endpoints.adminUserAddRole(u.id, r))
      }

      // Recarrega roles e lista (para refletir badges e governança)
      const res = await http.get<RolesResponse>(endpoints.adminUserRoles(u.id))
      const nextRoles = uniq(res?.roles ?? [])
      setRolesModal((s) => ({ ...s, roles: nextRoles }))

      // Atualiza rapidamente o item em memória
      setItems((prev) => prev.map((x) => (x.id === u.id ? { ...x, roles: nextRoles } : x)))

      setToast({ kind: 'success', message: 'Roles atualizadas com sucesso.' })
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message ?? 'Falha ao atualizar role.' })
    }
  }

  const showTable = !loading && items.length > 0
  const showEmpty = !loading && items.length === 0

  return (
    <div className="awis-stack">
      {toast ? <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} /> : null}

      <Card title="Usuários" subtitle="Gestão de usuários do App e atribuição de roles (AWIS / ADM).">
        <div className="awis-row awis-row--wrap" style={{ gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <Input
              label="Buscar"
              placeholder="Nome, e-mail, CPF ou ID..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div style={{ width: 180 }}>
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="">Todos</option>
              <option value="ATIVO">ATIVO</option>
              <option value="INATIVO">INATIVO</option>
              <option value="PENDENTE">PENDENTE</option>
            </Select>
          </div>

          <div style={{ width: 180 }}>
            <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as any)}>
              <option value="">Todas</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>

          {isAwis ? (
            <div style={{ width: 160 }}>
              <Input
                label="Empresa"
                placeholder="ex: 128"
                inputMode="numeric"
                value={empresaFilter}
                onChange={(e) => setEmpresaFilter(e.target.value)}
              />
            </div>
          ) : null}

          <div style={{ width: 160 }}>
            <Select
              label="Por página"
              value={String(size)}
              onChange={(e) => {
                const next = Number(e.target.value)
                setSize(next)
                load({ page: 0, size: next })
              }}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>

          <Button variant="primary" onClick={() => load({ page: 0 })} disabled={loading}>
            {loading ? 'Buscando...' : 'Buscar'}
          </Button>

          <Button variant="ghost" onClick={() => load()} disabled={loading}>
            Recarregar
          </Button>

          <Button variant="ghost" onClick={clearFilters} disabled={loading}>
            Limpar filtros
          </Button>
        </div>

        {/* chips ativos */}
        {(q || status || role || (isAwis && empresaFilter.trim())) ? (
          <div className="awis-row awis-row--wrap" style={{ gap: 8, marginTop: 10 }}>
            {q ? <Badge variant="muted">Busca: {q}</Badge> : null}
            {status ? <Badge variant="muted">Status: {status}</Badge> : null}
            {role ? <Badge variant="muted">Role: {role}</Badge> : null}
            {isAwis && empresaFilter.trim() ? <Badge variant="muted">Empresa: {empresaFilter.trim()}</Badge> : null}
          </div>
        ) : null}

        <div style={{ height: 14 }} />

        {loading ? (
          <div className="awis-state">
            <div className="awis-state-title">Carregando usuários…</div>
            <div className="awis-state-sub">Consultando base e permissões.</div>

            <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
              <div className="awis-skeleton" style={{ width: '70%' }} />
              <div className="awis-skeleton" style={{ width: '88%' }} />
              <div className="awis-skeleton" style={{ width: '78%' }} />
              <div className="awis-skeleton" style={{ width: '83%' }} />
            </div>
          </div>
        ) : null}

        {showEmpty ? (
          <div className="awis-state">
            <div className="awis-state-title">Nenhum resultado</div>
            <div className="awis-state-sub">Ajuste os filtros ou tente buscar por outro termo.</div>
          </div>
        ) : null}

        {showTable ? (
          <>
            <div className="awis-row awis-row--wrap" style={{ justifyContent: 'space-between', gap: 10 }}>
              <div className="awis-muted" style={{ fontSize: 12 }}>
                {pageInfo ? (
                  <>
                    Mostrando <span className="awis-mono">{pageInfo.from}</span>–<span className="awis-mono">{pageInfo.to}</span> de{' '}
                    <span className="awis-mono">{pageInfo.total}</span>
                  </>
                ) : (
                  <>
                    Mostrando <span className="awis-mono">{items.length}</span> usuários
                  </>
                )}
              </div>

              <div className="awis-row" style={{ gap: 8 }}>
                <Button variant="ghost" onClick={() => canPrev && load({ page: page - 1 })} disabled={!canPrev || loading}>
                  ← Anterior
                </Button>
                <Button variant="ghost" onClick={() => canNext && load({ page: page + 1 })} disabled={!canNext || loading}>
                  Próxima →
                </Button>
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div
              className="awis-table"
              role="table"
              aria-label="Lista de usuários"
              style={{
                ...(isAwis
                  ? ({ ['--cols' as any]: '90px 110px 1fr 120px 220px 140px' } as any)
                  : ({ ['--cols' as any]: '90px 1fr 120px 220px 140px' } as any)),
              }}
            >
              <div className="awis-tr awis-th" role="row">
                <div role="columnheader">ID</div>
                {isAwis ? <div role="columnheader">Empresa</div> : null}
                <div role="columnheader">Usuário</div>
                <div role="columnheader">Status</div>
                <div role="columnheader">Roles</div>
                <div role="columnheader" style={{ textAlign: 'right' }}>
                  Ações
                </div>
              </div>

              {items.map((u) => {
                const rolesNow = uniq((u.roles ?? []) as UsuarioAppRoleName[])
                const statusText = String(u.status ?? '—')
                return (
                  <div key={u.id} className="awis-tr" role="row">
                    <div data-label="ID" className="awis-mono" role="cell">
                      {u.id}
                    </div>

                    {isAwis ? (
                      <div data-label="Empresa" className="awis-mono" role="cell">
                        {u.empresaId ?? '—'}
                      </div>
                    ) : null}

                    <div data-label="Usuário" role="cell" className="awis-cell-name">
                      <div>{u.nome || <span className="awis-muted">—</span>}</div>
                      <div className="awis-muted" style={{ fontSize: 12, marginTop: 2 }}>
                        <span className="awis-mono">{u.email}</span>
                        {u.cpf ? (
                          <>
                            {' '}
                            • CPF: <span className="awis-mono">{u.cpf}</span>
                          </>
                        ) : null}
                      </div>
                      {u.ultimoLoginEm ? (
                        <div className="awis-muted" style={{ fontSize: 12, marginTop: 2 }}>
                          Último login: <span className="awis-mono">{fmtDate(u.ultimoLoginEm)}</span>
                        </div>
                      ) : null}
                    </div>

                    <div data-label="Status" role="cell">
                      {statusText === 'ATIVO' ? (
                        <Badge>ATIVO</Badge>
                      ) : statusText === 'INATIVO' ? (
                        <Badge variant="muted">INATIVO</Badge>
                      ) : statusText === 'PENDENTE' ? (
                        <Badge variant="muted">PENDENTE</Badge>
                      ) : (
                        <Badge variant="muted">{statusText}</Badge>
                      )}
                    </div>

                    <div data-label="Roles" role="cell">
                      <div className="awis-row awis-row--wrap" style={{ gap: 6 }}>
                        {rolesNow.length ? rolesNow.map((r) => <Badge key={r}>{r}</Badge>) : <span className="awis-muted">—</span>}
                      </div>
                    </div>

                    <div data-label="Ações" className="awis-cell-actions" role="cell">
                      <Button variant="primary" onClick={() => openRoles(u)}>
                        Roles
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : null}
      </Card>

      {/* Modal Roles */}
      {rolesModal.open ? (
        <div className="awis-modal-backdrop" role="dialog" aria-modal="true">
          <div className="awis-modal">
            <Card
              title="Gerenciar roles"
              subtitle={rolesModal.user ? `${rolesModal.user.nome} • ${rolesModal.user.email}` : 'Usuário'}
            >
              {rolesModal.loading ? (
                <div className="awis-state">
                  <div className="awis-state-title">Carregando roles…</div>
                  <div className="awis-state-sub">Validando permissões e consistência.</div>
                  <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                    <div className="awis-skeleton" style={{ width: '72%' }} />
                    <div className="awis-skeleton" style={{ width: '84%' }} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="awis-muted" style={{ fontSize: 12, marginBottom: 10 }}>
                    Governança: somente <span className="awis-mono">AWIS</span> concede/remove <span className="awis-mono">AWIS</span> e{' '}
                    <span className="awis-mono">ADM</span>.
                  </div>

                  <div className="awis-stack" style={{ gap: 10 }}>
                    {ROLE_OPTIONS.map((r) => {
                      const enabled = Boolean(rolesModal.roles?.includes(r))
                      const disabledByGov = !isAwis && (r === 'AWIS' || r === 'ADM')
                      return (
                        <div key={r} className="awis-row awis-row--wrap" style={{ justifyContent: 'space-between', gap: 10 }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>{r}</div>
                            <div className="awis-muted" style={{ fontSize: 12 }}>
                              {r === 'AWIS'
                                ? 'Acesso global ao Console e governança.'
                                : r === 'ADM'
                                  ? 'Admin do tenant (gestão do App no tenant).'
                                  : r === 'PARCEIRO'
                                    ? 'Perfil parceiro (publicações e recursos do parceiro).'
                                    : 'Perfil base (padrão do App).'}
                            </div>
                          </div>

                          <Button
                            variant={enabled ? 'danger' : 'primary'}
                            onClick={() => rolesModal.user && toggleRole(rolesModal.user, r, enabled)}
                            disabled={disabledByGov}
                          >
                            {enabled ? 'Remover' : 'Adicionar'}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              <div style={{ height: 14 }} />
              <div className="awis-row" style={{ justifyContent: 'flex-end', gap: 10 }}>
                <Button variant="ghost" onClick={closeRoles}>
                  Fechar
                </Button>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  )
}
