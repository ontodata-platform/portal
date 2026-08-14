import { beforeEach, describe, expect, it } from 'vitest'

import {
  accessToken,
  authState,
  clearPkce,
  clearSession,
  loadPkce,
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
