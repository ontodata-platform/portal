import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { consumeLoginRedirect, loadPkce } from '@/auth/session'
import LoginView from './LoginView.vue'

const replaceMock = vi.fn()
const routeQuery = vi.fn((): Record<string, string> => ({}))

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
      components: { LoginView },
      template: '<LoginView />',
    }),
    { global: { stubs } },
  )
}

describe('LoginView（M5 IAM 浏览器登录）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('IAM 未启用（缺省）直接回首页', async () => {
    mountView()
    await flushPromises()

    expect(replaceMock).toHaveBeenCalledWith('/')
  })

  it('IAM 启用：生成 PKCE 中间态并跳转 IdP 授权端点', async () => {
    vi.stubEnv('VITE_IAM_ENABLED', 'true')
    vi.stubEnv('VITE_OIDC_CLIENT_ID', 'portal-ui')
    vi.stubEnv('VITE_OIDC_AUTHORIZE_ENDPOINT', 'https://idp.example/auth')
    vi.stubEnv('VITE_OIDC_TOKEN_ENDPOINT', 'https://idp.example/token')
    vi.stubEnv('VITE_OIDC_REDIRECT_URI', 'http://localhost:5175/auth/callback')
    // jsdom 的 location.assign 不可重定义：整体替换 location 以捕获跳转
    const assign = vi.fn()
    vi.stubGlobal('location', { assign, origin: 'http://localhost:5175' })

    mountView()
    await flushPromises()

    expect(assign).toHaveBeenCalledTimes(1)
    const target = assign.mock.calls[0]![0] as string
    const params = new URL(target).searchParams
    expect(params.get('response_type')).toBe('code')
    expect(params.get('client_id')).toBe('portal-ui')
    expect(params.get('code_challenge_method')).toBe('S256')

    // PKCE 中间态已存（回调页据此交换令牌）
    const pkce = loadPkce()
    expect(pkce).not.toBeNull()
    expect(pkce!.state).toBe(params.get('state'))
    expect(pkce!.codeVerifier.length).toBeGreaterThanOrEqual(43)
  })

  it('IAM 启用且带 redirect 参数：登录前目标地址先存 sessionStorage（供回调页回跳）', async () => {
    vi.stubEnv('VITE_IAM_ENABLED', 'true')
    vi.stubEnv('VITE_OIDC_CLIENT_ID', 'portal-ui')
    vi.stubEnv('VITE_OIDC_AUTHORIZE_ENDPOINT', 'https://idp.example/auth')
    vi.stubEnv('VITE_OIDC_TOKEN_ENDPOINT', 'https://idp.example/token')
    routeQuery.mockReturnValue({ redirect: '/tasks?tab=mine' })
    const assign = vi.fn()
    vi.stubGlobal('location', { assign, origin: 'http://localhost:5175' })

    mountView()
    await flushPromises()

    expect(assign).toHaveBeenCalledTimes(1)
    expect(consumeLoginRedirect()).toBe('/tasks?tab=mine')
  })
})
