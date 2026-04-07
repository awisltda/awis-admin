// src/pages/tenant/TenantDetail.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../ui/Card'
import { Button } from '../../ui/Button'
import { Badge } from '../../ui/Badge'
import { Toast } from '../../ui/Toast'
import { ConfirmDialog } from '../../ui/ConfirmDialog'
import { SecretOneTimeModal } from '../../ui/SecretOneTimeModal'
import { http } from '../../api/http'
import { endpoints } from '../../api/endpoints'

import type {
  ApiClientDetail,
  ApiClientUnidade,
  ApiClientRotateSecretResponse,
  ApiClientNalapideUpdateRequest,
  TabKey,
  ToastState,
  WebhookEndpointDTO,
  WebhookCreatePayload,
  WebhookUpdatePayload,
} from './types'

import {
  chunkScopes,
  extractApiMessage,
  normalizeDomain,
  normalizeEventos,
  normalizeUrl,
  toNumber,
  copyToClipboard,
  withEmpresaHeader,
} from './utils'

import { TenantTabUnidades } from './tabs/TenantTabUnidades'
import { TenantTabCredenciais } from './tabs/TenantTabCredenciais'
import { TenantTabNalapide } from './tabs/TenantTabNalapide'
import { TenantTabWebhooks } from './tabs/TenantTabWebhooks'
import { TenantTabEnv } from './tabs/TenantTabEnv'
import { TenantTabArquivos } from './tabs/TenantTabArquivos'

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

  const [outraUnidadeId, setOutraUnidadeId] = useState<string>('')
  const [linking, setLinking] = useState(false)

  const [webhooks, setWebhooks] = useState<WebhookEndpointDTO[]>([])
  const [loadingWebhooks, setLoadingWebhooks] = useState(false)
  const [confirmDeleteWebhook, setConfirmDeleteWebhook] = useState<{ open: boolean; id?: number }>({ open: false })

  const [savingNalapide, setSavingNalapide] = useState(false)

  const [confirmRotateSecret, setConfirmRotateSecret] = useState<{ open: boolean }>({ open: false })
  const [rotatingSecret, setRotatingSecret] = useState(false)
  const [rotateResult, setRotateResult] = useState<ApiClientRotateSecretResponse | null>(null)

  const WEBHOOK_EVENTS = useMemo(
    () =>
      [
        'invoice.paid',
        'invoice.refunded',
        'contract.activated',
        'contract.reactivated',
        'contract.canceled',
      ] as const,
    []
  )

  const loadAll = useCallback(async () => {
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
      setToast({ kind: 'error', message: extractApiMessage(e, 'Falha ao carregar detalhes do tenant.') })
    } finally {
      setLoading(false)
    }
  }, [apiClientId])

  async function loadWebhooks(empresaId: number) {
    if (!empresaId) return
    setLoadingWebhooks(true)
    try {
      const url = endpoints.webhooksEndpoints(empresaId)
      const list = await (http as any).get(url, withEmpresaHeader(empresaId))
      setWebhooks(Array.isArray(list) ? list : [])
    } catch (e: any) {
      setToast({ kind: 'error', message: extractApiMessage(e, 'Falha ao carregar webhooks.') })
    } finally {
      setLoadingWebhooks(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    if (tab === 'WEBHOOKS' && tenant?.empresaId) loadWebhooks(tenant.empresaId)
  }, [tab, tenant?.empresaId])

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
      setToast({ kind: 'error', message: extractApiMessage(e, 'Falha ao alterar status.') })
    }
  }

  async function unlinkUnidade() {
    const unidadeId = confirmUnlink.unidadeId
    if (!tenant || !unidadeId) return

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
      setToast({ kind: 'error', message: extractApiMessage(e, 'Falha ao desvincular unidade.') })
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
      setToast({ kind: 'error', message: extractApiMessage(e, 'Falha ao vincular unidade.') })
    } finally {
      setLinking(false)
    }
  }

  async function saveNalapide(req: ApiClientNalapideUpdateRequest) {
    if (!tenant) return
    setSavingNalapide(true)
    try {
      const updated = await http.put<ApiClientDetail>(endpoints.apiClientNalapideUpdate(tenant.id), req)
      setTenant(updated)
      setToast({ kind: 'success', message: 'Configuração da NaLápide atualizada com sucesso.' })
    } catch (e: any) {
      setToast({ kind: 'error', message: extractApiMessage(e, 'Falha ao atualizar configuração da NaLápide.') })
    } finally {
      setSavingNalapide(false)
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

  function doCopy(label: string, value: string) {
    copyToClipboard(value).then((ok) => {
      setToast({
        kind: ok ? 'success' : 'error',
        message: ok ? `${label} copiado.` : `Não foi possível copiar ${label}.`,
      })
    })
  }

  const tenantDomain = useMemo(() => normalizeDomain(tenant?.dominio ?? ''), [tenant?.dominio])

  const tenantVercelDomain = useMemo(
    () => normalizeDomain(tenant?.dominioVercel ?? tenant?.dominioVercel ?? ''),
    [tenant?.dominioVercel]
  )

  const defaultWebhookUrl = useMemo(() => {
    if (!tenantDomain) return ''
    return normalizeUrl(`${tenantDomain}/api/webhooks/progem`)
  }, [tenantDomain])

  const webhookGuide = useMemo(() => {
    return `Webhooks (operacional)
- Cada endpoint recebe eventos do Progem e deve validar assinatura usando o "secret".
- O Progem identifica a empresa pelo header X-Progem-ID (empresaId/unidade).

Padrão recomendado:
URL do tenant:
  https://{dominio-do-tenant}/api/webhooks/progem

Eventos obrigatórios:
  invoice.paid
  invoice.refunded
  contract.activated
  contract.reactivated
  contract.canceled
`
  }, [])

  const missingDefaultEvents = useMemo(() => {
    const normalized = (webhooks ?? []).map((w) => ({
      ...w,
      eventos: normalizeEventos(w.eventos),
      ativo: w.ativo ?? true,
    }))

    return WEBHOOK_EVENTS.filter((ev) => !normalized.some((w) => w.ativo && normalizeEventos(w.eventos).includes(ev)))
  }, [WEBHOOK_EVENTS, webhooks])

  async function createWebhook(payload: Omit<WebhookCreatePayload, 'empresaId'>) {
    if (!tenant?.empresaId) return
    try {
      const base = endpoints.webhooksEndpoints()
      const body: WebhookCreatePayload = { ...payload, empresaId: tenant.empresaId }

      await (http as any).post(base, body as any, withEmpresaHeader(tenant.empresaId))
      setToast({ kind: 'success', message: 'Webhook criado com sucesso.' })
      await loadWebhooks(tenant.empresaId)
    } catch (e: any) {
      setToast({ kind: 'error', message: extractApiMessage(e, 'Falha ao salvar webhook.') })
      throw e
    }
  }

  async function updateWebhook(id: number, payload: Omit<WebhookUpdatePayload, 'empresaId'>) {
    if (!tenant?.empresaId) return
    try {
      const putUrl = endpoints.webhooksEndpointById(id, tenant.empresaId)
      const body: WebhookUpdatePayload = { ...payload, empresaId: tenant.empresaId }

      await (http as any).put(putUrl, body as any, withEmpresaHeader(tenant.empresaId))
      setToast({ kind: 'success', message: 'Webhook atualizado com sucesso.' })
      await loadWebhooks(tenant.empresaId)
    } catch (e: any) {
      setToast({ kind: 'error', message: extractApiMessage(e, 'Falha ao salvar webhook.') })
      throw e
    }
  }

  async function provisionDefaultWebhooks() {
    if (!tenant?.empresaId) return

    if (!defaultWebhookUrl) {
      setToast({
        kind: 'error',
        message: 'Cadastre o domínio do tenant para gerarmos a URL padrão automaticamente (ex: daliacerimonial.com.br).',
      })
      return
    }

    const missing = [...missingDefaultEvents]
    if (missing.length === 0) {
      setToast({ kind: 'success', message: 'Tudo certo: os webhooks padrão já estão cadastrados e ativos.' })
      return
    }

    setLoadingWebhooks(true)
    try {
      const base = endpoints.webhooksEndpoints()

      for (const ev of missing) {
        const payload: WebhookCreatePayload = {
          empresaId: tenant.empresaId,
          url: defaultWebhookUrl,
          eventos: [ev],
          descricao:
            ev === 'invoice.paid'
              ? 'Endpoint de pagamento'
              : ev === 'invoice.refunded'
                ? 'Endpoint de estorno de pagamento'
                : ev === 'contract.canceled'
                  ? 'Endpoint de cancelamento de contrato'
                  : ev === 'contract.activated'
                    ? 'Endpoint de ativação de contrato'
                    : ev === 'contract.reactivated'
                      ? 'Endpoint de reativação de contrato'
                      : 'Endpoint do Progem',
        }

        await (http as any).post(base, payload as any, withEmpresaHeader(tenant.empresaId))
      }

      setToast({ kind: 'success', message: `Webhooks padrão provisionados: ${missing.length} evento(s) criados.` })
      await loadWebhooks(tenant.empresaId)
    } catch (e: any) {
      setToast({ kind: 'error', message: extractApiMessage(e, 'Falha ao provisionar webhooks padrão.') })
    } finally {
      setLoadingWebhooks(false)
    }
  }

  async function deleteWebhookNow() {
    if (!tenant?.empresaId) return
    const id = confirmDeleteWebhook.id
    if (!id) return

    setConfirmDeleteWebhook({ open: false })
    try {
      const delUrl = endpoints.webhooksEndpointById(id, tenant.empresaId)
      await (http as any).del(delUrl, withEmpresaHeader(tenant.empresaId))
      setToast({ kind: 'success', message: 'Webhook removido com sucesso.' })
      await loadWebhooks(tenant.empresaId)
    } catch (e: any) {
      setToast({ kind: 'error', message: extractApiMessage(e, 'Falha ao remover webhook.') })
    }
  }

  function openRotate() {
    if (!tenant) return
    setConfirmRotateSecret({ open: true })
  }

  async function rotateSecretNow() {
    if (!tenant) return
    setConfirmRotateSecret({ open: false })
    setRotatingSecret(true)
    try {
      const res = await http.post<ApiClientRotateSecretResponse>(endpoints.apiClientRotateSecret(tenant.id), {})
      setRotateResult(res)
      setToast({ kind: 'success', message: 'clientSecret rotacionado. Copie o valor (exibição única).' })
    } catch (e: any) {
      setToast({ kind: 'error', message: extractApiMessage(e, 'Falha ao rotacionar clientSecret.') })
    } finally {
      setRotatingSecret(false)
    }
  }

  async function rotateNalapideSecret(): Promise<ApiClientRotateSecretResponse | void> {
    if (!tenant) return
    if (savingNalapide) return

    setSavingNalapide(true)
    try {
      const res = await http.post<ApiClientRotateSecretResponse>(endpoints.apiClientNalapideRotateSecret(tenant.id), {})

      if (!String(res?.clientSecret ?? '').trim()) {
        setToast({
          kind: 'error',
          message: 'A rotação ocorreu, mas o backend não retornou o novo secret na resposta.',
        })
        return
      }

      setToast({ kind: 'success', message: 'Secret da NaLápide rotacionado. Copie o valor (exibição única).' })
      return res
    } catch (e: any) {
      setToast({ kind: 'error', message: extractApiMessage(e, 'Falha ao rotacionar secret da NaLápide.') })
      return
    } finally {
      setSavingNalapide(false)
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

              {tenantDomain ? (
                <Badge variant="muted">
                  domínio: <span className="awis-mono">{tenantDomain}</span>
                </Badge>
              ) : (
                <Badge variant="muted">domínio: —</Badge>
              )}

              {tenantVercelDomain ? (
                <Badge variant="muted">
                  domínio Vercel: <span className="awis-mono">{tenantVercelDomain}</span>
                </Badge>
              ) : (
                <Badge variant="muted">domínio Vercel: —</Badge>
              )}

              <Badge variant="muted">
                Memorial:{' '}
                <span className="awis-mono">{tenant.habilitaMemorial !== false ? 'sim' : 'não'}</span>
              </Badge>
              <Badge variant="muted">
                Benefícios:{' '}
                <span className="awis-mono">{tenant.habilitaBeneficios !== false ? 'sim' : 'não'}</span>
              </Badge>

              {tenantDomain ? (
                <Button variant="ghost" onClick={() => doCopy('domínio', tenantDomain)} title="Copiar domínio">
                  Copiar domínio
                </Button>
              ) : null}

              {tenantVercelDomain ? (
                <Button
                  variant="ghost"
                  onClick={() => doCopy('domínio Vercel', tenantVercelDomain)}
                  title="Copiar domínio Vercel"
                >
                  Copiar domínio Vercel
                </Button>
              ) : null}
            </div>

            <div className="awis-tabs" role="tablist" aria-label="Seções do tenant">
              <TabButton k="UNIDADES" label="Unidades" />
              <TabButton k="CREDENCIAIS" label="API Progem" />
              <TabButton k="NALAPIDE" label="API NaLápide" />
              <TabButton k="WEBHOOKS" label="Webhooks" />
              <TabButton k="ENV" label="Variáveis de Ambiente" />
              <TabButton k="ARQUIVOS" label="Arquivos (S3)" />
            </div>

            <div className="awis-divider" />

            {tab === 'UNIDADES' ? (
              <TenantTabUnidades
                tenant={tenant}
                temMatrizVinculada={temMatrizVinculada}
                outrasUnidades={outrasUnidades}
                outraUnidadeId={outraUnidadeId}
                setOutraUnidadeId={setOutraUnidadeId}
                linking={linking}
                onVincularOutraUnidade={vincularOutraUnidade}
                onConfirmUnlink={(unidadeId) => setConfirmUnlink({ open: true, unidadeId })}
              />
            ) : null}

            {tab === 'CREDENCIAIS' ? (
              <TenantTabCredenciais
                tenant={tenant}
                tenantDomain={tenantDomain}
                tenantVercelDomain={tenantVercelDomain}
                scopesList={scopesList}
                onCopy={doCopy}
                rotatingSecret={rotatingSecret}
                onOpenRotate={openRotate}
              />
            ) : null}

            {tab === 'NALAPIDE' ? (
              <TenantTabNalapide
                tenant={tenant}
                saving={savingNalapide}
                onSave={saveNalapide}
                onRotateSecret={rotateNalapideSecret}
              />
            ) : null}

            {tab === 'WEBHOOKS' ? (
              <TenantTabWebhooks
                empresaId={tenant.empresaId}
                tenantDomain={tenantDomain}
                webhookGuide={webhookGuide}
                defaultWebhookUrl={defaultWebhookUrl}
                webhooks={webhooks}
                loadingWebhooks={loadingWebhooks}
                missingDefaultEvents={missingDefaultEvents as any}
                onReload={() => loadWebhooks(tenant.empresaId)}
                onProvisionDefault={provisionDefaultWebhooks}
                onCreate={createWebhook}
                onUpdate={updateWebhook}
                onDelete={(id) => setConfirmDeleteWebhook({ open: true, id })}
                onCopy={doCopy}
              />
            ) : null}

            {tab === 'ENV' ? <TenantTabEnv apiClientId={tenant.id} /> : null}

            {tab === 'ARQUIVOS' ? <TenantTabArquivos apiClientId={tenant.id} empresaId={tenant.empresaId} /> : null}
          </div>
        ) : null}
      </Card>

      <ConfirmDialog
        open={confirmToggle.open}
        title={`${tenant?.ativo ? 'Desativar' : 'Ativar'} tenant`}
        description={
          tenant?.ativo
            ? `Confirma desativar o tenant "${tenant?.nome}"?`
            : `Confirma ativar o tenant "${tenant?.nome}"?`
        }
        confirmText={tenant?.ativo ? 'Desativar' : 'Ativar'}
        danger={!!tenant?.ativo}
        onConfirm={toggleTenant}
        onClose={() => setConfirmToggle({ open: false })}
      />

      <ConfirmDialog
        open={confirmUnlink.open}
        title="Desvincular unidade"
        description={`Confirma remover a unidade #${confirmUnlink.unidadeId} deste tenant?`}
        confirmText="Desvincular"
        danger
        onConfirm={unlinkUnidade}
        onClose={() => setConfirmUnlink({ open: false })}
      />

      <ConfirmDialog
        open={confirmDeleteWebhook.open}
        title="Excluir webhook"
        description="Confirma remover este endpoint de webhook?"
        confirmText="Excluir"
        danger
        onConfirm={deleteWebhookNow}
        onClose={() => setConfirmDeleteWebhook({ open: false })}
      />

      <ConfirmDialog
        open={confirmRotateSecret.open}
        title="Rotacionar clientSecret?"
        description="Isso invalida o secret atual. Copie o novo valor imediatamente."
        confirmText={rotatingSecret ? 'Rotacionando…' : 'Rotacionar'}
        danger
        onConfirm={rotateSecretNow}
        onClose={() => setConfirmRotateSecret({ open: false })}
      />

      <SecretOneTimeModal
        open={!!rotateResult}
        clientId={rotateResult?.clientId ?? tenant?.clientId ?? ''}
        clientSecret={rotateResult?.clientSecret ?? ''}
        onCopy={doCopy}
        onClose={() => setRotateResult(null)}
      />
    </div>
  )
}