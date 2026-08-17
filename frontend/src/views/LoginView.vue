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
  <a-card>
    <p>正在跳转到统一身份认证……</p>
  </a-card>
</template>
