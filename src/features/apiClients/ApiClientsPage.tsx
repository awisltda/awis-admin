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

      <Card title="API Clients" subtitle="Cadastro e controle de clientes da API (tenants).">
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
          <div className="awis-table" role="table" aria-label="Lista de API Clients">
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
                  <Button variant={it.ativo ? 'danger' : 'primary'} onClick={() => askToggle(it)}>
                    {it.ativo ? 'Desativar' : 'Ativar'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

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
