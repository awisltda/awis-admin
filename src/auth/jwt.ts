export type JwtPayload = {
  sub?: string
  roles?: string[] // ex.: ["AWIS","ADM"]
  exp?: number
}

function b64urlToJson(b64url: string) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
  const json = atob(b64 + pad)
  return JSON.parse(json)
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    return b64urlToJson(parts[1]) as JwtPayload
  } catch {
    return null
  }
}

export function isExpired(payload: JwtPayload | null): boolean {
  if (!payload?.exp) return false
  const now = Math.floor(Date.now() / 1000)
  return payload.exp <= now
}
