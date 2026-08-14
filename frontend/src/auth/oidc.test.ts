import { describe, expect, it } from 'vitest'

import {
  buildAuthorizeUrl,
  buildTokenRequest,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  parseTokenResponse,
  type OidcConfig,
} from './oidc'

const config: OidcConfig = {
  clientId: 'portal-ui',
  redirectUri: 'http://localhost:5175/auth/callback',
  scope: 'openid profile',
  authorizeEndpoint: 'https://idp.example/auth',
  tokenEndpoint: 'https://idp.example/token',
}

describe('OIDC 授权码 + PKCE 纯函数', () => {
  it('授权 URL 携带 code + PKCE S256 参数', () => {
    const url = buildAuthorizeUrl(config, 'state-1', 'challenge-1')
    expect(url.startsWith('https://idp.example/auth?')).toBe(true)
    const params = new URL(url).searchParams
    expect(params.get('response_type')).toBe('code')
    expect(params.get('client_id')).toBe('portal-ui')
    expect(params.get('redirect_uri')).toBe('http://localhost:5175/auth/callback')
    expect(params.get('scope')).toBe('openid profile')
    expect(params.get('state')).toBe('state-1')
    expect(params.get('code_challenge')).toBe('challenge-1')
    expect(params.get('code_challenge_method')).toBe('S256')
  })

  it('令牌请求为 authorization_code 表单并携带 code_verifier', () => {
    const request = buildTokenRequest(config, 'code-1', 'verifier-1')
    expect(request.url).toBe('https://idp.example/token')
    expect(request.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(request.body.get('grant_type')).toBe('authorization_code')
    expect(request.body.get('code')).toBe('code-1')
    expect(request.body.get('code_verifier')).toBe('verifier-1')
    expect(request.body.get('client_id')).toBe('portal-ui')
  })

  it('code_verifier 长度与字符集满足 RFC 7636', () => {
    const verifier = generateCodeVerifier()
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier.length).toBeLessThanOrEqual(128)
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/)
  })

  it('code_challenge 为 verifier 的 base64url(SHA-256)', async () => {
    // 注入固定 SHA-256 桩：digest = 字节 0x00..0x1f
    const fakeSha256 = async (): Promise<ArrayBuffer> => {
      const bytes = new Uint8Array(32)
      for (let i = 0; i < 32; i++) {
        bytes[i] = i
      }
      return bytes.buffer
    }
    const challenge = await generateCodeChallenge('verifier', fakeSha256)
    // base64url(0x00..0x1f) = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8"
    expect(challenge).toBe('AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8')
    expect(challenge).not.toContain('=')
  })

  it('令牌响应解析：缺失 access_token/expires_in 拒绝', () => {
    const token = parseTokenResponse({ access_token: 'a1', expires_in: 300, refresh_token: 'r1' })
    expect(token.accessToken).toBe('a1')
    expect(token.refreshToken).toBe('r1')
    expect(token.expiresAt).toBeGreaterThan(Date.now())

    expect(() => parseTokenResponse({ expires_in: 300 })).toThrowError('access_token')
    expect(() => parseTokenResponse({ access_token: 'a1' })).toThrowError('expires_in')
    expect(() => parseTokenResponse(null)).toThrowError('access_token')
  })

  it('state 为随机防 CSRF 串', () => {
    expect(generateState()).not.toBe(generateState())
    expect(generateState(() => 0.5).length).toBeGreaterThanOrEqual(43)
  })
})
