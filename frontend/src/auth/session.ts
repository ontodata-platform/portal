/**
 * 登录会话存储（M5 IAM 浏览器登录）：访问令牌/刷新令牌/过期时刻持久化到 localStorage，
 * 响应式单例供 axios 拦截器与布局直接读取（避免 store ↔ api 循环依赖）。
 * 未启用 IAM 时 session 恒为空——所有行为与历史一致。
 */
import { reactive } from 'vue'

import { iamEnabled } from './oidc'

const AUTH_STORAGE_KEY = 'ontodata.auth'
export const PKCE_STORAGE_KEY = 'ontodata.pkce'

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
