import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'

import { iamEnabled } from '@/auth/oidc'
import { ensureAccessToken } from '@/auth/session'
import MainLayout from '@/layouts/MainLayout.vue'
import { useIdentityStore } from '@/stores/identity'

/**
 * 登录与权限门守卫（WP-07 身份闭环与角色控制）：
 * 1. IAM 关闭（开发模式）：直通所有路由。
 * 2. IAM 启用时无有效会话（无令牌或已过期且无法续期）：重定向登录页。
 * 3. 角色鉴权：若路由要求特定角色（如 operations 需要 operator/admin），无权限时回退至 /personal。
 */
export async function authGuard(
  to: RouteLocationNormalized,
): Promise<true | { path: string; query?: Record<string, string> }> {
  if (to.path === '/login' || to.path === '/auth/callback') {
    return true
  }

  if (iamEnabled()) {
    const token = await ensureAccessToken()
    if (!token) {
      return { path: '/login', query: { redirect: to.fullPath } }
    }
  }

  // 角色鉴权检查
  const requiredRoles = to.meta?.roles as string[] | undefined
  if (requiredRoles && requiredRoles.length > 0) {
    try {
      const identityStore = useIdentityStore()
      if (!identityStore.loaded) {
        await identityStore.fetchIdentity()
      }
      if (!identityStore.devMode && !identityStore.roles.some((r) => requiredRoles.includes(r))) {
        return { path: '/personal' }
      }
    } catch {
      // 忽略异常，继续放行
    }
  }

  return true
}

/**
 * 管理门户路由体系：按业务域分组，默认首页为个人工作台 (/personal)。
 */
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/auth/callback',
      component: () => import('@/views/CallbackView.vue'),
    },
    {
      path: '/',
      component: MainLayout,
      children: [
        { path: '', redirect: '/personal' },
        {
          path: 'personal',
          component: () => import('@/views/PersonalCenterView.vue'),
          meta: { titleKey: 'menu.personal', group: 'groupWorkspace' },
        },
        {
          path: 'search',
          component: () => import('@/views/SearchView.vue'),
          meta: { titleKey: 'menu.search', group: 'groupDiscover' },
        },
        {
          path: 'marketplace',
          component: () => import('@/views/MarketplaceView.vue'),
          meta: { titleKey: 'menu.marketplace', group: 'groupDiscover' },
        },
        {
          path: 'marketplace/:code',
          component: () => import('@/views/MarketplaceDetailView.vue'),
          meta: { titleKey: 'menu.marketplaceDetail', group: 'groupDiscover' },
        },
        {
          path: 'workbench',
          component: () => import('@/views/WorkbenchView.vue'),
          meta: { titleKey: 'menu.workbench', group: 'groupDiscover' },
        },
        {
          path: 'workbench/templates/:code',
          component: () => import('@/views/WorkbenchRunView.vue'),
          meta: { titleKey: 'menu.workbenchRun', group: 'groupDiscover' },
        },
        {
          path: 'tasks',
          component: () => import('@/views/TasksView.vue'),
          meta: { titleKey: 'menu.tasks', group: 'groupGovernance' },
        },
        {
          path: 'notifications',
          component: () => import('@/views/NotificationsView.vue'),
          meta: { titleKey: 'menu.notifications', group: 'groupGovernance' },
        },
        {
          path: 'approvals',
          component: () => import('@/views/ApprovalsView.vue'),
          meta: { titleKey: 'menu.approvals', group: 'groupGovernance' },
        },
        {
          path: 'results',
          component: () => import('@/views/ResultsView.vue'),
          meta: { titleKey: 'menu.results', group: 'groupGovernance' },
        },
        {
          path: 'requirements',
          component: () => import('@/views/RequirementsView.vue'),
          meta: { titleKey: 'menu.requirements', group: 'groupGovernance' },
        },
        {
          path: 'scenarios',
          component: () => import('@/views/ScenariosView.vue'),
          meta: { titleKey: 'menu.scenarios', group: 'groupWorkspace' },
        },
        {
          path: 'agent/chat',
          component: () => import('@/views/AgentChatView.vue'),
          meta: { titleKey: 'menu.agentChat', group: 'groupWorkspace' },
        },
        {
          path: 'operations',
          component: () => import('@/views/OperationsView.vue'),
          meta: {
            titleKey: 'menu.operations',
            group: 'groupOperations',
            roles: ['operator', 'admin', 'portal-operator', 'portal-admin'],
          },
        },
      ],
    },
  ],
})

router.beforeEach(authGuard)

export default router
