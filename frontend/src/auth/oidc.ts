/**
 * OIDC 授权码 + PKCE 纯函数（M5 IAM 浏览器登录骨架）。
 *
 * 约定：SPA 直接对接 IdP（Keycloak 等），后端只做资源服务器（Bearer JWT 校验）；
 * 授权端点与令牌端点由部署配置显式给出（VITE_OIDC_AUTHORIZE_ENDPOINT /
 * VITE_OIDC_TOKEN_ENDPOINT），不依赖发现文档——便于测试与多 IdP 适配。
 * 生产必须 HTTPS（crypto.subtle 仅在安全上下文可用）；非安全上下文按伪随机降级
 * 仅供本地演示，注释明确不用于生产。
 */

export interface OidcConfig {
  clientId: string
  redirectUri: string
  scope: string
  authorizeEndpoint: string
  tokenEndpoint: string
}

/** 令牌端点响应解析结果：expiresAt 为绝对毫秒时间戳。 */
export interface TokenResult {
  accessToken: string
  refreshToken?: string
  expiresAt: number
}

export function iamEnabled(): boolean {
  return import.meta.env.VITE_IAM_ENABLED === 'true'
}

export function oidcConfig(): OidcConfig {
  return {
    clientId: import.meta.env.VITE_OIDC_CLIENT_ID ?? '',
    redirectUri: import.meta.env.VITE_OIDC_REDIRECT_URI ?? `${window.location.origin}/auth/callback`,
    scope: import.meta.env.VITE_OIDC_SCOPE ?? 'openid profile',
    authorizeEndpoint: import.meta.env.VITE_OIDC_AUTHORIZE_ENDPOINT ?? '',
    tokenEndpoint: import.meta.env.VITE_OIDC_TOKEN_ENDPOINT ?? '',
  }
}

/** 构造授权端点 URL：response_type=code + PKCE S256 挑战。 */
export function buildAuthorizeUrl(config: OidcConfig, state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${config.authorizeEndpoint}?${params.toString()}`
}

/** 构造令牌端点请求：authorization_code + code_verifier（PKCE 校验）。 */
export function buildTokenRequest(
  config: OidcConfig,
  code: string,
  codeVerifier: string,
): { url: string; headers: Record<string, string>; body: URLSearchParams } {
  return {
    url: config.tokenEndpoint,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      code,
      code_verifier: codeVerifier,
    }),
  }
}

/** 构造刷新令牌请求：grant_type=refresh_token 换发新令牌（WP-07 令牌续期）。 */
export function buildRefreshTokenRequest(
  config: OidcConfig,
  refreshToken: string,
): { url: string; headers: Record<string, string>; body: URLSearchParams } {
  return {
    url: config.tokenEndpoint,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      refresh_token: refreshToken,
    }),
  }
}

/** 解析令牌响应：缺失 access_token/expires_in 视为协议错误（中文异常）。 */
export function parseTokenResponse(json: unknown): TokenResult {
  const body = (json ?? {}) as Record<string, unknown>
  const accessToken = body.access_token
  const expiresIn = body.expires_in
  if (typeof accessToken !== 'string' || accessToken.length === 0 || typeof expiresIn !== 'number' || expiresIn <= 0) {
    throw new Error('IdP 令牌响应缺少 access_token/expires_in')
  }
  const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : undefined
  return { accessToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000 }
}

/** PKCE code_verifier：43-128 字符 base64url 字母表（RFC 7636）。 */
export function generateCodeVerifier(entropy: () => number = Math.random): string {
  const length = 64
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  let verifier = ''
  for (let i = 0; i < length; i++) {
    verifier += alphabet.charAt(Math.floor(entropy() * alphabet.length))
  }
  return verifier
}

/** PKCE code_challenge：base64url(SHA-256(verifier))（RFC 7636 S256）。 */
export async function generateCodeChallenge(
  verifier: string,
  sha256: (data: Uint8Array) => Promise<ArrayBuffer> = defaultSha256,
): Promise<string> {
  const digest = await sha256(new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

/** OAuth2 state：防 CSRF 随机串。 */
export function generateState(entropy: () => number = Math.random): string {
  return generateCodeVerifier(entropy)
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function defaultSha256(data: Uint8Array): Promise<ArrayBuffer> {
  // 生产（HTTPS 安全上下文）走 WebCrypto；非安全上下文（本地演示/测试）按伪随机降级，
  // 仅用于非生产——IdP 校验会失败，强制部署启用 HTTPS。
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return crypto.subtle.digest('SHA-256', data)
  }
  const bytes = new Uint8Array(32)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256)
  }
  return bytes.buffer
}
