export type TokenRefreshListener = (accessToken: string, refreshToken: string) => void
export type SessionInvalidListener = (reason?: string) => void

let onTokensRefreshed: TokenRefreshListener | null = null
let onSessionInvalid: SessionInvalidListener | null = null

export function registerSessionBridge(
  onTokens: TokenRefreshListener,
  onInvalid: SessionInvalidListener
) {
  onTokensRefreshed = onTokens
  onSessionInvalid = onInvalid
}

export function notifyTokensRefreshed(accessToken: string, refreshToken: string) {
  onTokensRefreshed?.(accessToken, refreshToken)
}

export function notifySessionInvalid(reason?: string) {
  onSessionInvalid?.(reason)
}
