import { useEffect, useState } from 'react'
import { Button } from '../../../ui/Button'
import { Card } from '../../../ui/Card'
import { Select } from '../../../ui/Select'
import {
  FASE_OPTIONS,
  PRIORIDADE_OPTIONS,
  STATUS_OPTIONS,
  getFaseLabel,
  getPrioridadeLabel,
  getStatusLabel,
} from '../helpers'
import type {
  TenantImplantacaoFase,
  TenantImplantacaoListItem,
  TenantImplantacaoPrioridade,
  TenantImplantacaoResponse,
  TenantImplantacaoStatus,
} from '../types'

type Props = {
  selectedItem: TenantImplantacaoListItem | null
  data: TenantImplantacaoResponse | null
  loading: boolean
  saving: boolean
  error: string | null
  onReload: () => void
  onSave: (payload: {
    status: TenantImplantacaoStatus
    faseAtual: TenantImplantacaoFase
    prioridade: TenantImplantacaoPrioridade
  }) => Promise<void>
}

export function TenantImplantacaoEditorCard({
  selectedItem,
  data,
  loading,
  saving,
  error,
  onReload,
  onSave,
}: Props) {
  const [status, setStatus] = useState<TenantImplantacaoStatus>('NAO_INICIADO')
  const [faseAtual, setFaseAtual] = useState<TenantImplantacaoFase>('CADASTRO_BASE')
  const [prioridade, setPrioridade] = useState<TenantImplantacaoPrioridade>('P3')

  useEffect(() => {
    setStatus(data?.status ?? 'NAO_INICIADO')
    setFaseAtual(data?.faseAtual ?? 'CADASTRO_BASE')
    setPrioridade(data?.prioridade ?? 'P3')
  }, [data])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSave({ status, faseAtual, prioridade })
  }

  if (!selectedItem) {
    return (
      <Card
        title="Editar implantação"
        subtitle="Selecione um tenant na listagem para visualizar e editar o andamento da implantação."
      >
        <div className="awis-state">
          <div className="awis-state-title">Nenhum tenant selecionado</div>
          <div className="awis-state-sub">Escolha um registro na tabela para começar.</div>
        </div>
      </Card>
    )
  }

  return (
    <Card
      title="Editar implantação"
      subtitle={`Tenant: ${selectedItem.nome || '—'} · clientId: ${selectedItem.clientId || '—'}`}
      right={
        <Button variant="ghost" onClick={onReload} disabled={loading || saving}>
          {loading ? 'Carregando...' : 'Recarregar'}
        </Button>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div
          style={{
            display: 'grid',
            gap: 10,
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          }}
        >
          <div>
            <div className="awis-label">Nome</div>
            <div className="awis-muted">{selectedItem.nome || '—'}</div>
          </div>
          <div>
            <div className="awis-label">clientId</div>
            <div className="awis-mono">{selectedItem.clientId || '—'}</div>
          </div>
          <div>
            <div className="awis-label">X-Progem-ID</div>
            <div className="awis-mono">{selectedItem.empresaId ?? '—'}</div>
          </div>
          <div>
            <div className="awis-label">Domínio</div>
            <div className="awis-mono">{selectedItem.dominio || '—'}</div>
          </div>
        </div>

        {loading ? (
          <div className="awis-state">
            <div className="awis-state-title">Carregando implantação…</div>
            <div className="awis-state-sub">Aguarde um instante.</div>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="awis-state">
            <div className="awis-state-title">Falha ao carregar</div>
            <div className="awis-state-sub">{error}</div>
          </div>
        ) : null}

        {!loading && data ? (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <div
              style={{
                display: 'grid',
                gap: 12,
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              }}
            >
              <Select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TenantImplantacaoStatus)}
                disabled={saving}
              >
                {STATUS_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {getStatusLabel(item)}
                  </option>
                ))}
              </Select>

              <Select
                label="Fase atual"
                value={faseAtual}
                onChange={(e) => setFaseAtual(e.target.value as TenantImplantacaoFase)}
                disabled={saving}
              >
                {FASE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {getFaseLabel(item)}
                  </option>
                ))}
              </Select>

              <Select
                label="Prioridade"
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as TenantImplantacaoPrioridade)}
                disabled={saving}
              >
                {PRIORIDADE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {getPrioridadeLabel(item)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="awis-row awis-row--wrap" style={{ gap: 10, alignItems: 'center' }}>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar implantação'}
              </Button>
              <div className="awis-muted" style={{ fontSize: 12 }}>
                As alterações são persistidas imediatamente no backend do tenant selecionado.
              </div>
            </div>
          </form>
        ) : null}
      </div>
    </Card>
  )
}
