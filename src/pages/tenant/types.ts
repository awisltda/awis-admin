// src/pages/tenant/types.ts
export type ToastState = { kind: 'success' | 'error'; message: string } | null

export type ApiClientDetail = {
  id: number
  nome: string
  clientId: string
  ativo: boolean
  empresaId: number // matriz (X-Progem-ID)
  dominio?: string | null
  escopos?: string
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

export type TabKey = 'UNIDADES' | 'CREDENCIAIS' | 'WEBHOOKS' | 'ENV' | 'IDENTIDADE'