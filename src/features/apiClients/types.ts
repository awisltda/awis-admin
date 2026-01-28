export type ApiClientResponse = {
  id: number
  nome?: string
  ativo: boolean
  empresaId?: number 
  // tolera campos adicionais vindos do backend sem quebrar
  [k: string]: any
}
