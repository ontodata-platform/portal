import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type RouteLocationNormalized } from 'vue-router'

import { clearSession, saveSession } from '@/auth/session'
import { useIdentityStore } from '@/stores/identity'
import { authGuard, routes } from './index'

/** 构造最小路由对象（守卫只读取 path/fullPath/meta）。 */
function toRoute(
  path: string,
  fullPath: string = path,
  meta: Record<string, unknown> = {},
): RouteLocationNormalized {
  return { path, fullPath, meta } as unknown as RouteLocationNormalized
}

describe('路由守卫 authGuard（WP-07 身份闭环与角色鉴权）', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
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
    await expect(authGuard(toRoute('/data-workbench'))).resolves.toBe(true)
  })

  it('IAM 启用且无会话：重定向登录页并记录目标路由', async () => {
    vi.stubEnv('VITE_IAM_ENABLED', 'true')
    await expect(authGuard(toRoute('/data-workbench'))).resolves.toEqual({
      path: '/login',
      query: { redirect: '/data-workbench' },
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
    await expect(authGuard(toRoute('/personal/tasks'))).resolves.toBe(true)
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

    await expect(authGuard(toRoute('/personal/tasks'))).resolves.toBe(true)
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

  it('无权限角色且非 devMode 访问受限路由回退至 /personal', async () => {
    vi.stubEnv('VITE_IAM_ENABLED', 'true')
    saveSession({ accessToken: 'token-valid', expiresAt: Date.now() + 600_000 })
    const store = useIdentityStore()
    store.setIdentity({
      name: 'normal-user',
      tenantId: 'default',
      roles: ['portal-user'],
      devMode: false,
    })

    const route = toRoute('/admin/operations', '/admin/operations', { roles: ['operator', 'admin'] })
    await expect(authGuard(route)).resolves.toEqual({ path: '/personal' })
  })
})

describe('IA v2 路由与旧路径重定向', () => {
  let router: ReturnType<typeof createRouter>

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.stubEnv('VITE_IAM_ENABLED', 'false')
    const store = useIdentityStore()
    store.setIdentity({
      name: 'dev-user',
      tenantId: 'default',
      roles: ['portal-admin'],
      devMode: true,
    })
    router = createRouter({ history: createMemoryHistory(), routes })
    router.beforeEach(authGuard)
    await router.push('/assistant')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('默认落地 /assistant', async () => {
    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/assistant')
  })

  it.each([
    ['/tasks', '/personal/tasks'],
    ['/approvals', '/personal/approvals'],
    ['/results', '/personal/results'],
    ['/requirements', '/personal/requirements'],
    ['/notifications', '/personal/notifications'],
    ['/scenarios', '/admin/operations'],
    ['/operations', '/admin/operations'],
    ['/marketplace', '/data-workbench'],
    ['/search', '/assistant'],
  ])('重定向 %s → %s', async (from, to) => {
    await router.push(from)
    expect(router.currentRoute.value.path).toBe(to)
  })

  it('审批深链 query 透传到 /personal/approvals', async () => {
    await router.push('/approvals?code=apr-1&from=agent')
    expect(router.currentRoute.value.path).toBe('/personal/approvals')
    expect(router.currentRoute.value.query).toMatchObject({ code: 'apr-1', from: 'agent' })
  })

  it('统一搜索 query 透传到 /assistant', async () => {
    await router.push('/search?q=客户')
    expect(router.currentRoute.value.path).toBe('/assistant')
    expect(router.currentRoute.value.query.q).toBe('客户')
  })

  it('/agent/chat?session= 续接到 /assistant?resume=', async () => {
    await router.push('/agent/chat?session=sess-9')
    expect(router.currentRoute.value.path).toBe('/assistant')
    expect(router.currentRoute.value.query.resume).toBe('sess-9')
  })

  it('/admin 落到运营页', async () => {
    await router.push('/admin')
    expect(router.currentRoute.value.path).toBe('/admin/operations')
  })

  it.each(['/admin/requirements', '/admin/approvals', '/admin/iam', '/admin/operations'])(
    '管理端路由 %s 可解析',
    async (path) => {
      await router.push(path)
      expect(router.currentRoute.value.path).toBe(path)
    },
  )
})
