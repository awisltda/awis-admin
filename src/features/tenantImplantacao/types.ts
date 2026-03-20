export type TenantImplantacaoStatus =
  | 'NAO_INICIADO'
  | 'EM_IMPLANTACAO'
  | 'AGUARDANDO_CLIENTE'
  | 'BLOQUEADO'
  | 'HOMOLOGACAO'
  | 'CONCLUIDO'

export type TenantImplantacaoFase =
  | 'CADASTRO_BASE'
  | 'FILIAIS'
  | 'CREDENCIAIS_PROGEM'
  | 'NALAPIDE'
  | 'WEBHOOKS'
  | 'VERCEL_ENV'
  | 'ARQUIVOS_S3'
  | 'PUBLICACAO_FINAL'

export type TenantImplantacaoPrioridade = 'P0' | 'P1' | 'P2' | 'P3'

export type TenantImplantacaoListItem = {
  id: number
  nome?: string | null
  clientId?: string | null
  ativo?: boolean | null
  empresaId?: number | null
  dominio?: string | null
  dominioVercel?: string | null
  implantacaoStatus: TenantImplantacaoStatus
  implantacaoFaseAtual: TenantImplantacaoFase
  implantacaoPrioridade: TenantImplantacaoPrioridade
  implantacaoAtualizadoEm?: string | null
}

export type TenantImplantacaoResponse = {
  id?: number | null
  apiClientId: number
  status: TenantImplantacaoStatus
  faseAtual: TenantImplantacaoFase
  prioridade: TenantImplantacaoPrioridade
  criadoEm?: string | null
  atualizadoEm?: string | null
}

export type TenantImplantacaoUpsertRequest = {
  status: TenantImplantacaoStatus
  faseAtual: TenantImplantacaoFase
  prioridade: TenantImplantacaoPrioridade
}
