/**
 * 登录会话存储（M5 IAM 浏览器登录）：访问令牌/刷新令牌/过期时刻持久化到 localStorage，
 * 响应式单例供 axios 拦截器与布局直接读取（避免 store ↔ api 循环依赖）。
 * 未启用 IAM 时 session 恒为空——所有行为与历史一致。
 */
import { reactive } from 'vue'

import { buildRefreshTokenRequest, iamEnabled, oidcConfig, parseTokenResponse } from './oidc'

const AUTH_STORAGE_KEY = 'ontodata.auth'
export const PKCE_STORAGE_KEY = 'ontodata.pkce'
/** 登录前目标地址（登录成功后回跳）：存 sessionStorage 以跨越 IdP 往返。 */
export const LOGIN_REDIRECT_STORAGE_KEY = 'ontodata.auth.redirect'
/** 续期提前量：距过期不足 60 秒即视为"临期"，发请求前先续期（避免请求途中令牌过期）。 */
export const REFRESH_SKEW_MS = 60_000

export interface AuthSession {
  accessToken: string
  refreshToken?: string
  expiresAt: number
}

function loadSession(): AuthSession | null {
  if (!iamEnabled()) {
    return null
  }
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as AuthSession
    if (typeof parsed.accessToken !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export const authState = reactive({
  session: loadSession(),
})

/** 当前有效访问令牌：无会话或已过期返回 null。 */
export function accessToken(): string | null {
  const session = authState.session
  if (session && session.expiresAt > Date.now()) {
    return session.accessToken
  }
  return null
}

export function saveSession(session: AuthSession): void {
  authState.session = session
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  } catch {
    // 持久化失败不影响当前会话
  }
}

export function clearSession(): void {
  authState.session = null
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // 忽略
  }
}

/**
 * 确保拿到有效访问令牌（WP-07 令牌续期）：会话有效直接返回；临期（距过期不足
 * REFRESH_SKEW_MS）或已过期时用 refreshToken 调令牌端点换发新令牌并更新存储。
 * 无 refreshToken 无法续期返回 null（由路由守卫/拦截器按未登录处理）；
 * 续期失败清空会话并整页跳登录页（fail-closed，记录当前地址供登录后回跳）。
 * 并发调用共享同一进行中的 Promise，避免重复续期（refreshToken 旋转时并发会互踢）。
 */
export function ensureAccessToken(): Promise<string | null> {
  const session = authState.session
  if (!session) {
    return Promise.resolve(null)
  }
  if (session.expiresAt - REFRESH_SKEW_MS > Date.now()) {
    return Promise.resolve(session.accessToken)
  }
  if (!session.refreshToken) {
    return Promise.resolve(null)
  }
  if (!refreshPromise) {
    refreshPromise = refreshSession(session.refreshToken).finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

/** 进行中的续期 Promise（并发去重，见 ensureAccessToken）。 */
let refreshPromise: Promise<string | null> | null = null

async function refreshSession(refreshToken: string): Promise<string | null> {
  try {
    const request = buildRefreshTokenRequest(oidcConfig(), refreshToken)
    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
    })
    if (!response.ok) {
      throw new Error(`IdP 令牌端点返回错误（${response.status}）`)
    }
    const token = parseTokenResponse(await response.json())
    saveSession({
      accessToken: token.accessToken,
      // IdP 未旋转 refreshToken 时沿用旧值（响应缺省 refresh_token）
      refreshToken: token.refreshToken ?? refreshToken,
      expiresAt: token.expiresAt,
    })
    return token.accessToken
  } catch {
    clearSession()
    saveLoginRedirect(`${window.location.pathname}${window.location.search}`)
    window.location.assign('/login')
    return null
  }
}

/** 记录登录前目标地址（仅接受站内路径，防开放式重定向）。 */
export function saveLoginRedirect(target: string): void {
  if (!target.startsWith('/')) {
    return
  }
  try {
    window.sessionStorage.setItem(LOGIN_REDIRECT_STORAGE_KEY, target)
  } catch {
    // 持久化失败仅影响回跳，不影响登录本身
  }
}

/** 取出并清除登录前目标地址（一次性消费；无记录时返回 null）。 */
export function consumeLoginRedirect(): string | null {
  try {
    const target = window.sessionStorage.getItem(LOGIN_REDIRECT_STORAGE_KEY)
    window.sessionStorage.removeItem(LOGIN_REDIRECT_STORAGE_KEY)
    return target && target.startsWith('/') ? target : null
  } catch {
    return null
  }
}

/** PKCE 中间态（code_verifier + state）存 sessionStorage，回调后清除。 */
export function savePkce(state: string, codeVerifier: string): void {
  sessionStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify({ state, codeVerifier }))
}

export function loadPkce(): { state: string; codeVerifier: string } | null {
  try {
    const raw = sessionStorage.getItem(PKCE_STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as { state: string; codeVerifier: string }
    if (typeof parsed.state !== 'string' || typeof parsed.codeVerifier !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearPkce(): void {
  sessionStorage.removeItem(PKCE_STORAGE_KEY)
}
