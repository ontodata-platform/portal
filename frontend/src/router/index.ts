import {
  createMemoryHistory,
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
  type RouteRecordRaw,
} from 'vue-router'

import { iamEnabled } from '@/auth/oidc'
import { ensureAccessToken } from '@/auth/session'
import MainLayout from '@/layouts/MainLayout.vue'
import { useIdentityStore } from '@/stores/identity'

export const ADMIN_ROLES = ['portal-operator', 'portal-admin', 'operator', 'admin']

/**
 * 登录与权限门守卫（WP-07 身份闭环与角色控制）：
 * 1. IAM 关闭（开发模式）：直通所有路由。
 * 2. IAM 启用时无有效会话（无令牌或已过期且无法续期）：重定向登录页。
 * 3. 角色鉴权：若路由要求特定角色，无权限时回退至 /personal。
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

function passQuery(path: string) {
  return (to: { query: RouteLocationNormalized['query'] }) => ({ path, query: to.query })
}

/**
 * 门户 IA v2：默认落地智能服务；个人事项收为 /personal/* 签页；
 * 管理端同应用 /admin 分区；旧一级路径全部重定向并透传 query。
 */
export const routes: RouteRecordRaw[] = [
    {
      path: '/login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/auth/callback',
      component: () => import('@/views/CallbackView.vue'),
    },
    { path: '/tasks', redirect: passQuery('/personal/tasks') },
    { path: '/approvals', redirect: passQuery('/personal/approvals') },
    { path: '/results', redirect: passQuery('/personal/results') },
    { path: '/requirements', redirect: passQuery('/personal/requirements') },
    { path: '/notifications', redirect: passQuery('/personal/notifications') },
    { path: '/scenarios', redirect: '/admin/assemblies' },
    { path: '/operations', redirect: '/admin/operations' },
    { path: '/search', redirect: passQuery('/assistant') },
    {
      path: '/agent/chat',
      redirect: (to: { query: RouteLocationNormalized['query'] }) => ({
        path: '/assistant',
        query: {
          resume: String(to.query.session ?? to.query.resume ?? ''),
        },
      }),
    },
    {
      path: '/',
      component: MainLayout,
      children: [
        { path: '', redirect: '/assistant' },
        {
          path: 'assistant',
          name: 'assistant',
          component: () => import('@/views/assistant/AssistantView.vue'),
          meta: { titleKey: 'menu.assistant', group: 'groupPortal' },
        },
        {
          path: 'personal',
          component: () => import('@/views/personal/PersonalWorkspaceView.vue'),
          meta: { titleKey: 'menu.personal', group: 'groupPortal' },
          children: [
            {
              path: '',
              name: 'personal-overview',
              component: () => import('@/views/personal/sections/OverviewSection.vue'),
              meta: { titleKey: 'menu.personal', group: 'groupPortal' },
            },
            {
              path: 'tasks',
              name: 'personal-tasks',
              component: () => import('@/views/personal/sections/TaskSection.vue'),
              meta: { titleKey: 'menu.tasks', group: 'groupPortal' },
            },
            {
              path: 'approvals',
              name: 'personal-approvals',
              component: () => import('@/views/personal/sections/ApprovalSection.vue'),
              meta: { titleKey: 'menu.approvals', group: 'groupPortal' },
            },
            {
              path: 'requirements',
              name: 'personal-requirements',
              component: () => import('@/views/personal/sections/RequirementSection.vue'),
              meta: { titleKey: 'menu.requirements', group: 'groupPortal' },
            },
            {
              path: 'results',
              name: 'personal-results',
              component: () => import('@/views/personal/sections/ResultSection.vue'),
              meta: { titleKey: 'menu.results', group: 'groupPortal' },
            },
            {
              path: 'notifications',
              name: 'personal-notifications',
              component: () => import('@/views/personal/sections/NotificationSection.vue'),
              meta: { titleKey: 'menu.notifications', group: 'groupPortal' },
            },
          ],
        },
        {
          path: 'marketplace',
          component: () => import('@/views/MarketplaceView.vue'),
          meta: { titleKey: 'menu.marketplace', group: 'groupPortal' },
        },
        {
          path: 'marketplace/:code',
          component: () => import('@/views/MarketplaceDetailView.vue'),
          meta: { titleKey: 'menu.marketplaceDetail', group: 'groupPortal' },
        },
        {
          path: 'workbench',
          component: () => import('@/views/WorkbenchView.vue'),
          meta: { titleKey: 'menu.workbench', group: 'groupPortal' },
        },
        {
          path: 'workbench/templates/:code',
          component: () => import('@/views/WorkbenchRunView.vue'),
          meta: { titleKey: 'menu.workbenchRun', group: 'groupPortal' },
        },
        {
          path: 'admin',
          component: () => import('@/layouts/AdminLayout.vue'),
          meta: { titleKey: 'menu.admin', roles: ADMIN_ROLES },
          children: [
            { path: '', redirect: '/admin/operations' },
            {
              path: 'operations',
              name: 'admin-operations',
              component: () => import('@/views/admin/OperationsAdminView.vue'),
              meta: { titleKey: 'menu.adminOperations', roles: ADMIN_ROLES },
            },
            {
              path: 'assemblies',
              name: 'admin-assemblies',
              component: () => import('@/views/admin/AssemblyAdminView.vue'),
              meta: { titleKey: 'menu.adminAssemblies', roles: ADMIN_ROLES },
            },
            {
              path: 'platform',
              name: 'admin-platform',
              component: () => import('@/views/admin/PlatformAdminView.vue'),
              meta: { titleKey: 'menu.adminPlatform', roles: ADMIN_ROLES },
            },
          ],
        },
      ],
    },
  ]

const router = createRouter({
  history: import.meta.env.VITEST ? createMemoryHistory() : createWebHistory(),
  routes,
})

router.beforeEach(authGuard)

export default router
