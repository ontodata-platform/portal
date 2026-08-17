import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'

import { clearSession, saveSession } from '@/auth/session'
import { authGuard } from './index'

/** 构造最小路由对象（守卫只读取 path/fullPath）。 */
function toRoute(path: string, fullPath: string = path): RouteLocationNormalized {
  return { path, fullPath } as unknown as RouteLocationNormalized
}

describe('路由守卫 authGuard（WP-07 身份闭环）', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    clearSession()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('IAM 关闭（开发模式）：无会话也直通所有路由', async () => {
    vi.stubEnv('VITE_IAM_ENABLED', 'false')
    await expect(authGuard(toRoute('/marketplace'))).resolves.toBe(true)
  })

  it('IAM 启用且无会话：重定向登录页并记录目标路由', async () => {
    vi.stubEnv('VITE_IAM_ENABLED', 'true')
    await expect(authGuard(toRoute('/marketplace'))).resolves.toEqual({
      path: '/login',
      query: { redirect: '/marketplace' },
    })
  })

  it('IAM 启用：登录页与授权回调页自身放行（避免重定向环）', async () => {
    vi.stubEnv('VITE_IAM_ENABLED', 'true')
    await expect(authGuard(toRoute('/login', '/login?redirect=%2Ftasks'))).resolves.toBe(true)
    await expect(authGuard(toRoute('/auth/callback'))).resolves.toBe(true)
  })

  it('IAM 启用且会话有效：放行业务路由', async () => {
    vi.stubEnv('VITE_IAM_ENABLED', 'true')
    saveSession({ accessToken: 'token-1', refreshToken: 'refresh-1', expiresAt: Date.now() + 600_000 })
    await expect(authGuard(toRoute('/tasks'))).resolves.toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('IAM 启用且会话临期：守卫顺带续期成功后放行', async () => {
    vi.stubEnv('VITE_IAM_ENABLED', 'true')
    vi.stubEnv('VITE_OIDC_CLIENT_ID', 'portal-ui')
    vi.stubEnv('VITE_OIDC_TOKEN_ENDPOINT', 'https://idp.example/token')
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'token-new', expires_in: 300 }),
    })
    saveSession({ accessToken: 'token-old', refreshToken: 'refresh-1', expiresAt: Date.now() + 30_000 })

    await expect(authGuard(toRoute('/tasks'))).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('IAM 启用且会话过期无法续期（无 refreshToken）：重定向登录页', async () => {
    vi.stubEnv('VITE_IAM_ENABLED', 'true')
    saveSession({ accessToken: 'token-old', expiresAt: Date.now() - 1_000 })
    await expect(authGuard(toRoute('/tasks', '/tasks?tab=mine'))).resolves.toEqual({
      path: '/login',
      query: { redirect: '/tasks?tab=mine' },
    })
  })
})
