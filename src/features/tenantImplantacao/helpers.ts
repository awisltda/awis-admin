import type {
  TenantImplantacaoFase,
  TenantImplantacaoPrioridade,
  TenantImplantacaoStatus,
} from './types'

export const STATUS_OPTIONS: TenantImplantacaoStatus[] = [
  'NAO_INICIADO',
  'EM_IMPLANTACAO',
  'AGUARDANDO_CLIENTE',
  'BLOQUEADO',
  'HOMOLOGACAO',
  'CONCLUIDO',
]

export const FASE_OPTIONS: TenantImplantacaoFase[] = [
  'CADASTRO_BASE',
  'FILIAIS',
  'CREDENCIAIS_PROGEM',
  'NALAPIDE',
  'WEBHOOKS',
  'VERCEL_ENV',
  'ARQUIVOS_S3',
  'PUBLICACAO_FINAL',
]

export const PRIORIDADE_OPTIONS: TenantImplantacaoPrioridade[] = ['P0', 'P1', 'P2', 'P3']

const statusLabelMap: Record<TenantImplantacaoStatus, string> = {
  NAO_INICIADO: 'Não iniciado',
  EM_IMPLANTACAO: 'Em implantação',
  AGUARDANDO_CLIENTE: 'Aguardando cliente',
  BLOQUEADO: 'Bloqueado',
  HOMOLOGACAO: 'Homologação',
  CONCLUIDO: 'Concluído',
}

const faseLabelMap: Record<TenantImplantacaoFase, string> = {
  CADASTRO_BASE: 'Cadastro base',
  FILIAIS: 'Filiais',
  CREDENCIAIS_PROGEM: 'Credenciais Progem',
  NALAPIDE: 'NaLápide',
  WEBHOOKS: 'Webhooks',
  VERCEL_ENV: 'Vercel / ENV',
  ARQUIVOS_S3: 'Arquivos S3',
  PUBLICACAO_FINAL: 'Publicação final',
}

const prioridadeLabelMap: Record<TenantImplantacaoPrioridade, string> = {
  P0: 'P0 · Crítica',
  P1: 'P1 · Alta',
  P2: 'P2 · Média',
  P3: 'P3 · Baixa',
}

export function getStatusLabel(value?: TenantImplantacaoStatus | null) {
  return value ? statusLabelMap[value] : '—'
}

export function getFaseLabel(value?: TenantImplantacaoFase | null) {
  return value ? faseLabelMap[value] : '—'
}

export function getPrioridadeLabel(value?: TenantImplantacaoPrioridade | null) {
  return value ? prioridadeLabelMap[value] : '—'
}

export function normalizeSearch(v: unknown) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function normalizeDomain(raw: string) {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return ''
  let d = s.replace(/^https?:\/\//, '')
  while (d.endsWith('/')) d = d.slice(0, -1)
  return d.trim()
}

export function toHttpUrl(domain: string) {
  const d = normalizeDomain(domain)
  return d ? `https://${d}` : ''
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export function extractApiMessage(e: unknown, fallback: string) {
  const err = e as {
    response?: { data?: { message?: string }; status?: number }
    data?: { message?: string }
    message?: string
    status?: number
  }

  const apiMsg = err?.response?.data?.message ?? err?.data?.message ?? err?.message
  if (apiMsg && String(apiMsg).trim()) return String(apiMsg)

  const status = err?.response?.status ?? err?.status
  if (status === 400) return 'Dados inválidos. Revise os campos e tente novamente.'
  if (status === 401) return 'Não autenticado. Faça login novamente.'
  if (status === 403) return 'Sem permissão para esta ação.'
  if (status === 404) return 'Tenant não encontrado.'

  return fallback
}
