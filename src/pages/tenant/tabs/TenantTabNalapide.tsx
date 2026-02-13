// src/pages/tenant/tabs/TenantTabNalapide.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '../../../ui/Badge'
import { Button } from '../../../ui/Button'
import { Input } from '../../../ui/Input'
import { http } from '../../../api/http'
import { endpoints } from '../../../api/endpoints'
import type { ApiClientDetail, ApiClientNalapideUpdateRequest } from '../types'

type Props = {
  tenant: ApiClientDetail
  saving: boolean
  onSave: (req: ApiClientNalapideUpdateRequest) => void

  // ✅ opcional: o pai pode injetar rotação de secret (exibição única)
  onRotateSecret?: () => Promise<any>
}

type TenantExt = ApiClientDetail & {
  clientId?: string | null
  nalapideHasSecret?: boolean | null
}

type NalapideProvisionUi = {
  clientId: string
  clientSecret: string // 1x
  obtainedAtIso: string
}

type NalapideTokenUi = {
  accessToken: string
  tokenType?: string | null
  scope?: string | null
  expiresIn?: number | null
  obtainedAtIso?: string
}

function safe(v?: string | null) {
  return String(v ?? '').trim()
}

function defaultNalapideId(tenant: TenantExt) {
  return safe(tenant.nalapideId) || safe(tenant.clientId)
}

function defaultBaseUrl(tenant: TenantExt) {
  return safe(tenant.nalapideBaseUrl) || 'https://api.nalapide.com'
}

export function TenantTabNalapide({ tenant: rawTenant, saving, onSave, onRotateSecret }: Props) {
  const tenant = rawTenant as TenantExt

  const originalEnabled = Boolean(tenant.nalapideEnabled)
  const originalId = defaultNalapideId(tenant)
  const originalUrl = defaultBaseUrl(tenant)

  // IMPORTANTE: com key={tenant.id} no pai, este estado é recriado ao trocar de tenant
  const [enabled, setEnabled] = useState<boolean>(originalEnabled)
  const [nalapideId, setNalapideId] = useState<string>(originalId)
  const [baseUrl, setBaseUrl] = useState<string>(originalUrl)

  // Campo 3 (definitivo): agora é o ÚNICO secret em claro na UI.
  // - NÃO será limpo automaticamente.
  // - É usado também para obter token (passo 4).
  const [clientSecretPlain, setClientSecretPlain] = useState<string>('')

  const [showSecret, setShowSecret] = useState(false)

  // Provisionamento (sem botão separado; dispara no pós-save)
  const [provisioning, setProvisioning] = useState(false)
  const [provisionErr, setProvisionErr] = useState<string>('')
  const [provision, setProvision] = useState<NalapideProvisionUi | null>(null)

  // Token
  const [tokenLoading, setTokenLoading] = useState(false)
  const [tokenErr, setTokenErr] = useState<string>('')
  const [token, setToken] = useState<NalapideTokenUi | null>(null)

  const provisionSecretRef = useRef<HTMLInputElement | null>(null)
  const tokenInputRef = useRef<HTMLInputElement | null>(null)

  // Gatilho: depois que o backend terminar o save (saving vira false), provisiona automaticamente
  const pendingProvisionAfterSaveRef = useRef(false)
  const prevSavingRef = useRef<boolean>(saving)

  const hasSecretHash = Boolean(tenant.nalapideHasSecret)

  const step1Valid = enabled ? Boolean(safe(nalapideId) && safe(baseUrl)) : true
  const canEdit = enabled && !saving && !provisioning && !tokenLoading

  const dirtyConfig = useMemo(() => {
    const dEnabled = enabled !== originalEnabled
    const dId = safe(nalapideId) !== originalId
    const dUrl = safe(baseUrl) !== originalUrl
    return dEnabled || dId || dUrl
  }, [enabled, nalapideId, baseUrl, originalEnabled, originalId, originalUrl])

  function clearOperationalOutputs() {
    setProvision(null)
    setProvisionErr('')
    setToken(null)
    setTokenErr('')
  }

  function onToggle(next: boolean) {
    setEnabled(next)
    clearOperationalOutputs()
    if (next && !safe(nalapideId)) setNalapideId(defaultNalapideId(tenant))
  }

  async function runProvisionNow() {
    if (!enabled) return
    if (!safe(nalapideId) || !safe(baseUrl)) return
    if (saving || provisioning || tokenLoading) return

    setProvisionErr('')
    setProvision(null)
    setProvisioning(true)

    try {
      const res = await http.post<any>(endpoints.apiClientNalapideProvision(Number(tenant.id)), {})

      const clientId = safe(res?.clientId || res?.client_id)
      const clientSecret = safe(res?.clientSecret || res?.client_secret)

      if (!clientId || !clientSecret) {
        setProvisionErr('Provisionamento retornou resposta incompleta (clientId/clientSecret).')
        return
      }

      const ui: NalapideProvisionUi = {
        clientId,
        clientSecret,
        obtainedAtIso: new Date().toISOString(),
      }

      setProvision(ui)

      // UX: mostra e seleciona para copiar com facilidade
      setShowSecret(true)
      setTimeout(() => {
        try {
          provisionSecretRef.current?.focus?.()
          provisionSecretRef.current?.select?.()
        } catch {
          // noop
        }
      }, 50)
    } catch (e: any) {
      const msg = safe(e?.message) || 'Falha ao provisionar na NaLápide.'
      setProvisionErr(msg)
    } finally {
      setProvisioning(false)
    }
  }

  // Pós-save: quando saving transita de true -> false e há provision pendente, provisiona.
  useEffect(() => {
    const prev = prevSavingRef.current
    prevSavingRef.current = saving

    const finishedSaving = prev === true && saving === false
    if (!finishedSaving) return
    if (!pendingProvisionAfterSaveRef.current) return

    pendingProvisionAfterSaveRef.current = false

    // setTimeout para evitar “setState síncrono” no effect (evita cascata de render)
    setTimeout(() => {
      runProvisionNow()
    }, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving])

  function provisionNalapide() {
    clearOperationalOutputs()

    if (!enabled) {
      onSave({ enabled: false })
      return
    }

    const cid = safe(nalapideId) || defaultNalapideId(tenant)
    const b = safe(baseUrl) || defaultBaseUrl(tenant)

    if (!cid || !b) {
      setProvisionErr('Informe nalapideId e baseUrl para provisionar.')
      return
    }

    // 1) salva config
    const payload: ApiClientNalapideUpdateRequest = {
      enabled: true,
      nalapideId: cid,
      baseUrl: b,
    }

    // 2) provisiona automaticamente ao final do save
    pendingProvisionAfterSaveRef.current = true
    onSave(payload)
  }

  function saveClientSecret() {
    clearOperationalOutputs()

    if (!enabled) return

    const cid = safe(nalapideId) || defaultNalapideId(tenant)
    const b = safe(baseUrl) || defaultBaseUrl(tenant)

    if (!cid || !b) {
      setTokenErr('Informe nalapideId e baseUrl.')
      return
    }
    if (!safe(clientSecretPlain)) {
      setTokenErr('Informe um clientSecret para salvar.')
      return
    }

    const payload: ApiClientNalapideUpdateRequest = {
      enabled: true,
      nalapideId: cid,
      baseUrl: b,
      clientSecret: safe(clientSecretPlain),
    }

    // ✅ não limpa o campo 3 (mantém preenchido)
    onSave(payload)
  }

  async function fetchAccessToken() {
    if (!enabled) return
    if (saving || provisioning || tokenLoading) return

    setTokenErr('')
    setToken(null)

    const cid = safe(nalapideId) || defaultNalapideId(tenant)
    const b = safe(baseUrl) || defaultBaseUrl(tenant)

    if (!cid || !b) {
      setTokenErr('Informe nalapideId e baseUrl.')
      return
    }
    if (!safe(clientSecretPlain)) {
      setTokenErr('Informe o clientSecret (campo 3) para obter o access_token.')
      return
    }

    setTokenLoading(true)
    try {
      const res = await http.post<any>(endpoints.apiClientNalapideToken(Number(tenant.id)), {
        clientSecret: safe(clientSecretPlain),
      })

      const accessToken = safe(res?.accessToken || res?.access_token)
      if (!accessToken) {
        setTokenErr('Resposta sem access_token.')
        return
      }

      const ui: NalapideTokenUi = {
        accessToken,
        tokenType: safe(res?.tokenType || res?.token_type) || null,
        scope: safe(res?.scope) || null,
        expiresIn:
          typeof res?.expiresIn === 'number'
            ? res.expiresIn
            : typeof res?.expires_in === 'number'
              ? res.expires_in
              : null,
        obtainedAtIso: new Date().toISOString(),
      }

      setToken(ui)

      setTimeout(() => {
        try {
          tokenInputRef.current?.focus?.()
          tokenInputRef.current?.select?.()
        } catch {
          // noop
        }
      }, 50)
    } catch (e: any) {
      const msg = safe(e?.message) || 'Falha ao obter token.'
      setTokenErr(msg)
    } finally {
      setTokenLoading(false)
    }
  }

  const canProvision =
    !saving &&
    !provisioning &&
    !tokenLoading &&
    (enabled ? Boolean(safe(nalapideId) && safe(baseUrl)) : true) &&
    (enabled ? dirtyConfig || true : true)

  const canSaveSecret =
    !saving &&
    !provisioning &&
    !tokenLoading &&
    enabled &&
    Boolean(safe(nalapideId) && safe(baseUrl)) &&
    Boolean(safe(clientSecretPlain))

  const canGetToken =
    !saving &&
    !provisioning &&
    !tokenLoading &&
    enabled &&
    Boolean(safe(nalapideId) && safe(baseUrl)) &&
    Boolean(safe(clientSecretPlain))

  return (
    <div className="awis-stack" style={{ gap: 14 }}>
      {/* Header */}
      <div className="awis-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div className="awis-section-title">NaLápide</div>
          <div className="awis-muted" style={{ marginTop: 4 }}>
            Gestão por tenant. O secret não é exibido depois; use o campo em claro apenas para definir e gerar token.
          </div>
        </div>

        <div className="awis-row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {enabled ? <Badge>ATIVA</Badge> : <Badge variant="muted">INATIVA</Badge>}
          {enabled && hasSecretHash ? (
            <Badge variant="muted">PROVISIONADO</Badge>
          ) : enabled ? (
            <Badge>PENDENTE</Badge>
          ) : null}
          {provisioning ? <Badge variant="muted">PROVISIONANDO…</Badge> : null}
        </div>
      </div>

      {/* Habilitar + Identidade */}
      <div className="awis-callout">
        <label className="awis-check">
          <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
          <span>Habilitar integração</span>
        </label>

        <div className="awis-row" style={{ justifyContent: 'space-between', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <div className="awis-muted" style={{ fontSize: 12 }}>
            <span className="awis-mono">X-Progem-ID</span>: <span className="awis-mono">{tenant.empresaId}</span>
          </div>
          <div className="awis-muted" style={{ fontSize: 12 }}>
            Tenant: <span className="awis-mono">{safe(tenant.clientId)}</span> • apiClientId:{' '}
            <span className="awis-mono">{tenant.id}</span>
          </div>
        </div>
      </div>

      {/* 1) Configuração + CTA principal */}
      <div className="awis-callout" style={!enabled ? { opacity: 0.6 } : undefined}>
        <div className="awis-row" style={{ justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
          <div style={{ fontWeight: 700 }}>Configuração</div>
          <Badge variant="muted">PUT /api-clients/:id/nalapide</Badge>
        </div>

        <div style={{ height: 12 }} />

        <Input
          label="nalapideId"
          placeholder={tenant.clientId ? `padrão: ${safe(tenant.clientId)}` : 'ex: saobento'}
          value={nalapideId}
          onChange={(e) => {
            setNalapideId(e.target.value)
            clearOperationalOutputs()
          }}
          disabled={!enabled || saving || provisioning || tokenLoading}
        />

        <div style={{ height: 10 }} />

        <Input
          label="baseUrl"
          placeholder="https://api.nalapide.com"
          value={baseUrl}
          onChange={(e) => {
            setBaseUrl(e.target.value)
            clearOperationalOutputs()
          }}
          disabled={!enabled || saving || provisioning || tokenLoading}
        />

        {enabled && (!safe(nalapideId) || !safe(baseUrl)) ? (
          <div className="hint" style={{ marginTop: 8 }}>
            Para continuar, informe <span className="awis-mono">nalapideId</span> e <span className="awis-mono">baseUrl</span>.
          </div>
        ) : null}

        <div style={{ height: 12 }} />

        <div className="awis-row" style={{ justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <Button
            variant={!enabled ? 'danger' : 'primary'}
            onClick={provisionNalapide}
            disabled={!canProvision || (enabled ? !step1Valid : false)}
            title={!enabled ? 'Desabilitar e limpar configuração' : 'Salvar e provisionar na NaLápide'}
          >
            {saving ? 'Processando…' : enabled ? 'Provisionar NaLápide' : 'Desabilitar'}
          </Button>
        </div>

        {provisionErr ? (
          <div className="hint" style={{ marginTop: 10 }}>
            <span style={{ fontWeight: 700 }}>Falha:</span> {provisionErr}
          </div>
        ) : null}

        {provision?.clientSecret ? (
          <div className="awis-callout" style={{ marginTop: 12 }}>
            <div className="awis-row" style={{ justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <div style={{ fontWeight: 800 }}>Secret provisionado (1x)</div>
              <Badge variant="muted">copie agora</Badge>
            </div>

            <div style={{ height: 10 }} />

            <Input
              label="clientSecret (provisionado)"
              value={provision.clientSecret}
              type="text"
              onChange={() => {}}
              disabled={false}
              ref={provisionSecretRef}
              rightSlot={
                <Button
                  type="button"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(provision.clientSecret)
                    } catch {
                      try {
                        provisionSecretRef.current?.focus?.()
                        provisionSecretRef.current?.select?.()
                      } catch {
                        // noop
                      }
                    }
                  }}
                >
                  Copiar
                </Button>
              }
            />

            <div className="hint" style={{ marginTop: 8 }}>
              Se você for definir um secret definitivo abaixo, pode seguir sem guardar este.
            </div>
          </div>
        ) : null}
      </div>

      {/* 3) Definir clientSecret (e reutiliza no token) */}
      <div className="awis-callout" style={!enabled ? { opacity: 0.6 } : undefined}>
        <div className="awis-row" style={{ justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
          <div style={{ fontWeight: 700 }}>clientSecret (definitivo)</div>
          <Badge variant="muted">PUT /api-clients/:id/nalapide</Badge>
        </div>

        <div className="hint" style={{ marginTop: 8 }}>
          O valor é enviado em claro para a NaLápide; o Progem armazena apenas o HASH retornado. Este campo também é usado para obter o token.
        </div>

        <div style={{ height: 10 }} />

        <Input
          label="clientSecret"
          placeholder="Cole/defina um secret forte"
          type={showSecret ? 'text' : 'password'}
          value={clientSecretPlain}
          onChange={(e) => {
            setClientSecretPlain(e.target.value)
            setToken(null)
            setTokenErr('')
          }}
          disabled={!canEdit && enabled}
          rightSlot={
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowSecret((s) => !s)}
              disabled={saving || provisioning || tokenLoading}
            >
              {showSecret ? 'Ocultar' : 'Ver'}
            </Button>
          }
        />

        <div style={{ height: 12 }} />

        <div className="awis-row" style={{ justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={saveClientSecret} disabled={!canSaveSecret} title="Salvar clientSecret na NaLápide">
            {saving ? 'Salvando…' : 'Salvar clientSecret'}
          </Button>
        </div>
      </div>

      {/* 4) Token (sem input extra; usa o campo acima) */}
      <div className="awis-callout" style={!enabled ? { opacity: 0.6 } : undefined}>
        <div className="awis-row" style={{ justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
          <div style={{ fontWeight: 700 }}>OAuth2 Token (client_credentials)</div>
          <Badge variant="muted">POST /api-clients/:id/nalapide/oauth2:token</Badge>
        </div>

        <div className="hint" style={{ marginTop: 8 }}>
          O token será obtido usando o <span className="awis-mono">clientSecret</span> informado acima.
        </div>

        <div style={{ height: 10 }} />

        <div className="awis-row" style={{ justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="ghost" onClick={fetchAccessToken} disabled={!canGetToken} title="Obter access_token">
            {tokenLoading ? 'Obtendo…' : 'Obter access_token'}
          </Button>

          <Button
            variant="ghost"
            onClick={() => {
              setToken(null)
              setTokenErr('')
            }}
            disabled={tokenLoading || (!token && !tokenErr)}
          >
            Limpar
          </Button>
        </div>

        {tokenErr ? (
          <div className="hint" style={{ marginTop: 8 }}>
            <span style={{ fontWeight: 700 }}>Falha:</span> {tokenErr}
          </div>
        ) : null}

        {token?.accessToken ? (
          <div className="awis-callout" style={{ marginTop: 12 }}>
            <div className="awis-row" style={{ justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <div style={{ fontWeight: 800 }}>access_token</div>
              <div className="awis-row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {token.tokenType ? <Badge variant="muted">{token.tokenType}</Badge> : null}
                {token.expiresIn ? <Badge variant="muted">expira em {token.expiresIn}s</Badge> : null}
                {token.scope ? <Badge variant="muted">{token.scope}</Badge> : null}
              </div>
            </div>

            <div style={{ height: 10 }} />

            <Input
              label="access_token"
              value={token.accessToken}
              type="text"
              onChange={() => {}}
              disabled={false}
              ref={tokenInputRef}
              rightSlot={
                <Button
                  type="button"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(token.accessToken)
                    } catch {
                      try {
                        tokenInputRef.current?.focus?.()
                        tokenInputRef.current?.select?.()
                      } catch {
                        // noop
                      }
                    }
                  }}
                >
                  Copiar
                </Button>
              }
            />

            <div className="hint" style={{ marginTop: 8 }}>
              Token para testes imediatos (Postman/Insomnia). Não é persistido pela UI.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
