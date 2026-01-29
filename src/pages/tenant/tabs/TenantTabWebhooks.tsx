// src/pages/tenant/tabs/TenantTabWebhooks.tsx
import { useMemo, useState } from 'react'
import { Badge } from '../../../ui/Badge'
import { Button } from '../../../ui/Button'
import { Card } from '../../../ui/Card'
import { Input } from '../../../ui/Input'
import type { WebhookEndpointDTO } from '../types'
import { normalizeEventos, normalizeUrl } from '../utils'

type StdEvent =
  | 'invoice.paid'
  | 'invoice.refunded'
  | 'contract.activated'
  | 'contract.reactivated'
  | 'contract.canceled'

type StdDef = {
  ev: StdEvent
  title: string
  description: string
}

function getStdDefs(): StdDef[] {
  return [
    { ev: 'invoice.paid', title: 'Pagamento', description: 'Endpoint de pagamento' },
    { ev: 'invoice.refunded', title: 'Estorno', description: 'Endpoint de estorno de pagamento' },
    { ev: 'contract.activated', title: 'Ativação', description: 'Endpoint de Ativação de contrato' },
    { ev: 'contract.reactivated', title: 'Reativação', description: 'Endpoint de Reativação de contrato' },
    { ev: 'contract.canceled', title: 'Cancelamento', description: 'Endpoint de Cancelamento de contrato' },
  ]
}

function firstOrNull<T>(arr: T[]) {
  return arr.length ? arr[0] : null
}

export function TenantTabWebhooks(props: {
  empresaId: number
  tenantDomain: string
  defaultWebhookUrl: string
  webhooks: WebhookEndpointDTO[]
  loadingWebhooks: boolean
  missingDefaultEvents: readonly string[]
  onReload: () => void
  onProvisionDefault: () => void
  onCreate: (payload: { url: string; eventos: string[]; descricao?: string; secret?: string }) => Promise<void>
  onUpdate: (id: number, payload: { url: string; eventos: string[]; descricao?: string; ativo?: boolean }) => Promise<void>
  onDelete: (id: number) => void
  onCopy: (label: string, value: string) => void
}) {
  const {
    empresaId,
    tenantDomain,
    defaultWebhookUrl,
    webhooks,
    loadingWebhooks,
    missingDefaultEvents,
    onReload,
    onProvisionDefault,
    onCreate,
    onUpdate,
    onDelete,
    onCopy,
  } = props

  const stdDefs = useMemo(() => getStdDefs(), [])
  const stdEvents = useMemo(() => stdDefs.map((d) => d.ev), [stdDefs])

  const defaultUrlNormalized = useMemo(() => normalizeUrl(defaultWebhookUrl || ''), [defaultWebhookUrl])
  const canUseDefaultUrl = Boolean(defaultUrlNormalized)

  const normalized = useMemo(() => {
    return (webhooks ?? []).map((w) => ({
      ...w,
      url: String(w.url ?? '').trim(),
      eventos: normalizeEventos(w.eventos),
      ativo: w.ativo ?? true,
      descricao: String(w.descricao ?? ''),
    }))
  }, [webhooks])

  // Index por evento
  const byEvent = useMemo(() => {
    const map = new Map<string, WebhookEndpointDTO[]>()
    for (const w of normalized) {
      for (const ev of normalizeEventos((w as any).eventos)) {
        const arr = map.get(ev) ?? []
        arr.push(w)
        map.set(ev, arr)
      }
    }
    return map
  }, [normalized])

  const stdRows = useMemo(() => {
    return stdDefs.map((d) => {
      const list = (byEvent.get(d.ev) ?? []).map((x) => ({
        ...x,
        url: String((x as any).url ?? '').trim(),
        ativo: (x as any).ativo ?? true,
        descricao: String((x as any).descricao ?? ''),
        eventos: normalizeEventos((x as any).eventos),
      }))

      const active = firstOrNull(list.filter((x) => !!x.ativo))
      const any = firstOrNull(list)
      const chosen = active ?? any

      const exists = !!chosen
      const isActive = chosen ? !!chosen.ativo : false
      const urlMatches = !!chosen?.url && !!defaultUrlNormalized && normalizeUrl(chosen.url) === defaultUrlNormalized

      let status: 'OK' | 'AUSENTE' | 'DIVERGENTE' | 'INATIVO'
      if (!exists) status = 'AUSENTE'
      else if (!isActive) status = 'INATIVO'
      else if (defaultUrlNormalized && !urlMatches) status = 'DIVERGENTE'
      else status = 'OK'

      return {
        def: d,
        status,
        candidate: (chosen as any as WebhookEndpointDTO) ?? null,
        count: list.length,
      }
    })
  }, [stdDefs, byEvent, defaultUrlNormalized])

  const missingCount = useMemo(() => stdRows.filter((r) => r.status === 'AUSENTE').length, [stdRows])
  const divergingCount = useMemo(() => stdRows.filter((r) => r.status === 'DIVERGENTE').length, [stdRows])

  // Editor
  const [manualUrl, setManualUrl] = useState(false)
  const [editor, setEditor] = useState<{
    open: boolean
    mode?: 'NEW' | 'EDIT'
    loading?: boolean
    id?: number
    url?: string
    descricao?: string
    ativo?: boolean
    eventos?: string[]
    secret?: string
  }>({ open: false })

  function openNewForEvent(ev: StdEvent) {
    const d = stdDefs.find((x) => x.ev === ev)
    setManualUrl(false)
    setEditor({
      open: true,
      mode: 'NEW',
      url: defaultUrlNormalized || '',
      descricao: d?.description || 'Endpoint do Progem',
      ativo: true,
      eventos: [ev], // governança: 1 endpoint por evento
      secret: '',
    })
  }

  function openEdit(w: WebhookEndpointDTO) {
    setManualUrl(true) // edição permite ajuste fino
    setEditor({
      open: true,
      mode: 'EDIT',
      id: w.id,
      url: String(w.url ?? ''),
      descricao: String(w.descricao ?? ''),
      ativo: w.ativo ?? true,
      eventos: normalizeEventos(w.eventos),
      secret: '',
    })
  }

  async function save() {
    const url = String(editor.url ?? '').trim()
    const descricao = String(editor.descricao ?? '').trim()
    const ativo = editor.ativo !== false
    const eventos = (editor.eventos ?? []).map((x) => String(x).trim()).filter(Boolean)

    if (!url) return
    if (!eventos.length) return

    setEditor((s) => ({ ...s, loading: true }))
    try {
      if (editor.mode === 'EDIT' && editor.id) {
        await onUpdate(editor.id, { url, eventos, descricao, ativo })
      } else {
        // NOVO: secret não aparece; backend gera automaticamente
        await onCreate({ url, eventos, descricao })
      }
      setEditor({ open: false })
      setManualUrl(false)
    } finally {
      setEditor((s) => ({ ...s, loading: false }))
    }
  }

  async function quickFixUrl(row: (typeof stdRows)[number]) {
    if (!row.candidate?.id) return
    if (!defaultUrlNormalized) return
    await onUpdate(row.candidate.id, {
      url: defaultUrlNormalized,
      eventos: [row.def.ev],
      descricao: row.def.description,
      ativo: true,
    })
  }

  return (
    <div className="awis-stack" style={{ gap: 14 }}>
      <div
        className="awis-row awis-row--wrap"
        style={{ gap: 10, justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div style={{ minWidth: 260 }}>
          <div className="awis-section-title">Webhooks padrão</div>
          <div className="awis-muted" style={{ marginTop: 4 }}>
            Objetivo: garantir os 5 eventos obrigatórios por tenant, com URL baseada no domínio e tudo{' '}
            <span className="awis-mono">ATIVO</span>.
          </div>
        </div>

        <div className="awis-row awis-row--wrap" style={{ gap: 10 }}>
          <Button variant="ghost" onClick={onReload} disabled={loadingWebhooks}>
            {loadingWebhooks ? 'Atualizando…' : 'Recarregar'}
          </Button>

          <Button
            variant="primary"
            onClick={onProvisionDefault}
            disabled={loadingWebhooks || !empresaId || !canUseDefaultUrl}
            title={
              !canUseDefaultUrl
                ? 'Cadastre o domínio do tenant para gerar a URL padrão automaticamente'
                : 'Criar/Reparar webhooks padrão'
            }
          >
            Provisionar/Reparar padrão
            {missingDefaultEvents.length > 0 ? (
              <span className="awis-muted" style={{ marginLeft: 8 }}>
                ({missingDefaultEvents.length} faltando)
              </span>
            ) : null}
          </Button>
        </div>
      </div>

      <div className="awis-row awis-row--wrap" style={{ gap: 10 }}>


        <Badge variant="muted">
          URL padrão: <span className="awis-mono">{defaultUrlNormalized || '—'}</span>
        </Badge>
        <Badge>
          Ausentes: <span className="awis-mono">{missingCount}</span>
        </Badge>
        <Badge variant="muted">
          Divergentes: <span className="awis-mono">{divergingCount}</span>
        </Badge>
      </div>

      {!canUseDefaultUrl ? (
        <div className="awis-callout awis-callout--warn">
          <div style={{ fontWeight: 700 }}>Domínio não cadastrado (obrigatório para o padrão)</div>
          <div className="awis-muted" style={{ marginTop: 6 }}>
            Cadastre o domínio do tenant para o painel gerar e manter automaticamente:
            <div style={{ marginTop: 6 }}>
              <span className="awis-mono">https://SEU_DOMINIO/api/webhooks/progem</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Padrões por evento */}
      <div className="awis-list" role="list">
        {stdRows.map((r) => {
          const w = r.candidate
          const url = w?.url ? String(w.url) : ''

          return (
            <div key={r.def.ev} className="awis-list-item" role="listitem" style={{ alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div
                  className="awis-list-title"
                  style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}
                >
                  <span style={{ fontWeight: 800 }}>{r.def.title}</span>

                  <Badge variant="muted">
                    <span className="awis-mono">{r.def.ev}</span>
                  </Badge>

                  {r.status === 'OK' ? <Badge>OK</Badge> : null}
                  {r.status === 'AUSENTE' ? <Badge variant="muted">AUSENTE</Badge> : null}
                  {r.status === 'DIVERGENTE' ? <Badge variant="muted">URL DIVERGENTE</Badge> : null}
                  {r.status === 'INATIVO' ? <Badge variant="muted">INATIVO</Badge> : null}

                  {w?.id ? (
                    <Badge variant="muted">
                      id: <span className="awis-mono">#{w.id}</span>
                    </Badge>
                  ) : null}
                </div>

                <div className="awis-muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {r.def.description}
                </div>

                <div className="awis-muted" style={{ fontSize: 12, marginTop: 6 }}>
                  URL atual: <span className="awis-mono">{url || '—'}</span>
                </div>

                {/* ✅ regra 1: não repetir URL padrão quando AUSENTE */}
                {r.status !== 'OK' && r.status !== 'AUSENTE' && defaultUrlNormalized ? (
                  <div className="awis-muted" style={{ fontSize: 12, marginTop: 6 }}>
                    URL padrão: <span className="awis-mono">{defaultUrlNormalized}</span>
                  </div>
                ) : null}
              </div>

              <div className="awis-row" style={{ gap: 10 }}>
                {w?.url ? (
                  <Button variant="ghost" onClick={() => onCopy('URL do webhook', w.url)}>
                    Copiar URL
                  </Button>
                ) : null}

                {r.status === 'AUSENTE' ? (
                  <Button variant="primary" onClick={() => openNewForEvent(r.def.ev)} disabled={!canUseDefaultUrl}>
                    Criar
                  </Button>
                ) : null}

                {r.status === 'DIVERGENTE' ? (
                  <Button variant="primary" onClick={() => quickFixUrl(r)} disabled={!canUseDefaultUrl || !w?.id}>
                    Ajustar URL
                  </Button>
                ) : null}

                {w?.id ? (
                  <>
                    <Button variant="ghost" onClick={() => openEdit(w)}>
                      Editar
                    </Button>
                    <Button variant="danger" onClick={() => onDelete(w.id)}>
                      Remover
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      {/* Editor */}
      {editor.open ? (
        <div className="awis-modal-backdrop" role="dialog" aria-modal="true">
          <div className="awis-modal">
            <Card
              title={editor.mode === 'EDIT' ? 'Editar webhook' : 'Novo webhook'}
              subtitle={
                editor.mode === 'EDIT'
                  ? 'Ajuste fino do endpoint (use com cautela).'
                  : 'Cadastro rápido: URL e secret são gerenciados automaticamente.'
              }
              right={
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditor({ open: false })
                    setManualUrl(false)
                  }}
                  disabled={!!editor.loading}
                >
                  Fechar
                </Button>
              }
            >
              <div className="awis-modal-scroll">
                <div className="awis-stack" style={{ gap: 14 }}>
                  <div className="awis-row awis-row--wrap" style={{ gap: 10 }}>
                    <Badge variant="muted">
                      X-Progem-ID: <span className="awis-mono">{empresaId}</span>
                    </Badge>
                    <Badge variant="muted">
                      domínio: <span className="awis-mono">{tenantDomain || '—'}</span>
                    </Badge>
                  </div>

                  <Input
                    label="URL do endpoint"
                    placeholder={defaultUrlNormalized || 'https://suaempresa.com.br/api/webhooks/progem'}
                    value={editor.url ?? ''}
                    onChange={(e) => setEditor((s) => ({ ...s, url: e.target.value }))}
                    disabled={
                      !!editor.loading ||
                      // ✅ regra 3: no NOVO, não mostrar manualUrl; URL sempre travada
                      (editor.mode === 'NEW' ? true : !manualUrl && !!defaultUrlNormalized)
                    }
                  />

                  {/* ✅ regra 3: esconder (NOVO) Editar URL manualmente + Usar URL padrão */}
                  {editor.mode === 'EDIT' ? (
                    <div className="awis-row awis-row--wrap" style={{ gap: 10, marginTop: 2 }}>
                      <label className="awis-row" style={{ gap: 10, userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={manualUrl}
                          onChange={(e) => {
                            const v = e.target.checked
                            setManualUrl(v)
                            if (!v) setEditor((s) => ({ ...s, url: defaultUrlNormalized || s.url }))
                          }}
                          disabled={!!editor.loading || !defaultUrlNormalized}
                        />
                        <span style={{ fontWeight: 600 }}>Editar URL manualmente</span>
                      </label>

                      <Button
                        variant="ghost"
                        onClick={() => setEditor((s) => ({ ...s, url: defaultUrlNormalized || s.url }))}
                        disabled={!!editor.loading || !defaultUrlNormalized}
                      >
                        Usar URL padrão
                      </Button>
                    </div>
                  ) : (
                    <div className="awis-muted" style={{ fontSize: 12, marginTop: 2 }}>
                      A URL é derivada do domínio do tenant para evitar erro operacional.
                    </div>
                  )}

                  <Input
                    label="Descrição"
                    placeholder="Ex: Endpoint de pagamento"
                    value={editor.descricao ?? ''}
                    onChange={(e) => setEditor((s) => ({ ...s, descricao: e.target.value }))}
                    disabled={!!editor.loading}
                  />

                  {/* ✅ regra 3: não mostrar Secret (opcional) no NOVO */}
                  {editor.mode === 'EDIT' ? (
                    <div className="awis-callout awis-callout--warn">
                      <div style={{ fontWeight: 700 }}>Secret</div>
                      <div className="awis-muted" style={{ marginTop: 6 }}>
                        O secret não é exibido por segurança. Recomendação: rotação/reatribuição com exibição única no backend.
                      </div>
                    </div>
                  ) : null}

                  {/* Eventos */}
                  <div className="awis-callout">
                    <div style={{ fontWeight: 700 }}>Evento</div>
                    <div className="awis-muted" style={{ marginTop: 6 }}>
                      Padrão recomendado: <span className="awis-mono">1 evento por endpoint</span>.
                    </div>

                    <div className="awis-row awis-row--wrap" style={{ gap: 8, marginTop: 10 }}>
                      {stdEvents.map((ev) => {
                        const checked = (editor.eventos ?? []).includes(ev)

                        return (
                          <Button
                            key={ev}
                            variant={checked ? 'primary' : 'ghost'}
                            onClick={() => setEditor((s) => ({ ...s, eventos: [ev] }))}
                            disabled={!!editor.loading || editor.mode === 'EDIT'}
                            title={
                              editor.mode === 'EDIT'
                                ? 'Para governança, padronize 1 evento por endpoint (crie outro endpoint se necessário)'
                                : 'Selecionar evento'
                            }
                          >
                            <span className="awis-mono" style={{ fontSize: 12 }}>
                              {ev}
                            </span>
                          </Button>
                        )
                      })}
                    </div>

                    <div className="awis-muted" style={{ fontSize: 12, marginTop: 10 }}>
                      Selecionado: <span className="awis-mono">{(editor.eventos ?? [])[0] || '—'}</span>
                    </div>
                  </div>

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

                    <Button variant="primary" onClick={save} disabled={!!editor.loading}>
                      {editor.loading ? 'Salvando…' : 'Salvar'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  )
}
