import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  hasSession,
  isAccessValid,
  needsAccessRefresh,
  refreshSessionTokens,
  shouldAttemptAuthRefresh,
} from './session'
import type { StoredSession } from '../lib/sessionStorage'

function makeJwt(expSec: number) {
  const header = btoa(JSON.stringify({ alg: 'HS256' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  const payload = btoa(JSON.stringify({ exp: expSec, roles: ['AWIS'] }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${header}.${payload}.sig`
}

const baseSession: StoredSession = {
  baseUrl: 'http://localhost:8082',
  empresaId: 128,
  deviceId: 'device-1',
  accessToken: '',
  refreshToken: 'refresh-abc',
}

describe('session helpers', () => {
  it('hasSession is true when refresh token exists', () => {
    expect(hasSession({ ...baseSession, refreshToken: 'r1' })).toBe(true)
    expect(hasSession({ ...baseSession, refreshToken: '' })).toBe(false)
  })

  it('isAccessValid respects expiry', () => {
    const future = Math.floor(Date.now() / 1000) + 3600
    const past = Math.floor(Date.now() / 1000) - 10
    expect(isAccessValid(makeJwt(future))).toBe(true)
    expect(isAccessValid(makeJwt(past))).toBe(false)
  })

  it('needsAccessRefresh when refresh exists and access expired', () => {
    const past = Math.floor(Date.now() / 1000) - 10
    expect(
      needsAccessRefresh({
        ...baseSession,
        accessToken: makeJwt(past),
        refreshToken: 'r1',
      })
    ).toBe(true)
  })

  it('shouldAttemptAuthRefresh on 401 and 403', () => {
    expect(shouldAttemptAuthRefresh(401, true, true)).toBe(true)
    expect(shouldAttemptAuthRefresh(403, true, true)).toBe(true)
    expect(shouldAttemptAuthRefresh(403, false, true)).toBe(false)
  })
})

describe('refreshSessionTokens dedup', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('coalesces concurrent refresh into one fetch', async () => {
    const session = {
      ...baseSession,
      accessToken: makeJwt(Math.floor(Date.now() / 1000) - 10),
    }
    const [a, b] = await Promise.all([
      refreshSessionTokens(session),
      refreshSessionTokens(session),
    ])
    expect(a.accessToken).toBe('new-access')
    expect(b.accessToken).toBe('new-access')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
