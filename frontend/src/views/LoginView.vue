<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  buildAuthorizeUrl,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  iamEnabled,
  oidcConfig,
} from '@/auth/oidc'
import { saveLoginRedirect, savePkce } from '@/auth/session'

const route = useRoute()
const router = useRouter()

/**
 * 登录页（M5 IAM 浏览器登录）：IAM 未启用时直接回首页；启用时生成 PKCE 中间态
 * 并跳转 IdP 授权端点（authorization code + S256）。
 * WP-07：路由守卫带来的 redirect 查询参数（登录前目标地址）先存 sessionStorage——
 * IdP 往返后查询参数丢失，回调页据此回跳。
 */
onMounted(async () => {
  if (!iamEnabled()) {
    router.replace('/')
    return
  }
  const redirect = route.query.redirect
  if (typeof redirect === 'string') {
    saveLoginRedirect(redirect)
  }
  const config = oidcConfig()
  const state = generateState()
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  savePkce(state, codeVerifier)
  window.location.assign(buildAuthorizeUrl(config, state, codeChallenge))
})
</script>

<template>
  <div class="auth-transition">
    <div class="auth-panel">
      <p class="auth-brand">本体数据管理门户</p>
      <p class="auth-message">正在跳转到统一身份认证……</p>
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
