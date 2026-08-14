import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { savePkce } from '@/auth/session'
import CallbackView from './CallbackView.vue'

const replaceMock = vi.fn()
const routeQuery = vi.fn(() => ({ code: 'code-1', state: 'state-1' }))
const fetchMock = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routeQuery() }),
  useRouter: () => ({ replace: replaceMock }),
}))

const stubs = {
  'a-card': { template: '<div><slot /></div>' },
}

function mountView() {
  return mount(
    defineComponent({
      components: { CallbackView },
      template: '<CallbackView />',
    }),
    { global: { stubs } },
  )
}

describe('CallbackView（M5 IAM 授权回调）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_IAM_ENABLED', 'true')
    vi.stubEnv('VITE_OIDC_CLIENT_ID', 'portal-ui')
    vi.stubEnv('VITE_OIDC_TOKEN_ENDPOINT', 'https://idp.example/token')
    vi.stubEnv('VITE_OIDC_REDIRECT_URI', 'http://localhost:5175/auth/callback')
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'token-1', expires_in: 300, refresh_token: 'refresh-1' }),
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('state 匹配：以 code + code_verifier 交换令牌并保存会话', async () => {
    savePkce('state-1', 'verifier-1')
    mountView()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = fetchMock.mock.calls[0]![1]!.body as URLSearchParams
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('code-1')
    expect(body.get('code_verifier')).toBe('verifier-1')

    const stored = JSON.parse(window.localStorage.getItem('ontodata.auth')!) as {
      accessToken: string
      refreshToken?: string
      expiresAt: number
    }
    expect(stored.accessToken).toBe('token-1')
    expect(stored.refreshToken).toBe('refresh-1')
    expect(stored.expiresAt).toBeGreaterThan(Date.now())
    expect(replaceMock).toHaveBeenCalledWith('/')
  })

  it('state 不匹配（防 CSRF）拒绝交换并回登录页', async () => {
    routeQuery.mockReturnValue({ code: 'code-1', state: 'forged' })
    savePkce('state-1', 'verifier-1')
    mountView()
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(replaceMock).toHaveBeenCalledWith('/login')
  })

  it('IAM 未启用直接回首页', async () => {
    vi.stubEnv('VITE_IAM_ENABLED', 'false')
    mountView()
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(replaceMock).toHaveBeenCalledWith('/')
  })
})
