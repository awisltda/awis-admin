import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../../ui/Badge'
import { Button } from '../../../ui/Button'
import { ConfirmDialog } from '../../../ui/ConfirmDialog'
import { Toast } from '../../../ui/Toast'
import { http } from '../../../api/http'
import { endpoints } from '../../../api/endpoints'

type Ambiente = 'production' | 'sandbox'
type ToastState = { kind: 'success' | 'error'; message: string } | null

type ApiClientDetailResponse = {
  id: number
  nome: string
  clientId: string
  ativo: boolean
  empresaId: number
  escopos?: string | null
  dominio: string
}

type ApiClientRotateSecretResponse = {
  clientId: string
  clientSecret: string
}

type Props = {
  apiClientId: number
}

function safe(v?: string | null) {
  return (v ?? '').trim()
}

function normalizeDomainToUrl(dominio: string) {
  const d = safe(dominio)
  if (!d) return ''
  if (d.startsWith('http://') || d.startsWith('https://')) return d
  return `https://${d}`
}

function domainOnly(dominioOrUrl: string) {
  const d = safe(dominioOrUrl)
  return d.replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

function defaultSellerEmailFromDomain(dominioOrUrl: string) {
  const d = domainOnly(dominioOrUrl)
  return d ? `site@${d}` : ''
}

function buildFilename(clientId: string, ambiente: Ambiente) {
  const slug = clientId.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase()
  return `.env.${slug}.${ambiente}`
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
      return true
    } catch {
      return false
    }
  }
}

function generateEnv(params: {
  detail: ApiClientDetailResponse
  ambiente: Ambiente
  frontendUrl: string
  vendedorEmailPadrao: string
  clientSecret?: string | null
}) {
  const { detail, ambiente, frontendUrl, vendedorEmailPadrao, clientSecret } = params

  const progemBase =
    ambiente === 'production'
      ? 'https://api.progem.com.br'
      : 'https://sandbox-api.progem.com.br'

  return `
# ===============================
# IDENTIDADE / TENANT
# ===============================
TENANT=${detail.clientId}
PROGEM_TENANT_ID=${detail.empresaId}

# ===============================
# OAUTH (INTEGRADOR)
# ===============================
OAUTH_CLIENT_ID=${detail.clientId}
OAUTH_CLIENT_SECRET=${safe(clientSecret)}

# ===============================
# DOMÍNIO / CORS
# ===============================
FRONTEND_URL=${frontendUrl}
CORS_ORIGINS=${frontendUrl}
VENDEDOR_EMAIL_PADRAO=${vendedorEmailPadrao}

# ===============================
# PROGEM
# ===============================
PROGEM_BASE=${progemBase}
NODE_ENV=${ambiente}
TRUST_PROXY=1

# ===============================
# NALÁPIDE
# ===============================
NALAPIDE_API_BASE=https://api.nalapide.com
NALAPIDE_API_KEY=

# ===============================
# FIREBASE (GLOBAL)
# ===============================
VITE_FIREBASE_API_KEY=AIzaSyAa_GfEbL2E_r0cWurYYaxOoFXwYneg1S0
VITE_FIREBASE_AUTH_DOMAIN=progem-74681.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=progem-74681
VITE_FIREBASE_STORAGE_BUCKET=progem-74681
VITE_FIREBASE_MESSAGING_SENDER_ID=755848466064
VITE_FIREBASE_APP_ID=1:755848466064:web:2eb057f99cb56b20c79215
VITE_FIREBASE_VAPID_KEY=BNG123S-jFfo40xYZGvBN0gyDamxS2FIjFw0zyMOfRQ7Z8FBkCsYwtEYGB0qKsirPkWs1yNzw9BhO8gkzL5GAWs
`.trim()
}

export function TenantTabEnv({ apiClientId }: Props) {
  const [toast, setToast] = useState<ToastState>(null)
  const [ambiente, setAmbiente] = useState<Ambiente>('production')

  const [detail, setDetail] = useState<ApiClientDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Secret não é lido. Só aparece quando rotaciona (fluxo seguro).
  const [clientSecret, setClientSecret] = useState<string>('')

  // ajustes locais do artefato (não alteram cadastro)
  const [frontendUrlDraft, setFrontendUrlDraft] = useState('')
  const [vendedorEmailDraft, setVendedorEmailDraft] = useState('')

  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle')

  const [confirmRotate, setConfirmRotate] = useState(false)
  const [rotating, setRotating] = useState(false)

  useEffect(() => {
    let alive = true

    async function load() {
      setLoading(true)
      try {
        // ✅ endpoints são funções no seu projeto
        const res = await http.get<ApiClientDetailResponse>(endpoints.apiClientDetail(apiClientId))
        if (!alive) return

        setDetail(res)

        // defaults “bons”
        const url = normalizeDomainToUrl(res.dominio)
        const mail = defaultSellerEmailFromDomain(res.dominio)
        setFrontendUrlDraft(url)
        setVendedorEmailDraft(mail)
      } catch {
        if (!alive) return
        setToast({ kind: 'error', message: 'Não foi possível carregar os detalhes do tenant.' })
        setDetail(null)
      } finally {
        if (!alive) return
        setLoading(false)
      }
    }

    load()
    return () => {
      alive = false
    }
  }, [apiClientId])

  const frontendUrl = useMemo(() => normalizeDomainToUrl(frontendUrlDraft), [frontendUrlDraft])
  const vendedorEmailPadrao = useMemo(() => safe(vendedorEmailDraft), [vendedorEmailDraft])

  const missingSecret = !safe(clientSecret)
  const missingFrontend = !frontendUrl
  const missingEmail = !vendedorEmailPadrao

  const envSnippet = useMemo(() => {
    if (!detail) return ''
    return generateEnv({
      detail,
      ambiente,
      frontendUrl: frontendUrl || 'https://SEU-DOMINIO-AQUI.com.br',
      vendedorEmailPadrao: vendedorEmailPadrao || 'site@SEU-DOMINIO-AQUI.com.br',
      clientSecret,
    })
  }, [detail, ambiente, frontendUrl, vendedorEmailPadrao, clientSecret])

  async function handleCopy() {
    if (!envSnippet) return
    const ok = await copyToClipboard(envSnippet)
    setCopyState(ok ? 'ok' : 'fail')
    setToast(ok ? { kind: 'success', message: 'Copiado para a área de transferência.' } : { kind: 'error', message: 'Não foi possível copiar.' })
    window.setTimeout(() => setCopyState('idle'), 1600)
  }

  function handleDownload() {
    if (!detail) return
    const filename = buildFilename(detail.clientId, ambiente)
    downloadTextFile(filename, envSnippet + '\n')
    setToast({ kind: 'success', message: 'Arquivo .env baixado.' })
  }

  async function doRotateSecret() {
    setRotating(true)
    try {
      const res = await http.post<ApiClientRotateSecretResponse>(endpoints.apiClientRotateSecret(apiClientId), {})
      setClientSecret(res.clientSecret)
      setToast({ kind: 'success', message: 'Secret rotacionado. Atualize a Vercel imediatamente.' })
    } catch {
      setToast({ kind: 'error', message: 'Falha ao rotacionar o secret.' })
    } finally {
      setRotating(false)
      setConfirmRotate(false)
    }
  }

  if (loading) {
    return (
      <div className="awis-stack" style={{ gap: 14 }}>
        <div>
          <div className="awis-section-title">.env / Publicação Vercel</div>
          <div className="awis-muted" style={{ marginTop: 4 }}>Carregando…</div>
        </div>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="awis-stack" style={{ gap: 14 }}>
        {toast && <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} />}
        <div>
          <div className="awis-section-title">.env / Publicação Vercel</div>
          <div className="awis-muted" style={{ marginTop: 4 }}>
            Não foi possível carregar os detalhes do tenant.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="awis-stack" style={{ gap: 14 }}>
      {toast && <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} />}

      <ConfirmDialog
        open={confirmRotate}
        title="Rotacionar secret?"
        description="Isso invalida o secret atual. Após rotacionar, atualize as variáveis na Vercel do whitelabel imediatamente."
        confirmText={rotating ? 'Rotacionando…' : 'Rotacionar'}
        cancelText="Cancelar"
        onClose={() => setConfirmRotate(false)}
        onConfirm={doRotateSecret}
      />

      <div>
        <div className="awis-section-title">.env / Publicação Vercel</div>
        <div className="awis-muted" style={{ marginTop: 4 }}>
          Artefato pronto para importar na Vercel ao publicar o whitelabel. O <span className="awis-mono">X-Progem-ID</span> é sempre o{' '}
          <span className="awis-mono">empresaId</span> (unidade/matriz).
        </div>
      </div>

      <div className="awis-callout">
        <div className="awis-stack" style={{ gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Badge variant="muted">Ambiente</Badge>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant={ambiente === 'production' ? 'primary' : 'ghost'} onClick={() => setAmbiente('production')}>
                  Produção
                </Button>
                <Button variant={ambiente === 'sandbox' ? 'primary' : 'ghost'} onClick={() => setAmbiente('sandbox')}>
                  Sandbox
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="ghost" onClick={() => setConfirmRotate(true)}>
                Rotacionar secret
              </Button>
              <Button variant="ghost" onClick={handleDownload}>
                Baixar .env
              </Button>
              <Button variant="primary" onClick={handleCopy}>
                {copyState === 'ok' ? 'Copiado' : copyState === 'fail' ? 'Falhou' : 'Copiar tudo'}
              </Button>
            </div>
          </div>

          <div className="awis-muted" style={{ marginTop: 2 }}>
            Vercel: Settings → Environment Variables → cole/importe as linhas abaixo.
          </div>
        </div>
      </div>

      {(missingSecret || missingFrontend || missingEmail) && (
        <div className="awis-callout awis-callout--warn">
          <div style={{ fontWeight: 800 }}>Atenção antes de publicar</div>
          <div className="awis-muted" style={{ marginTop: 6 }}>
            {missingSecret && (
              <div>
                • <span className="awis-mono">OAUTH_CLIENT_SECRET</span> ainda não foi obtido. Use <b>Rotacionar secret</b> para gerar/exibir.
              </div>
            )}
            {missingFrontend && (
              <div>
                • Domínio inválido. Ajuste <span className="awis-mono">FRONTEND_URL</span> abaixo.
              </div>
            )}
            {missingEmail && (
              <div>
                • E-mail vazio. Ajuste <span className="awis-mono">VENDEDOR_EMAIL_PADRAO</span> abaixo.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="awis-callout">
        <div className="awis-stack" style={{ gap: 10 }}>
          <div style={{ fontWeight: 800 }}>Parâmetros do whitelabel</div>

          <div className="awis-stack" style={{ gap: 8 }}>
            <div className="awis-muted">Domínio do site</div>
            <input
              className="awis-input"
              value={frontendUrlDraft}
              onChange={(e) => setFrontendUrlDraft(e.target.value)}
              placeholder="https://suaempresa.com.br"
            />
          </div>

          <div className="awis-stack" style={{ gap: 8 }}>
            <div className="awis-muted">E-mail padrão do vendedor</div>
            <input
              className="awis-input"
              value={vendedorEmailDraft}
              onChange={(e) => setVendedorEmailDraft(e.target.value)}
              placeholder="site@suaempresa.com.br"
            />
          </div>

          <Badge variant="muted">Esses campos ajustam apenas o artefato .env (não alteram o cadastro)</Badge>
        </div>
      </div>

      <div className="awis-callout">
        <pre className="awis-code" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
          {envSnippet}
        </pre>
      </div>

      <div className="awis-callout awis-callout--warn">
        <div style={{ fontWeight: 800 }}>Regra de ouro</div>
        <div className="awis-muted" style={{ marginTop: 6 }}>
          O <span className="awis-mono">X-Progem-ID</span> é sempre o <span className="awis-mono">empresaId</span> (unidade/matriz).
          O <span className="awis-mono">clientId</span> identifica o integrador. Não confundir.
        </div>
      </div>

      <Badge variant="muted">Dica: gere, copie e cole na Vercel</Badge>
    </div>
  )
}