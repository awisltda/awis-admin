// src/api/endpoints.ts
export const endpoints = {
  authLogin: () => `/api/v1/app/auth/login`,
  authRefresh: () => `/api/v1/app/auth/refresh`,

  apiClients: () => `/api/v1/api-clients`,
  apiClientById: (id: number) => `/api/v1/api-clients/${id}`,
  apiClientCreate: () => `/api/v1/api-clients`,
  apiClientUpdate: (id: number) => `/api/v1/api-clients/${id}`,
  apiClientStatus: (id: number, ativo: boolean) => `/api/v1/api-clients/${id}/status?ativo=${ativo}`,

  apiClientUnidades: (apiClientId: number) => `/api/v1/api-clients/${apiClientId}/unidades`,
  apiClientVincularUnidade: (apiClientId: number, unidadeId: number) =>
    `/api/v1/api-clients/${apiClientId}/unidades/${unidadeId}`,
  apiClientDesvincularUnidade: (apiClientId: number, unidadeId: number) =>
    `/api/v1/api-clients/${apiClientId}/unidades/${unidadeId}`,

  empresaUnidades: () => `/api/v1/api-clients/empresa/unidades`,

  apiClientDetail: (id: number) => `/api/v1/api-clients/${id}/detail`,

  // ✅ NOVO: rotacionar clientSecret (exibição única)
  apiClientRotateSecret: (id: number) => `/api/v1/api-clients/${id}/secret:rotate`,

  // Webhooks
  webhooksEndpoints: (empresaId?: number) =>
    empresaId
      ? `/api/v1/webhooks/endpoints?empresaId=${encodeURIComponent(String(empresaId))}`
      : `/api/v1/webhooks/endpoints`,

  webhooksEndpointById: (id: number, empresaId?: number) =>
    empresaId
      ? `/api/v1/webhooks/endpoints/${id}?empresaId=${encodeURIComponent(String(empresaId))}`
      : `/api/v1/webhooks/endpoints/${id}`,

  // vincular matriz por empresaId (sem pesquisa)
  apiClientVincularMatriz: (apiClientId: number, empresaId: number) =>
    `/api/v1/api-clients/${apiClientId}/unidades/matriz/${empresaId}`,

  // Admin (App) — Users & Roles
  adminUsers: (params?: {
    q?: string
    status?: string
    role?: string
    empresaId?: number | string
    page?: number
    size?: number
    sort?: string
  }) => {
    const qp: string[] = []

    const q = params?.q?.trim?.() ?? ''
    const status = params?.status?.trim?.() ?? ''
    const role = params?.role?.trim?.() ?? ''
    const empresaId = params?.empresaId

    if (q) qp.push(`q=${encodeURIComponent(q)}`)
    if (status) qp.push(`status=${encodeURIComponent(status)}`)
    if (role) qp.push(`role=${encodeURIComponent(role)}`)
    if (empresaId !== undefined && empresaId !== null && String(empresaId).trim() !== '') {
      qp.push(`empresaId=${encodeURIComponent(String(empresaId).trim())}`)
    }

    if (params?.page !== undefined) qp.push(`page=${encodeURIComponent(String(params.page))}`)
    if (params?.size !== undefined) qp.push(`size=${encodeURIComponent(String(params.size))}`)
    if (params?.sort) qp.push(`sort=${encodeURIComponent(params.sort)}`)

    const qs = qp.length ? `?${qp.join('&')}` : ''
    return `/api/v1/app/admin/users${qs}`
  },

  adminUserRoles: (userId: number | string) => `/api/v1/app/admin/users/${userId}/roles`,
  adminUserAddRole: (userId: number | string, role: string) => `/api/v1/app/admin/users/${userId}/roles/${role}`,
  adminUserRemoveRole: (userId: number | string, role: string) =>
    `/api/v1/app/admin/users/${userId}/roles/${role}`,
}
