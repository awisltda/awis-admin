import { endpoints } from '../../api/endpoints'
import { http } from '../../api/http'
import type {
  TenantImplantacaoListItem,
  TenantImplantacaoResponse,
  TenantImplantacaoUpsertRequest,
} from './types'

export async function fetchTenantImplantacaoList() {
  return http.get<TenantImplantacaoListItem[]>(endpoints.apiClientsImplantacaoList())
}

export async function fetchTenantImplantacao(apiClientId: number) {
  return http.get<TenantImplantacaoResponse>(endpoints.apiClientImplantacao(apiClientId))
}

export async function updateTenantImplantacao(
  apiClientId: number,
  payload: TenantImplantacaoUpsertRequest
) {
  return http.put<TenantImplantacaoResponse>(endpoints.apiClientImplantacao(apiClientId), payload)
}
