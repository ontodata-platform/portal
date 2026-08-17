<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { buildTokenRequest, iamEnabled, oidcConfig, parseTokenResponse } from '@/auth/oidc'
import { clearPkce, consumeLoginRedirect, loadPkce, saveSession } from '@/auth/session'

const route = useRoute()
const router = useRouter()

/**
 * 授权回调（M5 IAM 浏览器登录）：校验 state（防 CSRF）→ 令牌端点以 code + code_verifier
 * 交换访问令牌（PKCE）→ 保存会话 → 回跳登录前目标地址（无记录回首页）。
 * 任何失败清除中间态并回登录页（fail-closed）。
 */
onMounted(async () => {
  if (!iamEnabled()) {
    router.replace('/')
    return
  }
  const code = route.query.code
  const state = route.query.state
  const pkce = loadPkce()
  if (typeof code !== 'string' || typeof state !== 'string' || !pkce || state !== pkce.state) {
    clearPkce()
    router.replace('/login')
    return
  }
  try {
    const config = oidcConfig()
    const request = buildTokenRequest(config, code, pkce.codeVerifier)
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
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
    })
    clearPkce()
    // WP-07：登录成功后回跳守卫记录的目标地址（无记录回首页）
    router.replace(consumeLoginRedirect() ?? '/')
  } catch {
    clearPkce()
    router.replace('/login')
  }
})
</script>

<template>
  <a-card>
    <p>正在完成身份认证……</p>
  </a-card>
</template>
