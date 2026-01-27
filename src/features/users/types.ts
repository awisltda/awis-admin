export type UsuarioAppRoleName = 'AWIS' | 'ADM' | 'PARCEIRO' | 'ASSOCIADO'

export type UsuarioStatus = 'ATIVO' | 'INATIVO' | 'PENDENTE' | string

export type AdminUserListItem = {
  id: number
  empresaId: number
  nome: string
  email: string
  cpf?: string | null
  celular?: string | null
  status?: UsuarioStatus | null
  ultimoLoginEm?: string | null
  criadoEm?: string | null
  roles?: UsuarioAppRoleName[] | null
}

// Resposta Spring Page<> (formato mais comum)
export type PageResponse<T> = {
  content: T[]
  totalElements?: number
  totalPages?: number
  number?: number
  size?: number
  first?: boolean
  last?: boolean
}

export type RolesResponse = {
  userId: number
  roles: UsuarioAppRoleName[]
}
