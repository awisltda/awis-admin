import type { WebhookEndpointDTO } from './types'

export function toNumber(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function normalizeDomain(raw: string) {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return ''
  let d = s.replace(/^https?:\/\//, '')
  while (d.endsWith('/')) d = d.slice(0, -1)
  return d.trim()
}

export function normalizeUrl(raw: string) {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  return `https://${s}`
}

export function normalizeEventos(v: WebhookEndpointDTO['eventos']) {
  const arr = Array.isArray(v) ? v : Array.from(v ?? [])
  return arr.map((x) => String(x).trim()).filter(Boolean)
}

export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function chunkScopes(scopes?: string) {
  const s = String(scopes ?? '').trim()
  if (!s) return []
  return s.split(/\s+/g).filter(Boolean)
}

export function extractApiMessage(e: any, fallback: string) {
  const msg =
    e?.response?.data?.message ??
    e?.data?.message ??
    e?.message ??
    (typeof e === 'string' ? e : null)

  if (msg && String(msg).trim()) return String(msg)

  const st = e?.response?.status
  if (st === 409) return 'Conflito de dados. Verifique se já existe um registro com os mesmos valores.'
  if (st === 400) return 'Dados inválidos. Verifique os campos e tente novamente.'
  if (st === 401) return 'Não autenticado. Faça login novamente.'
  if (st === 403) return 'Sem permissão para esta ação.'
  return fallback
}

export function withEmpresaHeader(empresaId: number) {
  return {
    headers: { 'X-Progem-ID': String(empresaId) },
  } as any
}
