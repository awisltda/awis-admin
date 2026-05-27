import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '../../../ui/Badge'
import { Button } from '../../../ui/Button'
import { Card } from '../../../ui/Card'
import { ConfirmDialog } from '../../../ui/ConfirmDialog'
import { Toast } from '../../../ui/Toast'
import { http } from '../../../api/http'
import { endpoints } from '../../../api/endpoints'

type ToastState = { kind: 'success' | 'error'; message: string } | null

type BrandingManifest = {
  assetsRevision?: number
  v?: number
  slug?: string
  assetsBaseUrl?: string
  brand?: Record<string, string>
  hero?: string
  updatedAt?: string
}

type BrandingSlot = {
  id: string
  label: string
  hint?: string
}

const SLOTS: BrandingSlot[] = [
  { id: 'logo', label: 'Logo (light)', hint: 'PNG/SVG recomendado' },
  { id: 'logoDark', label: 'Logo (dark)' },
  { id: 'favicon', label: 'Favicon (PNG)' },
  { id: 'faviconSvg', label: 'Favicon (SVG)' },
  { id: 'appleTouchIcon', label: 'Apple Touch Icon' },
  { id: 'pwaIcon192', label: 'PWA 192×192' },
  { id: 'pwaIcon512', label: 'PWA 512×512' },
  { id: 'maskableIcon512', label: 'PWA maskable 512×512' },
  { id: 'ogImage', label: 'OG / Social preview' },
  { id: 'hero', label: 'Hero image' },
]

type Props = {
  apiClientId: number
  empresaId: number
}

function safe(v?: string | null) {
  return (v ?? '').trim()
}

function normalizeBaseUrl(u?: string | null) {
  return safe(u).replace(/\/+$/, '')
}

function buildPreviewUrl(assetsBaseUrl: string, relativePath: string, revision: number) {
  const base = normalizeBaseUrl(assetsBaseUrl)
  const rel = safe(relativePath).replace(/^\/+/, '')
  if (!rel) return ''
  const url = encodeURI(`${base}/${rel}`)
  if (revision > 0) {
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}v=${revision}`
  }
  return url
}

function fmtDateTime(v?: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function TenantTabIdentidade({ apiClientId, empresaId }: Props) {
  const [toast, setToast] = useState<ToastState>(null)
  const [loading, setLoading] = useState(true)
  const [manifest, setManifest] = useState<BrandingManifest | null>(null)
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; slot?: string }>({ open: false })

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const assetsBaseUrl = useMemo(
    () => manifest?.assetsBaseUrl || `https://whitelabel.progem.com.br/arquivos/${empresaId}/`,
    [manifest?.assetsBaseUrl, empresaId]
  )

  const revision = manifest?.assetsRevision ?? manifest?.v ?? 0

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await http.get<BrandingManifest>(endpoints.apiClientBranding(apiClientId))
      setManifest(res)
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message || 'Falha ao carregar manifest de branding.' })
      setManifest(null)
    } finally {
      setLoading(false)
    }
  }, [apiClientId])

  useEffect(() => {
    load()
  }, [load])

  async function onPickFile(slot: string, files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]

    setUploadingSlot(slot)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await http.postForm(endpoints.apiClientBrandingUploadSlot(apiClientId, slot), fd)
      setManifest(res?.manifest ?? manifest)
      setToast({ kind: 'success', message: `${slot} atualizado (rev. ${res?.manifest?.assetsRevision ?? '?'})` })
      await load()
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message || 'Falha no upload.' })
    } finally {
      setUploadingSlot(null)
      const input = fileRefs.current[slot]
      if (input) input.value = ''
    }
  }

  async function deleteSlotNow() {
    const slot = confirmDelete.slot
    if (!slot) return
    setConfirmDelete({ open: false })
    try {
      const res = await http.del(endpoints.apiClientBrandingDeleteSlot(apiClientId, slot))
      setManifest(res)
      setToast({ kind: 'success', message: `${slot} removido do bucket (path canônico mantido no manifest).` })
      await load()
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message || 'Falha ao remover slot.' })
    }
  }

  return (
    <div className="awis-stack" style={{ gap: 14 }}>
      {toast ? <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} /> : null}

      <div>
        <div className="awis-section-title">Identidade visual</div>
        <div className="awis-muted" style={{ marginTop: 4 }}>
          O arquivo é salvo no path canônico do contrato (ex.: <span className="awis-mono">logo.png</span>,
          <span className="awis-mono"> planos.png</span>, <span className="awis-mono">sobre/hero-sobre.jpg</span>).
          Banners da capa e imagens da página Sobre também são reconhecidos quando listados no manifest/JSON do tenant.
          A versão visual é controlada por{' '}
          <span className="awis-mono">assetsRevision</span> — o whitelabel resolve{' '}
          <span className="awis-mono">?v={'{revision}'}</span> automaticamente.
        </div>
      </div>

      <div className="awis-row awis-row--wrap" style={{ gap: 10 }}>
        <Badge>
          assetsRevision: <span className="awis-mono">{revision}</span>
        </Badge>
        <Badge variant="muted">
          base: <span className="awis-mono">{assetsBaseUrl}</span>
        </Badge>
        <Badge variant="muted">atualizado: {fmtDateTime(manifest?.updatedAt)}</Badge>
        <Button variant="ghost" onClick={() => load()} disabled={loading}>
          Recarregar
        </Button>
      </div>

      {loading ? (
        <div className="awis-muted">Carregando manifest…</div>
      ) : (
        <div className="awis-stack" style={{ gap: 12 }}>
          {SLOTS.map((slot) => {
            const canonicalPath =
              manifest?.brand?.[slot.id] || (slot.id === 'hero' ? manifest?.hero : '')
            const previewUrl = canonicalPath ? buildPreviewUrl(assetsBaseUrl, canonicalPath, revision) : ''
            const busy = uploadingSlot === slot.id

            return (
              <Card key={slot.id} title={slot.label} subtitle={slot.hint || `Slot: ${slot.id}`}>
                <div className="awis-stack" style={{ gap: 10 }}>
                  {canonicalPath ? (
                    <div className="awis-muted awis-mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                      Path canônico: {canonicalPath}
                    </div>
                  ) : (
                    <div className="awis-muted">Nenhum path configurado no manifest (será usado fallback padrão no primeiro upload).</div>
                  )}

                  {previewUrl ? (
                    <div className="awis-row awis-row--wrap" style={{ gap: 12, alignItems: 'center' }}>
                      <img
                        src={previewUrl}
                        alt={slot.label}
                        style={{
                          maxWidth: 220,
                          maxHeight: 80,
                          objectFit: 'contain',
                          border: '1px solid rgba(127,127,127,0.25)',
                          borderRadius: 8,
                          padding: 6,
                          background: 'rgba(127,127,127,0.06)',
                        }}
                        onError={(e) => {
                          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                        }}
                      />
                      <div className="awis-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <a className="awis-link" href={previewUrl} target="_blank" rel="noreferrer">
                          Abrir preview
                        </a>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            copyToClipboard(previewUrl).then((ok) =>
                              setToast({
                                kind: ok ? 'success' : 'error',
                                message: ok ? 'URL copiada.' : 'Falha ao copiar URL.',
                              })
                            )
                          }
                        >
                          Copiar URL
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="awis-row awis-row--wrap" style={{ gap: 8 }}>
                    <input
                      ref={(el) => {
                        fileRefs.current[slot.id] = el
                      }}
                      type="file"
                      accept="image/*,.svg"
                      style={{ display: 'none' }}
                      onChange={(e) => onPickFile(slot.id, e.target.files)}
                    />
                    <Button
                      variant="primary"
                      disabled={busy}
                      onClick={() => fileRefs.current[slot.id]?.click()}
                    >
                      {busy ? 'Enviando…' : canonicalPath ? 'Substituir' : 'Enviar'}
                    </Button>
                    {canonicalPath ? (
                      <Button variant="danger" disabled={busy} onClick={() => setConfirmDelete({ open: true, slot: slot.id })}>
                        Remover do bucket
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete.open}
        title="Remover asset do bucket"
        description={`Confirma excluir o arquivo S3 do slot "${confirmDelete.slot}"? O path canônico permanece no manifest/JSON.`}
        confirmText="Remover"
        danger
        onConfirm={deleteSlotNow}
        onClose={() => setConfirmDelete({ open: false })}
      />
    </div>
  )
}
