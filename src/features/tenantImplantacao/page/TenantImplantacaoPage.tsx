import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../../ui/Button'
import { Card } from '../../../ui/Card'
import { Input } from '../../../ui/Input'
import { Toast } from '../../../ui/Toast'
import { PrioridadeBadge } from '../components/PrioridadeBadge'
import { StatusBadge } from '../components/StatusBadge'
import { TenantImplantacaoEditorCard } from '../components/TenantImplantacaoEditorCard'
import {
  extractApiMessage,
  formatDateTime,
  getFaseLabel,
  normalizeDomain,
  toHttpUrl,
} from '../helpers'
import {
  useTenantImplantacaoEditor,
  useTenantImplantacaoFilter,
  useTenantImplantacaoList,
} from '../hooks'
import type { TenantImplantacaoListItem } from '../types'

type ToastState = { kind: 'success' | 'error'; message: string } | null

type SortField = 'updatedAt' | 'prioridade' | 'fase' | 'status'
type SortDirection = 'asc' | 'desc'
type StatusFilter = 'TODOS' | 'NAO_INICIADO' | 'EM_IMPLANTACAO' | 'AGUARDANDO_CLIENTE' | 'BLOQUEADO' | 'HOMOLOGACAO' | 'CONCLUIDO'
type PrioridadeFilter = 'TODAS' | 'P0' | 'P1' | 'P2' | 'P3'

const PRIORIDADE_ORDER: Record<string, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
}

const FASE_ORDER: Record<string, number> = {
  CADASTRO_BASE: 0,
  FILIAIS: 1,
  CREDENCIAIS_PROGEM: 2,
  NALAPIDE: 3,
  WEBHOOKS: 4,
  VERCEL_ENV: 5,
  ARQUIVOS_S3: 6,
  PUBLICACAO_FINAL: 7,
}

const STATUS_ORDER: Record<string, number> = {
  BLOQUEADO: 0,
  AGUARDANDO_CLIENTE: 1,
  NAO_INICIADO: 2,
  EM_IMPLANTACAO: 3,
  HOMOLOGACAO: 4,
  CONCLUIDO: 5,
}

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'TODOS', label: 'Todos os status' },
  { value: 'NAO_INICIADO', label: 'Não iniciado' },
  { value: 'EM_IMPLANTACAO', label: 'Em implantação' },
  { value: 'AGUARDANDO_CLIENTE', label: 'Aguardando cliente' },
  { value: 'BLOQUEADO', label: 'Bloqueado' },
  { value: 'HOMOLOGACAO', label: 'Homologação' },
  { value: 'CONCLUIDO', label: 'Concluído' },
]

const PRIORIDADE_OPTIONS: Array<{ value: PrioridadeFilter; label: string }> = [
  { value: 'TODAS', label: 'Todas as prioridades' },
  { value: 'P0', label: 'P0' },
  { value: 'P1', label: 'P1' },
  { value: 'P2', label: 'P2' },
  { value: 'P3', label: 'P3' },
]

function useMediaQuery(query: string) {
  const getMatches = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(query).matches
  }

  const [matches, setMatches] = useState(getMatches)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)

    onChange()

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    }

    media.addListener(onChange)
    return () => media.removeListener(onChange)
  }, [query])

  return matches
}

function compareItems(a: TenantImplantacaoListItem, b: TenantImplantacaoListItem, field: SortField) {
  if (field === 'prioridade') {
    return (PRIORIDADE_ORDER[a.implantacaoPrioridade] ?? 999) - (PRIORIDADE_ORDER[b.implantacaoPrioridade] ?? 999)
  }

  if (field === 'fase') {
    return (FASE_ORDER[a.implantacaoFaseAtual] ?? 999) - (FASE_ORDER[b.implantacaoFaseAtual] ?? 999)
  }

  if (field === 'status') {
    return (STATUS_ORDER[a.implantacaoStatus] ?? 999) - (STATUS_ORDER[b.implantacaoStatus] ?? 999)
  }

  const timeA = a.implantacaoAtualizadoEm ? new Date(a.implantacaoAtualizadoEm).getTime() : 0
  const timeB = b.implantacaoAtualizadoEm ? new Date(b.implantacaoAtualizadoEm).getTime() : 0
  return timeA - timeB
}

function getSortLabel(field: SortField) {
  if (field === 'prioridade') return 'Prioridade'
  if (field === 'fase') return 'Fase'
  if (field === 'status') return 'Status'
  return 'Atualização'
}

function getStatusFilterLabel(value: StatusFilter) {
  return STATUS_OPTIONS.find((option) => option.value === value)?.label ?? 'Todos os status'
}

function getPrioridadeFilterLabel(value: PrioridadeFilter) {
  return PRIORIDADE_OPTIONS.find((option) => option.value === value)?.label ?? 'Todas as prioridades'
}

function getRowTone(item: TenantImplantacaoListItem, selectedId: number | null) {
  if (item.id === selectedId) return 'rgba(56, 189, 248, 0.08)'
  if (item.implantacaoPrioridade === 'P0') return 'rgba(239, 68, 68, 0.06)'
  if (item.implantacaoStatus === 'BLOQUEADO') return 'rgba(245, 158, 11, 0.06)'
  return 'transparent'
}

function getSortIndicator(active: boolean, direction: SortDirection) {
  if (!active) return '↕'
  return direction === 'asc' ? '↑' : '↓'
}

function HeaderSortButton({
  label,
  field,
  activeField,
  direction,
  onSort,
}: {
  label: string
  field: SortField
  activeField: SortField
  direction: SortDirection
  onSort: (field: SortField) => void
}) {
  const active = activeField === field

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      title={`Ordenar por ${label.toLowerCase()}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        border: 0,
        padding: 0,
        margin: 0,
        background: 'transparent',
        color: active ? 'inherit' : 'rgba(226, 232, 240, 0.82)',
        font: 'inherit',
        fontWeight: active ? 700 : 600,
        cursor: 'pointer',
      }}
    >
      <span>{label}</span>
      <span aria-hidden="true" style={{ fontSize: 11, opacity: active ? 1 : 0.7 }}>
        {getSortIndicator(active, direction)}
      </span>
    </button>
  )
}

function QuickFilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 26,
        minHeight: 26,
        borderRadius: 999,
        border: active ? '1px solid rgba(var(--accent-rgb), 0.30)' : '1px solid var(--border)',
        background: active ? 'rgba(var(--accent-rgb), 0.10)' : 'transparent',
        color: 'var(--text)',
        padding: '0 9px',
        fontSize: 11.5,
        lineHeight: 1,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        boxShadow: 'none',
        whiteSpace: 'nowrap',
        flex: '0 0 auto',
      }}
    >
      {label}
    </button>
  )
}

function KpiMini({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div
      style={{
        minWidth: 0,
        display: 'grid',
        gap: 2,
        padding: '8px 10px',
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--surface-2)',
      }}
    >
      <div
        className="awis-muted"
        style={{
          fontSize: 11,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          lineHeight: 1.1,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function InlineFilterGroup({
  label,
  children,
  compact,
}: {
  label: string
  children: React.ReactNode
  compact: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 4 : 6,
        flexWrap: compact ? 'wrap' : 'nowrap',
        minWidth: 0,
        overflowX: compact ? 'visible' : 'auto',
        paddingBottom: compact ? 0 : 2,
      }}
    >
      <span
        className="awis-muted"
        style={{
          flex: '0 0 auto',
          fontSize: 10.5,
          lineHeight: 1,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
          minWidth: compact ? 0 : 64,
        }}
      >
        {label}
      </span>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? 4 : 6,
          flexWrap: compact ? 'wrap' : 'nowrap',
          minWidth: 0,
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function TenantImplantacaoPage() {
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [sortField, setSortField] = useState<SortField>('updatedAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('TODOS')
  const [prioridadeFilter, setPrioridadeFilter] = useState<PrioridadeFilter>('TODAS')

  const isWideLayout = useMediaQuery('(min-width: 1680px)')
  const isDesktopTable = useMediaQuery('(min-width: 1100px)')
  const isCompactTop = useMediaQuery('(max-width: 820px)')
  const isDesktopFilterInline = useMediaQuery('(min-width: 1180px)')

  const list = useTenantImplantacaoList()
  const filteredBySearch = useTenantImplantacaoFilter(list.items, q)

  const filtered = useMemo(() => {
    return filteredBySearch.filter((item) => {
      if (statusFilter !== 'TODOS' && item.implantacaoStatus !== statusFilter) return false
      if (prioridadeFilter !== 'TODAS' && item.implantacaoPrioridade !== prioridadeFilter) return false
      return true
    })
  }, [filteredBySearch, prioridadeFilter, statusFilter])

  const sorted = useMemo(() => {
    const next = [...filtered]

    next.sort((a, b) => {
      const base = compareItems(a, b, sortField)
      if (base !== 0) return sortDirection === 'asc' ? base : -base

      return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' })
    })

    return next
  }, [filtered, sortDirection, sortField])

  const selectedItem = useMemo<TenantImplantacaoListItem | null>(() => {
    if (!selectedId) return null
    return list.items.find((item) => item.id === selectedId) ?? null
  }, [list.items, selectedId])

  const editor = useTenantImplantacaoEditor(selectedId)

  const stats = useMemo(() => {
    const total = list.items.length
    const concluidos = list.items.filter((item) => item.implantacaoStatus === 'CONCLUIDO').length
    const emAndamento = list.items.filter((item) => item.implantacaoStatus === 'EM_IMPLANTACAO').length
    const criticos = list.items.filter((item) => item.implantacaoPrioridade === 'P0').length
    return { total, concluidos, emAndamento, criticos }
  }, [list.items])

  function handleSortChange(field: SortField) {
    if (field === sortField) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortField(field)
    setSortDirection(field === 'updatedAt' ? 'desc' : 'asc')
  }

  async function handleReloadList() {
    await list.reload()
  }

  async function handleSave(payload: {
    status: 'NAO_INICIADO' | 'EM_IMPLANTACAO' | 'AGUARDANDO_CLIENTE' | 'BLOQUEADO' | 'HOMOLOGACAO' | 'CONCLUIDO'
    faseAtual:
      | 'CADASTRO_BASE'
      | 'FILIAIS'
      | 'CREDENCIAIS_PROGEM'
      | 'NALAPIDE'
      | 'WEBHOOKS'
      | 'VERCEL_ENV'
      | 'ARQUIVOS_S3'
      | 'PUBLICACAO_FINAL'
    prioridade: 'P0' | 'P1' | 'P2' | 'P3'
  }) {
    try {
      const response = await editor.save(payload)
      await list.reload()
      setToast({ kind: 'success', message: 'Implantação atualizada com sucesso.' })
      if (response?.apiClientId) setSelectedId(response.apiClientId)
    } catch (e) {
      setToast({
        kind: 'error',
        message: extractApiMessage(e, 'Falha ao salvar implantação do tenant.'),
      })
    }
  }

  return (
    <div className="awis-stack">
      {toast ? <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} /> : null}
      {list.error ? <Toast kind="error" message={list.error} onClose={() => void 0} /> : null}

      <Card
        title="Implantação de Tenants"
        subtitle="Acompanhamento operacional da implantação dos tenants do ecossistema Progem."
        right={
          <div className="awis-row" style={{ gap: 10 }}>
            <Button variant="ghost" onClick={handleReloadList} disabled={list.loading}>
              {list.loading ? 'Atualizando...' : 'Recarregar'}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gap: 10 }}>
          <div
            style={{
              display: 'grid',
              gap: 8,
              gridTemplateColumns: isCompactTop ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
            }}
          >
            <KpiMini label="Total" value={stats.total} />
            <KpiMini label="Concluídos" value={stats.concluidos} />
            <KpiMini label="Em implantação" value={stats.emAndamento} />
            <KpiMini label="P0" value={stats.criticos} />
          </div>

          <div
            style={{
              display: 'grid',
              gap: 7,
              padding: 10,
              borderRadius: 14,
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gap: 8,
                alignItems: 'end',
                gridTemplateColumns: isCompactTop ? 'minmax(0, 1fr)' : 'minmax(0, 1.5fr) minmax(180px, 220px) auto',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <Input
                  label="Buscar tenant"
                  placeholder="Buscar por nome, clientId, domínio ou X-Progem-ID…"
                  name="implantacao-search"
                  autoComplete="off"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <label style={{ display: 'grid', gap: 6, minWidth: 0 }}>
                <span className="awis-muted" style={{ fontSize: 12 }}>
                  Ordenar por
                </span>
                <select
                  value={sortField}
                  onChange={(e) => handleSortChange(e.target.value as SortField)}
                  style={{
                    minHeight: 38,
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    padding: '0 12px',
                    outline: 'none',
                  }}
                >
                  <option value="updatedAt">Atualização</option>
                  <option value="prioridade">Prioridade</option>
                  <option value="fase">Fase</option>
                  <option value="status">Status</option>
                </select>
              </label>

              <div style={{ display: 'grid', gap: 6, minWidth: isCompactTop ? '100%' : 0 }}>
                <span className="awis-muted" style={{ fontSize: 12 }}>
                  Direção
                </span>
                <Button
                  variant="ghost"
                  onClick={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
                  title={`Alterar ordem de ${sortDirection === 'asc' ? 'crescente para decrescente' : 'decrescente para crescente'}`}
                >
                  {sortDirection === 'asc' ? 'Crescente' : 'Decrescente'}
                </Button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 5 }}>
              <InlineFilterGroup label="Status" compact={!isDesktopFilterInline}>
                <QuickFilterButton active={statusFilter === 'TODOS'} label="Todos" onClick={() => setStatusFilter('TODOS')} />
                <QuickFilterButton active={statusFilter === 'EM_IMPLANTACAO'} label="Em implantação" onClick={() => setStatusFilter('EM_IMPLANTACAO')} />
                <QuickFilterButton active={statusFilter === 'BLOQUEADO'} label="Bloqueado" onClick={() => setStatusFilter('BLOQUEADO')} />
                <QuickFilterButton active={statusFilter === 'HOMOLOGACAO'} label="Homologação" onClick={() => setStatusFilter('HOMOLOGACAO')} />
                <QuickFilterButton active={statusFilter === 'CONCLUIDO'} label="Concluído" onClick={() => setStatusFilter('CONCLUIDO')} />
              </InlineFilterGroup>

              <InlineFilterGroup label="Prioridade" compact={!isDesktopFilterInline}>
                <QuickFilterButton active={prioridadeFilter === 'TODAS'} label="Todas" onClick={() => setPrioridadeFilter('TODAS')} />
                <QuickFilterButton active={prioridadeFilter === 'P0'} label="P0" onClick={() => setPrioridadeFilter('P0')} />
                <QuickFilterButton active={prioridadeFilter === 'P1'} label="P1" onClick={() => setPrioridadeFilter('P1')} />
                <QuickFilterButton active={prioridadeFilter === 'P2'} label="P2" onClick={() => setPrioridadeFilter('P2')} />
                <QuickFilterButton active={prioridadeFilter === 'P3'} label="P3" onClick={() => setPrioridadeFilter('P3')} />
              </InlineFilterGroup>
            </div>
          </div>
        </div>
      </Card>

      <div
        style={{
          display: 'grid',
          gap: 14,
          alignItems: 'start',
          gridTemplateColumns: isDesktopTable
            ? isWideLayout
              ? 'minmax(0, 1.75fr) minmax(360px, 420px)'
              : 'minmax(0, 1fr)'
            : 'minmax(0, 1fr)',
        }}
      >
        <Card
          title="Tenants"
          subtitle={`Ordenação ativa por ${getSortLabel(sortField).toLowerCase()} (${sortDirection === 'asc' ? 'crescente' : 'decrescente'}). Filtro atual: ${getStatusFilterLabel(statusFilter).toLowerCase()} e ${getPrioridadeFilterLabel(prioridadeFilter).toLowerCase()}.`}
        >
          {list.loading ? (
            <div className="awis-state">
              <div className="awis-state-title">Carregando implantações…</div>
              <div className="awis-state-sub">Aguarde um instante.</div>
            </div>
          ) : null}

          {!list.loading && sorted.length === 0 ? (
            <div className="awis-state">
              <div className="awis-state-title">Nenhum resultado</div>
              <div className="awis-state-sub">
                {q.trim() || statusFilter !== 'TODOS' || prioridadeFilter !== 'TODAS'
                  ? 'Nenhum tenant corresponde ao conjunto atual de filtros.'
                  : 'Ainda não há tenants disponíveis para acompanhamento.'}
              </div>
            </div>
          ) : null}

          {!list.loading && sorted.length > 0 ? (
            <>
              <div className="awis-muted" style={{ marginBottom: 10, fontSize: 12, lineHeight: 1.45 }}>
                {sorted.length} tenant{sorted.length === 1 ? '' : 's'} encontrado
                {sorted.length === 1 ? '' : 's'}.
                {isDesktopTable
                  ? ' Clique em uma coluna para reordenar ou selecione uma linha para abrir o detalhe.'
                  : ' Toque em um card para abrir a edição logo abaixo.'}
              </div>

              {isDesktopTable ? (
                <div
                  className="awis-table"
                  role="table"
                  aria-label="Lista de implantação de tenants"
                  style={{
                    width: '100%',
                    ['--cols' as never]:
                      'minmax(280px, 1.6fr) minmax(220px, 1.2fr) minmax(150px, 0.82fr) minmax(170px, 0.92fr) minmax(130px, 0.72fr) minmax(160px, 0.86fr) 116px',
                  }}
                >
                  <div className="awis-tr awis-th" role="row">
                    <div role="columnheader">Tenant</div>
                    <div role="columnheader">Domínio</div>
                    <div role="columnheader">
                      <HeaderSortButton
                        label="Status"
                        field="status"
                        activeField={sortField}
                        direction={sortDirection}
                        onSort={handleSortChange}
                      />
                    </div>
                    <div role="columnheader">
                      <HeaderSortButton
                        label="Fase"
                        field="fase"
                        activeField={sortField}
                        direction={sortDirection}
                        onSort={handleSortChange}
                      />
                    </div>
                    <div role="columnheader">
                      <HeaderSortButton
                        label="Prioridade"
                        field="prioridade"
                        activeField={sortField}
                        direction={sortDirection}
                        onSort={handleSortChange}
                      />
                    </div>
                    <div role="columnheader">
                      <HeaderSortButton
                        label="Atualizado em"
                        field="updatedAt"
                        activeField={sortField}
                        direction={sortDirection}
                        onSort={handleSortChange}
                      />
                    </div>
                    <div role="columnheader" style={{ textAlign: 'right' }}>
                      Ação
                    </div>
                  </div>

                  {sorted.map((item) => {
                    const domain = normalizeDomain(item.dominio || '')
                    const url = toHttpUrl(domain)
                    const isSelected = item.id === selectedId

                    return (
                      <div
                        key={item.id}
                        className={`awis-tr${isSelected ? ' is-selected' : ''}`}
                        role="row"
                        style={{
                          cursor: 'pointer',
                          background: getRowTone(item, selectedId),
                          transition: 'background-color 160ms ease, box-shadow 160ms ease',
                        }}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <div data-label="Tenant" className="awis-cell-name" role="cell">
                          <div style={{ fontWeight: 600, whiteSpace: 'normal', lineHeight: 1.35 }}>{item.nome || '—'}</div>
                          <div className="awis-muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.45 }}>
                            clientId:{' '}
                            <span style={{ fontVariantNumeric: 'tabular-nums', wordBreak: 'break-word' }}>
                              {item.clientId || '—'}
                            </span>
                            <span className="awis-muted"> · </span>
                            X-Progem-ID:{' '}
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{item.empresaId ?? '—'}</span>
                          </div>
                        </div>

                        <div data-label="Domínio" role="cell" style={{ minWidth: 0 }}>
                          {domain ? (
                            <a
                              className="awis-link"
                              href={url}
                              target="_blank"
                              rel="noreferrer noopener"
                              title={`Abrir ${url}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ display: 'inline-flex', minWidth: 0, maxWidth: '100%' }}
                            >
                              <span
                                style={{
                                  fontSize: 12,
                                  fontVariantNumeric: 'tabular-nums',
                                  lineHeight: 1.45,
                                  whiteSpace: 'normal',
                                  wordBreak: 'break-word',
                                }}
                              >
                                {domain}
                              </span>
                            </a>
                          ) : (
                            <span className="awis-muted">—</span>
                          )}
                        </div>

                        <div data-label="Status" role="cell">
                          <StatusBadge status={item.implantacaoStatus} />
                        </div>

                        <div data-label="Fase" role="cell" style={{ lineHeight: 1.4 }}>
                          {getFaseLabel(item.implantacaoFaseAtual)}
                        </div>

                        <div data-label="Prioridade" role="cell">
                          <PrioridadeBadge prioridade={item.implantacaoPrioridade} />
                        </div>

                        <div
                          data-label="Atualizado em"
                          role="cell"
                          style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                        >
                          {formatDateTime(item.implantacaoAtualizadoEm)}
                        </div>

                        <div data-label="Ação" className="awis-cell-actions" role="cell">
                          <Button
                            variant={isSelected ? 'primary' : 'ghost'}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedId(item.id)
                            }}
                          >
                            {isSelected ? 'Selecionado' : 'Editar'}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {sorted.map((item) => {
                    const domain = normalizeDomain(item.dominio || '')
                    const url = toHttpUrl(domain)
                    const isSelected = item.id === selectedId

                    return (
                      <div key={item.id} style={{ display: 'grid', gap: 10 }}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedId(item.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelectedId(item.id)
                            }
                          }}
                          style={{
                            border: isSelected ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(148, 163, 184, 0.16)',
                            background: getRowTone(item, selectedId),
                            borderRadius: 16,
                            padding: 14,
                            display: 'grid',
                            gap: 10,
                            boxShadow: isSelected ? '0 0 0 1px rgba(56, 189, 248, 0.14) inset' : 'none',
                          }}
                        >
                          <div className="awis-row" style={{ justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, lineHeight: 1.35 }}>{item.nome || '—'}</div>
                              <div className="awis-muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.45 }}>
                                clientId: <span style={{ wordBreak: 'break-word' }}>{item.clientId || '—'}</span>
                              </div>
                              <div className="awis-muted" style={{ fontSize: 12, lineHeight: 1.45 }}>
                                X-Progem-ID: <span style={{ fontVariantNumeric: 'tabular-nums' }}>{item.empresaId ?? '—'}</span>
                              </div>
                            </div>
                            <PrioridadeBadge prioridade={item.implantacaoPrioridade} />
                          </div>

                          <div style={{ display: 'grid', gap: 8 }}>
                            <div className="awis-row awis-row--wrap" style={{ gap: 8 }}>
                              <StatusBadge status={item.implantacaoStatus} />
                              <div className="awis-badge awis-badge-muted">{getFaseLabel(item.implantacaoFaseAtual)}</div>
                            </div>

                            <div className="awis-muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
                              Atualizado em <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatDateTime(item.implantacaoAtualizadoEm)}</span>
                            </div>

                            <div style={{ minWidth: 0 }}>
                              {domain ? (
                                <a
                                  className="awis-link"
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ fontSize: 12, lineHeight: 1.45, wordBreak: 'break-word' }}
                                >
                                  {domain}
                                </a>
                              ) : (
                                <span className="awis-muted" style={{ fontSize: 12 }}>
                                  Sem domínio informado
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="awis-row" style={{ justifyContent: 'flex-end' }}>
                            <Button variant={isSelected ? 'primary' : 'ghost'} onClick={() => setSelectedId(item.id)}>
                              {isSelected ? 'Editando' : 'Editar'}
                            </Button>
                          </div>
                        </div>

                        {isSelected ? (
                          <TenantImplantacaoEditorCard
                            selectedItem={selectedItem}
                            data={editor.data}
                            loading={editor.loading}
                            saving={editor.saving}
                            error={editor.error}
                            onReload={() => void editor.reload()}
                            onSave={async (payload) => {
                              await handleSave(payload)
                            }}
                          />
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : null}
        </Card>

        {isDesktopTable && isWideLayout ? (
          <div style={{ position: 'sticky', top: 18 }}>
            <TenantImplantacaoEditorCard
              selectedItem={selectedItem}
              data={editor.data}
              loading={editor.loading}
              saving={editor.saving}
              error={editor.error}
              onReload={() => void editor.reload()}
              onSave={async (payload) => {
                await handleSave(payload)
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}