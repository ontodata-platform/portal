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
  <div class="auth-transition">
    <div class="auth-panel">
      <p class="auth-brand">本体数据管理门户</p>
      <p class="auth-message">正在完成身份认证……</p>
      <span class="auth-spinner" aria-hidden="true"></span>
    </div>
  </div>
</template>

<style scoped>
.auth-transition {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.auth-panel {
  display: grid;
  gap: var(--od-space-1);
  justify-items: center;
  border: 1px solid var(--od-color-line);
  border-radius: 10px;
  padding: var(--od-space-4) var(--od-space-4);
  background: var(--od-color-panel);
  box-shadow: 0 1px 4px rgba(16, 42, 67, 0.06);
}

.auth-brand {
  margin: 0;
  color: var(--od-color-primary);
  font-family: var(--od-font-mono);
  font-size: 13px;
  letter-spacing: 0.08em;
}

.auth-message {
  margin: 0;
  color: var(--od-color-muted);
}

.auth-spinner {
  width: 18px;
  height: 18px;
  margin-top: var(--od-space-1);
  border: 2px solid var(--od-color-line);
  border-top-color: var(--od-color-accent);
  border-radius: 50%;
  animation: auth-spin 0.9s linear infinite;
}

@keyframes auth-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
