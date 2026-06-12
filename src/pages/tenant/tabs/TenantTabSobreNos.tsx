import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '../../../ui/Badge'
import { Button } from '../../../ui/Button'
import { Card } from '../../../ui/Card'
import { ConfirmDialog } from '../../../ui/ConfirmDialog'
import { Toast } from '../../../ui/Toast'
import { http } from '../../../api/http'
import { endpoints } from '../../../api/endpoints'

type ToastState = { kind: 'success' | 'error'; message: string } | null

type AboutGalleryItem = {
  image?: string
  caption?: string
}

type AboutContent = {
  enabled?: boolean
  title?: string
  photo?: string
  gallery?: AboutGalleryItem[]
  seo?: { ogImage?: string }
}

type BrandingManifest = {
  assetsRevision?: number
  v?: number
  assetsBaseUrl?: string
  content?: { about?: AboutContent }
  updatedAt?: string
}

type AboutAssetSlot = {
  key: string
  label: string
  hint?: string
  path?: string
  previewAspect?: string
}

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

function getAbout(manifest: BrandingManifest | null): AboutContent | null {
  const about = manifest?.content?.about
  return about && typeof about === 'object' ? about : null
}

function buildAboutSlots(about: AboutContent | null): AboutAssetSlot[] {
  if (!about) return []

  const slots: AboutAssetSlot[] = []

  if (about.photo) {
    slots.push({
      key: 'photo',
      label: 'Foto principal',
      hint: 'Hero da página Sobre nós',
      path: about.photo,
      previewAspect: '3 / 2',
    })
  }

  const gallery = Array.isArray(about.gallery) ? about.gallery : []
  gallery.forEach((item, index) => {
    if (!item?.image) return
    slots.push({
      key: `gallery-${index}`,
      label: `Galeria ${index + 1}`,
      hint: item.caption || `Imagem ${index + 1} da galeria`,
      path: item.image,
      previewAspect: '4 / 3',
    })
  })

  const ogImage = about.seo?.ogImage
  if (ogImage && ogImage !== about.photo) {
    slots.push({
      key: 'seo-ogImage',
      label: 'Preview social (OG)',
      hint: 'Imagem ao compartilhar o link da página',
      path: ogImage,
      previewAspect: '1200 / 630',
    })
  }

  return slots
}

export function TenantTabSobreNos({ apiClientId, empresaId }: Props) {
  const [toast, setToast] = useState<ToastState>(null)
  const [loading, setLoading] = useState(true)
  const [manifest, setManifest] = useState<BrandingManifest | null>(null)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; assetKey?: string }>({ open: false })

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const assetsBaseUrl = useMemo(
    () => manifest?.assetsBaseUrl || `https://whitelabel.progem.com.br/arquivos/${empresaId}/`,
    [manifest?.assetsBaseUrl, empresaId]
  )

  const revision = manifest?.assetsRevision ?? manifest?.v ?? 0
  const about = getAbout(manifest)
  const slots = useMemo(() => buildAboutSlots(about), [about])
  const galleryCount = Array.isArray(about?.gallery) ? about!.gallery!.length : 0
  const nextGalleryKey = `gallery-${galleryCount}`

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

  async function initAbout() {
    setInitializing(true)
    try {
      const res = await http.post<BrandingManifest>(endpoints.apiClientBrandingAboutInit(apiClientId))
      setManifest(res)
      setToast({ kind: 'success', message: 'Estrutura da página Sobre nós preparada no manifest.' })
      await load()
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message || 'Falha ao inicializar página Sobre nós.' })
    } finally {
      setInitializing(false)
    }
  }

  async function onPickFile(assetKey: string, files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]

    setUploadingKey(assetKey)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await http.postForm<{ manifest?: BrandingManifest }>(
        endpoints.apiClientBrandingAboutUpload(apiClientId, assetKey),
        fd
      )
      setManifest(res?.manifest ?? manifest)
      setToast({
        kind: 'success',
        message: `Imagem atualizada (rev. ${res?.manifest?.assetsRevision ?? '?'}) — o whitelabel reflete em até ~45s.`,
      })
      await load()
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message || 'Falha no upload.' })
    } finally {
      setUploadingKey(null)
      const input = fileRefs.current[assetKey]
      if (input) input.value = ''
    }
  }

  async function deleteAssetNow() {
    const assetKey = confirmDelete.assetKey
    if (!assetKey) return
    setConfirmDelete({ open: false })
    try {
      const res = await http.del<BrandingManifest>(endpoints.apiClientBrandingAboutDelete(apiClientId, assetKey))
      setManifest(res)
      setToast({ kind: 'success', message: 'Imagem removida do bucket (path mantido no manifest).' })
      await load()
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message || 'Falha ao remover imagem.' })
    }
  }

  function renderAssetCard(slot: AboutAssetSlot) {
    const previewUrl = slot.path ? buildPreviewUrl(assetsBaseUrl, slot.path, revision) : ''
    const busy = uploadingKey === slot.key

    return (
      <Card key={slot.key} title={slot.label} subtitle={slot.hint || slot.key}>
        <div className="awis-stack" style={{ gap: 10 }}>
          <div className="awis-muted awis-mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>
            Path canônico: {slot.path || '—'}
          </div>

          {previewUrl ? (
            <div className="awis-row awis-row--wrap" style={{ gap: 12, alignItems: 'center' }}>
              <img
                src={previewUrl}
                alt={slot.label}
                style={{
                  maxWidth: 280,
                  maxHeight: 160,
                  aspectRatio: slot.previewAspect || '4 / 3',
                  objectFit: 'cover',
                  border: '1px solid rgba(127,127,127,0.25)',
                  borderRadius: 8,
                }}
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.opacity = '0.35'
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
                fileRefs.current[slot.key] = el
              }}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => onPickFile(slot.key, e.target.files)}
            />
            <Button variant="primary" disabled={busy} onClick={() => fileRefs.current[slot.key]?.click()}>
              {busy ? 'Enviando…' : 'Substituir imagem'}
            </Button>
            {slot.path ? (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => setConfirmDelete({ open: true, assetKey: slot.key })}
              >
                Remover do bucket
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="awis-stack" style={{ gap: 14 }}>
      {toast ? <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} /> : null}

      <div>
        <div className="awis-section-title">Página Sobre nós — imagens</div>
        <div className="awis-muted" style={{ marginTop: 4 }}>
          Upload guiado com overwrite no path canônico (<span className="awis-mono">sobre/…</span>). Cada substituição
          incrementa <span className="awis-mono">assetsRevision</span> e o whitelabel aplica{' '}
          <span className="awis-mono">?v={'{revision}'}</span> automaticamente — sem renomear arquivos manualmente.
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
      ) : !about ? (
        <Card title="Página ainda não configurada no manifest">
          <div className="awis-stack" style={{ gap: 12 }}>
            <div className="awis-muted">
              O whitelabel precisa de <span className="awis-mono">content.about</span> no manifest da API. Inicialize
              para criar/reparar paths da galeria (<span className="awis-mono">sobre-nos2.jpg</span>,{' '}
              <span className="awis-mono">sobre-nos3.jpg</span>…) alinhados ao JSON do tenant.
            </div>
            <Button variant="primary" disabled={initializing} onClick={initAbout}>
              {initializing ? 'Preparando…' : 'Preparar / reparar galeria'}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="awis-stack" style={{ gap: 12 }}>
          {about.title ? (
            <Badge variant="muted">
              Título no site: <span className="awis-mono">{about.title}</span>
            </Badge>
          ) : null}

          {slots.length === 0 ? (
            <Card title="Nenhuma imagem configurada">
              <div className="awis-muted">
                Defina <span className="awis-mono">photo</span> e/ou <span className="awis-mono">gallery</span> no
                manifest (import JSON) ou use o botão abaixo para adicionar à galeria.
              </div>
            </Card>
          ) : (
            slots.map((slot) => renderAssetCard(slot))
          )}

          <Card title="Adicionar imagem à galeria" subtitle={`Próximo slot: ${nextGalleryKey}`}>
            <div className="awis-stack" style={{ gap: 10 }}>
              <div className="awis-muted">
                Cria ou substitui o item no índice {galleryCount}. Paths padrão:{' '}
                <span className="awis-mono">sobre/sobre-nos2.jpg</span>,{' '}
                <span className="awis-mono">sobre-nos3.jpg</span>… (capa ={' '}
                <span className="awis-mono">sobre-nos.jpg</span>).
              </div>
              <div className="awis-row awis-row--wrap" style={{ gap: 8 }}>
                <input
                  ref={(el) => {
                    fileRefs.current[nextGalleryKey] = el
                  }}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => onPickFile(nextGalleryKey, e.target.files)}
                />
                <Button
                  variant="primary"
                  disabled={uploadingKey === nextGalleryKey}
                  onClick={() => fileRefs.current[nextGalleryKey]?.click()}
                >
                  {uploadingKey === nextGalleryKey ? 'Enviando…' : 'Enviar nova imagem'}
                </Button>
              </div>
            </div>
          </Card>

          {!about.photo ? (
            <Card title="Foto principal" subtitle="Slot: photo">
              <div className="awis-stack" style={{ gap: 10 }}>
                <div className="awis-muted">
                  Nenhum path de foto no manifest. O primeiro upload usará{' '}
                  <span className="awis-mono">sobre/sobre-nos.jpg</span> (ou o nome do arquivo enviado).
                </div>
                <div className="awis-row awis-row--wrap" style={{ gap: 8 }}>
                  <input
                    ref={(el) => {
                      fileRefs.current.photo = el
                    }}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => onPickFile('photo', e.target.files)}
                  />
                  <Button
                    variant="primary"
                    disabled={uploadingKey === 'photo'}
                    onClick={() => fileRefs.current.photo?.click()}
                  >
                    {uploadingKey === 'photo' ? 'Enviando…' : 'Enviar foto principal'}
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete.open}
        title="Remover imagem do bucket"
        description={`Confirma excluir o arquivo S3 de "${confirmDelete.assetKey}"? O path canônico permanece no manifest.`}
        confirmText="Remover"
        danger
        onConfirm={deleteAssetNow}
        onClose={() => setConfirmDelete({ open: false })}
      />
    </div>
  )
}
