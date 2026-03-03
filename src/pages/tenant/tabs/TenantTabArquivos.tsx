import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../../ui/Badge'
import { Button } from '../../../ui/Button'
import { Card } from '../../../ui/Card'
import { ConfirmDialog } from '../../../ui/ConfirmDialog'
import { Input } from '../../../ui/Input'
import { Toast } from '../../../ui/Toast'
import { http } from '../../../api/http'
import { endpoints } from '../../../api/endpoints'
import type { S3AssetItem, S3AssetListResponse } from '../types'

type ToastState = { kind: 'success' | 'error'; message: string } | null

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

function prettySize(bytes?: number | null) {
  const b = Number(bytes ?? 0)
  if (!Number.isFinite(b) || b <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let n = b
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n = n / 1024
    i++
  }
  const v = i === 0 ? String(Math.round(n)) : n.toFixed(n >= 10 ? 1 : 2)
  return `${v} ${units[i]}`
}

function splitPath(path: string) {
  const p = safe(path).replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
  if (!p) return []
  return p.split('/').filter(Boolean)
}

function joinPath(parts: string[]) {
  return parts.filter(Boolean).join('/')
}

function fmtDateTime(v?: string | null) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

/**
 * Monta URL pública do asset:
 * base: https://whitelabel.progem.com.br/arquivos/{empresaId}/
 * key pode vir:
 *  - arquivos/{empresaId}/pasta/x.png
 *  - {empresaId}/pasta/x.png
 *  - pasta/x.png (relativo)
 */
function buildPublicUrl(assetsBaseUrl: string, empresaId: number, key: string) {
  const base = normalizeBaseUrl(assetsBaseUrl)
  const k0 = safe(key).replace(/^\/+/, '').replace(/\\/g, '/')

  const prefixA = `arquivos/${empresaId}/`
  const prefixB = `${empresaId}/`

  let rel = k0
  if (rel.startsWith(prefixA)) rel = rel.slice(prefixA.length)
  else if (rel.startsWith(prefixB)) rel = rel.slice(prefixB.length)

  // Evita ".." e normaliza múltiplas barras
  rel = rel.replace(/\.\.(\/|\\)/g, '').replace(/\/{2,}/g, '/').replace(/^\/+/, '')

  return encodeURI(`${base}/${rel}`)
}

export function TenantTabArquivos({ apiClientId, empresaId }: Props) {
  const [toast, setToast] = useState<ToastState>(null)
  const [loading, setLoading] = useState(true)

  const [path, setPath] = useState<string>('')
  const [list, setList] = useState<S3AssetListResponse | null>(null)

  const [newFolder, setNewFolder] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; item?: S3AssetItem }>({ open: false })

  const crumbs = useMemo(() => splitPath(path), [path])

  // ✅ base pública dinâmica (empresaId)
  const assetsBaseUrl = useMemo(() => `https://whitelabel.progem.com.br/arquivos/${empresaId}/`, [empresaId])

  async function load(p = path) {
    setLoading(true)
    try {
      const res = await http.get<S3AssetListResponse>(endpoints.apiClientWhitelabelAssets(apiClientId, p))
      setList(res)
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message || 'Falha ao listar arquivos do S3.' })
      setList(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiClientId, path])

  function goToCrumb(indexInclusive: number) {
    if (indexInclusive < 0) {
      setPath('')
      return
    }
    const next = joinPath(crumbs.slice(0, indexInclusive + 1))
    setPath(next)
  }

  function openFolder(name: string) {
    const next = joinPath([...crumbs, name])
    setPath(next)
  }

  async function createFolder() {
    const name = safe(newFolder)
    if (!name) {
      setToast({ kind: 'error', message: 'Informe o nome da pasta.' })
      return
    }

    setCreatingFolder(true)
    try {
      await http.post(endpoints.apiClientWhitelabelCreateFolder(apiClientId), { currentPath: path, name })
      setNewFolder('')
      setToast({ kind: 'success', message: 'Pasta criada com sucesso.' })
      await load(path)
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message || 'Falha ao criar pasta.' })
    } finally {
      setCreatingFolder(false)
    }
  }

  async function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0) return

    setUploading(true)
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', f)
        await http.postForm(endpoints.apiClientWhitelabelUpload(apiClientId, path), fd)
      }
      setToast({ kind: 'success', message: `Upload concluído (${files.length} arquivo(s)).` })
      await load(path)
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message || 'Falha no upload.' })
    } finally {
      setUploading(false)
    }
  }

  async function deleteNow() {
    const item = confirmDelete.item
    if (!item?.key) return
    setConfirmDelete({ open: false })
    try {
      await http.del(endpoints.apiClientWhitelabelDelete(apiClientId, item.key))
      setToast({ kind: 'success', message: 'Removido com sucesso.' })
      await load(path)
    } catch (e: any) {
      setToast({ kind: 'error', message: e?.message || 'Falha ao remover.' })
    }
  }

  const items = list?.items ?? []
  const folders = items.filter((i) => i.type === 'FOLDER')
  const files = items.filter((i) => i.type === 'FILE')

  const busy = loading || uploading || creatingFolder

  return (
    <div className="s3-wrap">
      {toast ? <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} /> : null}

      {/* Top chips / status (mobile friendly scroll) */}
      <div className="s3-topChips" aria-label="Status">
        <Badge variant="muted">
          Bucket: <span className="awis-mono">{list?.bucket ?? '—'}</span>
        </Badge>

        <Badge variant="muted">
          Namespace: <span className="awis-mono">arquivos/{empresaId}/</span>
        </Badge>

        <Badge>
          Pasta: <span className="awis-mono">/{safe(path) || ''}</span>
        </Badge>

        <Badge variant="muted">
          {folders.length} pasta(s) • {files.length} arquivo(s)
        </Badge>

        {/* ✅ opcional: mostra a base pública que será usada ao abrir */}
        <Badge variant="muted">
          Base: <span className="awis-mono">{assetsBaseUrl}</span>
        </Badge>
      </div>

      <Card title="Arquivos do Whitelabel" subtitle="Gerencie pastas e arquivos no S3.">
        <div className="s3-card">
          {/* Breadcrumbs (scroll horizontal) */}
          <div className="s3-breadcrumbs">
            <Button
              variant="ghost"
              onClick={() => goToCrumb(-1)}
              disabled={loading || !crumbs.length}
              title="Abrir raiz"
            >
              Root
            </Button>

            {crumbs.map((c, idx) => (
              <div key={`${c}-${idx}`} className="s3-crumb">
                <span className="s3-crumbSep">/</span>
                <Button variant="ghost" onClick={() => goToCrumb(idx)} disabled={loading} title="Abrir">
                  {c}
                </Button>
              </div>
            ))}

            <div className="s3-breadcrumbsRight">
              <Button variant="ghost" onClick={() => load(path)} disabled={busy} title="Recarregar listagem">
                {loading ? 'Carregando…' : 'Recarregar'}
              </Button>
            </div>
          </div>

          <div className="awis-divider" />

          {/* Actions */}
          <div className="s3-actions">
            <div className="s3-actionBlock">
              <div className="awis-label">Nova pasta</div>
              <div className="s3-actionRow">
                <Input
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  placeholder="ex: logos, hero, icons"
                  disabled={busy}
                />
                <Button onClick={createFolder} disabled={busy || !safe(newFolder)}>
                  {creatingFolder ? 'Criando…' : 'Criar'}
                </Button>
              </div>
              <div className="s3-hint">
                Dica: use nomes curtos e consistentes (ex: <span className="awis-mono">logos</span>,{' '}
                <span className="awis-mono">icons</span>).
              </div>
            </div>

            <div className="s3-actionBlock">
              <div className="awis-label">Upload</div>

              <div className="s3-actionRow">
                <label className="s3-uploadBtn">
                  <input
                    className="s3-uploadInput"
                    type="file"
                    multiple
                    disabled={busy}
                    onChange={(e) => onPickFiles(e.target.files)}
                  />
                  <span>{uploading ? 'Enviando…' : 'Selecionar arquivos'}</span>
                </label>

                <Badge variant="muted">{safe(path) ? `Destino: /${safe(path)}` : 'Destino: / (root)'}</Badge>
              </div>

              <div className="s3-hint">Uploads múltiplos são enviados sequencialmente para manter estabilidade.</div>
            </div>
          </div>

          <div className="awis-divider" />

          {/* List */}
          {loading ? (
            <div className="s3-state">
              <div className="s3-stateTitle">Carregando…</div>
              <div className="s3-stateSub">Listando objetos no S3.</div>
            </div>
          ) : folders.length === 0 && files.length === 0 ? (
            <div className="s3-empty">
              <div className="s3-emptyTitle">Nenhum item nesta pasta</div>
              <div className="s3-emptySub">Crie uma pasta ou envie arquivos para começar.</div>
            </div>
          ) : (
            <div className="s3-lists">
              {/* Folders */}
              {folders.length ? (
                <div className="s3-section">
                  <div className="s3-sectionHeader">
                    <div className="s3-sectionTitle">Pastas</div>
                    <Badge variant="muted">{folders.length}</Badge>
                  </div>

                  <div className="s3-list">
                    {folders.map((f) => (
                      <div key={f.key} className="s3-row">
                        <button
                          className="s3-rowMain"
                          type="button"
                          onClick={() => openFolder(f.name)}
                          disabled={busy}
                          title="Abrir pasta"
                        >
                          <div className="s3-icon">📁</div>
                          <div className="s3-rowTexts">
                            <div className="s3-rowTitle">{f.name}</div>
                            <div className="s3-rowMeta awis-mono">{f.key}</div>
                          </div>
                        </button>

                        <div className="s3-rowActions">
                          <Button
                            variant="danger"
                            onClick={() => setConfirmDelete({ open: true, item: f })}
                            disabled={busy}
                          >
                            Excluir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Files */}
              {files.length ? (
                <div className="s3-section">
                  <div className="s3-sectionHeader">
                    <div className="s3-sectionTitle">Arquivos</div>
                    <Badge variant="muted">{files.length}</Badge>
                  </div>

                  <div className="s3-list">
                    {files.map((f) => {
                      const publicUrl = buildPublicUrl(assetsBaseUrl, empresaId, f.key)

                      return (
                        <div key={f.key} className="s3-row">
                          <div className="s3-rowMainWrap">
                            <div className="s3-icon">📄</div>

                            <div className="s3-rowTexts">
                              <div className="s3-rowTitle">
                                <a className="awis-link" href={publicUrl} target="_blank" rel="noreferrer">
                                  {f.name}
                                </a>
                              </div>

                              <div className="s3-fileMeta">
                                <Badge variant="muted">{prettySize(f.size as any)}</Badge>
                                <span className="s3-dot">•</span>
                                <span className="s3-muted">{fmtDateTime(f.lastModified)}</span>
                              </div>

                              <div className="s3-rowMeta awis-mono">{f.key}</div>
                            </div>
                          </div>

                          <div className="s3-rowActions">
                            <Button
                              variant="danger"
                              onClick={() => setConfirmDelete({ open: true, item: f })}
                              disabled={busy}
                            >
                              Excluir
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDelete.open}
        title="Excluir item"
        description={`Confirma excluir "${confirmDelete.item?.name ?? ''}"?`}
        confirmText="Excluir"
        danger
        onConfirm={deleteNow}
        onClose={() => setConfirmDelete({ open: false })}
      />
    </div>
  )
}