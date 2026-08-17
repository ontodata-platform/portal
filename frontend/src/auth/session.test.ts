import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import {
  accessToken,
  authState,
  clearPkce,
  clearSession,
  consumeLoginRedirect,
  ensureAccessToken,
  loadPkce,
  saveLoginRedirect,
  savePkce,
  saveSession,
} from './session'

describe('登录会话存储（M5 IAM）', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    clearSession()
  })

  it('保存/读取会话并持久化，过期令牌视为无会话', () => {
    saveSession({ accessToken: 'token-1', expiresAt: Date.now() + 60_000 })
    expect(authState.session?.accessToken).toBe('token-1')
    expect(accessToken()).toBe('token-1')

    saveSession({ accessToken: 'token-2', expiresAt: Date.now() - 1_000 })
    expect(accessToken()).toBeNull()
    expect(authState.session).not.toBeNull()
  })

  it('清除会话后不再附加令牌', () => {
    saveSession({ accessToken: 'token-1', expiresAt: Date.now() + 60_000 })
    clearSession()
    expect(accessToken()).toBeNull()
    expect(window.localStorage.getItem('ontodata.auth')).toBeNull()
  })

  it('PKCE 中间态存取与清除', () => {
    expect(loadPkce()).toBeNull()
    savePkce('state-1', 'verifier-1')
    expect(loadPkce()).toEqual({ state: 'state-1', codeVerifier: 'verifier-1' })
    clearPkce()
    expect(loadPkce()).toBeNull()
  })
})

describe('令牌续期（WP-07 ensureAccessToken）', () => {
  const fetchMock = vi.fn()
  const assignMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    clearSession()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_IAM_ENABLED', 'true')
    vi.stubEnv('VITE_OIDC_CLIENT_ID', 'portal-ui')
    vi.stubEnv('VITE_OIDC_TOKEN_ENDPOINT', 'https://idp.example/token')
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'token-new', expires_in: 300, refresh_token: 'refresh-2' }),
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('会话有效期充足：直接返回现有令牌，不调令牌端点', async () => {
    saveSession({ accessToken: 'token-1', refreshToken: 'refresh-1', expiresAt: Date.now() + 600_000 })
    await expect(ensureAccessToken()).resolves.toBe('token-1')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('临期会话（距过期不足 60 秒）：以 refreshToken 换发新令牌并更新存储', async () => {
    saveSession({ accessToken: 'token-old', refreshToken: 'refresh-1', expiresAt: Date.now() + 30_000 })
    await expect(ensureAccessToken()).resolves.toBe('token-new')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = fetchMock.mock.calls[0]![1]!.body as URLSearchParams
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('refresh-1')
    expect(body.get('client_id')).toBe('portal-ui')

    // 存储已更新：新访问令牌 + 旋转后的 refreshToken
    expect(authState.session?.accessToken).toBe('token-new')
    expect(authState.session?.refreshToken).toBe('refresh-2')
    expect(accessToken()).toBe('token-new')
  })

  it('续期响应缺省 refresh_token 时沿用旧 refreshToken（IdP 不旋转）', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'token-new', expires_in: 300 }),
    })
    saveSession({ accessToken: 'token-old', refreshToken: 'refresh-1', expiresAt: Date.now() - 1_000 })
    await ensureAccessToken()

    expect(authState.session?.refreshToken).toBe('refresh-1')
  })

  it('已过期且无 refreshToken：无法续期返回 null', async () => {
    saveSession({ accessToken: 'token-old', expiresAt: Date.now() - 1_000 })
    await expect(ensureAccessToken()).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('并发续期去重：多个调用共享同一进行中的请求', async () => {
    let resolveFetch!: (value: unknown) => void
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
    )
    saveSession({ accessToken: 'token-old', refreshToken: 'refresh-1', expiresAt: Date.now() + 30_000 })

    const first = ensureAccessToken()
    const second = ensureAccessToken()
    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'token-new', expires_in: 300 }),
    })

    await expect(first).resolves.toBe('token-new')
    await expect(second).resolves.toBe('token-new')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('续期失败：清空会话、记录当前地址并整页跳登录页（fail-closed）', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) })
    // jsdom 的 location.assign 不可重定义：整体替换 location 以捕获跳转
    vi.stubGlobal('location', { assign: assignMock, pathname: '/tasks', search: '', origin: 'http://localhost:5175' })
    saveSession({ accessToken: 'token-old', refreshToken: 'refresh-1', expiresAt: Date.now() + 30_000 })

    await expect(ensureAccessToken()).resolves.toBeNull()

    expect(authState.session).toBeNull()
    expect(window.localStorage.getItem('ontodata.auth')).toBeNull()
    expect(assignMock).toHaveBeenCalledWith('/login')
    // 当前地址已记录，登录成功后回跳
    expect(consumeLoginRedirect()).toBe('/tasks')
  })

  it('登录回跳地址：仅接受站内路径（防开放式重定向），一次性消费', () => {
    saveLoginRedirect('/workbench')
    expect(consumeLoginRedirect()).toBe('/workbench')
    expect(consumeLoginRedirect()).toBeNull()

    saveLoginRedirect('https://evil.example/phish')
    expect(consumeLoginRedirect()).toBeNull()
  })
})
