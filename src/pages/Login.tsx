import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { endpoints } from '../api/endpoints'
import { loadSession, saveSession } from '../lib/sessionStorage'

function uuid() {
  try {
    return crypto.randomUUID()
  } catch {
    // fallback simples
    return `dev-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`
  }
}

export function Login() {
  const nav = useNavigate()
  const { login } = useAuth()

  const existing = loadSession()
  const [baseUrl, setBaseUrl] = useState(existing.baseUrl || String(import.meta.env.VITE_API_BASE_URL ?? ''))
  const [empresaId, setEmpresaId] = useState(String(existing.empresaId || 128))
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [err, setErr] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const can = useMemo(() => {
    return (
      baseUrl.trim().length > 8 &&
      String(empresaId).trim().length > 0 &&
      email.trim().includes('@') &&
      senha.trim().length >= 6 &&
      !loading
    )
  }, [baseUrl, empresaId, email, senha, loading])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setLoading(true)

    const apiBase = String(baseUrl ?? '').trim().replace(/\/+$/, '')
    const emp = Number(empresaId)
    const deviceId = existing.deviceId || uuid()

    try {
      const res = await fetch(`${apiBase}${endpoints.authLogin()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Progem-ID': String(emp),
          'X-Device-ID': deviceId,
        },
        body: JSON.stringify({ identificador: email.trim(), senha: senha }),
      })

      const text = await res.text()
      let body: any = null
      try {
        body = text ? JSON.parse(text) : null
      } catch {
        body = text ? { raw: text } : null
      }

      if (!res.ok) {
        const msg = (body && (body.message || body.error || body.title)) || `Erro HTTP ${res.status}`
        throw new Error(String(msg))
      }

      const accessToken = String(body?.access_token ?? body?.accessToken ?? '').trim()
      const refreshToken = String(body?.refresh_token ?? body?.refreshToken ?? '').trim()
      if (!accessToken) throw new Error('Login não retornou access_token.')

      const session = {
        baseUrl: apiBase,
        empresaId: emp,
        deviceId,
        accessToken,
        refreshToken,
      }

      saveSession(session)
      login(session)
      nav('/')
    } catch (ex: any) {
      setErr(ex?.message ?? 'Falha ao entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="awis-center">
      <Card title="AWIS Console + Acesso" subtitle="Entre com seu e-mail e senha (perfil AWIS).">
        <form onSubmit={onSubmit} className="awis-form">
          <Input
            label="BaseUrl da API"
            placeholder="https://api.seudominio.com"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />

          <Input
            label="X-Progem-ID (empresa)"
            placeholder="128"
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
          />

          <Input
            label="E-mail"
            placeholder="seuemail@dominio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Input
            label="Senha"
            placeholder="Sua senha"
            value={senha}
            type="password"
            onChange={(e) => setSenha(e.target.value)}
          />

          {err ? <div className="awis-error">{err}</div> : null}

          <Button type="submit" disabled={!can}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
