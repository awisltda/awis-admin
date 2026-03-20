import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchTenantImplantacao,
  fetchTenantImplantacaoList,
  updateTenantImplantacao,
} from './api'
import { extractApiMessage, normalizeSearch } from './helpers'
import type {
  TenantImplantacaoListItem,
  TenantImplantacaoResponse,
  TenantImplantacaoUpsertRequest,
} from './types'

export function useTenantImplantacaoList() {
  const [items, setItems] = useState<TenantImplantacaoListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTenantImplantacaoList()
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(extractApiMessage(e, 'Falha ao carregar implantação dos tenants.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    items,
    loading,
    error,
    reload,
    setItems,
  }
}

export function useTenantImplantacaoFilter(items: TenantImplantacaoListItem[], query: string) {
  return useMemo(() => {
    const term = normalizeSearch(query)
    if (!term) return items

    return items.filter((item) => {
      const nome = normalizeSearch(item.nome)
      const clientId = normalizeSearch(item.clientId)
      const empresaId = normalizeSearch(item.empresaId)
      const dominio = normalizeSearch(item.dominio)
      const dominioVercel = normalizeSearch(item.dominioVercel)

      return (
        nome.includes(term) ||
        clientId.includes(term) ||
        empresaId.includes(term) ||
        dominio.includes(term) ||
        dominioVercel.includes(term)
      )
    })
  }, [items, query])
}

export function useTenantImplantacaoEditor(selectedId: number | null) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TenantImplantacaoResponse | null>(null)

  const reload = useCallback(async () => {
    if (!selectedId) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetchTenantImplantacao(selectedId)
      setData(response)
    } catch (e) {
      setError(extractApiMessage(e, 'Falha ao carregar implantação do tenant.'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    void reload()
  }, [reload])

  const save = useCallback(
    async (payload: TenantImplantacaoUpsertRequest) => {
      if (!selectedId) {
        throw new Error('Tenant não selecionado.')
      }

      setSaving(true)
      setError(null)
      try {
        const response = await updateTenantImplantacao(selectedId, payload)
        setData(response)
        return response
      } catch (e) {
        const message = extractApiMessage(e, 'Falha ao salvar implantação do tenant.')
        setError(message)
        throw new Error(message)
      } finally {
        setSaving(false)
      }
    },
    [selectedId]
  )

  return {
    data,
    loading,
    saving,
    error,
    reload,
    save,
  }
}
