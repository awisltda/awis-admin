export type ToastState = { kind: 'success' | 'error'; message: string } | null

export type ApiClientDetail = {
  id: number
  nome: string
  clientId: string
  ativo: boolean
  empresaId: number // matriz (X-Progem-ID)
  dominio?: string | null
  escopos?: string

  // NaLápide API
  nalapideEnabled?: boolean | null
  nalapideId?: string | null
  nalapideBaseUrl?: string | null
  nalapideHasSecret?: boolean | null
}

export type ApiClientUnidade = {
  id: number
  apiClientId: number
  unidadeId: number
}

export type ApiClientRotateSecretResponse = {
  clientId: string
  clientSecret: string
}

export type WebhookEndpointDTO = {
  id: number
  url: string
  eventos: string[] | Set<string>
  descricao?: string | null
  ativo?: boolean | null
}

export type WebhookCreatePayload = {
  empresaId: number
  url: string
  eventos: string[]
  descricao?: string
  secret?: string
}

export type WebhookUpdatePayload = {
  empresaId: number
  url: string
  eventos: string[]
  descricao?: string
  ativo?: boolean
}

export type ApiClientNalapideUpdateRequest = {
  enabled: boolean
  nalapideId?: string | null
  baseUrl?: string | null
  clientSecret?: string | null
}

export type TabKey = 'UNIDADES' | 'CREDENCIAIS' | 'NALAPIDE' | 'WEBHOOKS' | 'ENV' | 'IDENTIDADE'
