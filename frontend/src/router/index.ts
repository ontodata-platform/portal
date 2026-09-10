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
      // D5-3：管理端路由额外校验权限矩阵中的 ADMIN.ACCESS 资源（IAM 开启语义）
      if (to.path.startsWith('/admin') && !identityStore.devMode) {
        const { rolesHaveResource } = await import('@/mocks/permissionMatrix')
        if (!rolesHaveResource(identityStore.roles, 'ADMIN.ACCESS')) {
          return { path: '/personal' }
        }
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
    { path: '/scenarios', redirect: '/admin/operations' },
    { path: '/operations', redirect: '/admin/operations' },
    { path: '/marketplace', redirect: '/data-workbench' },
    {
      path: '/marketplace/:code',
      redirect: (to: { params: RouteLocationNormalized['params']; query: RouteLocationNormalized['query'] }) => ({
        path: `/data-workbench/${String(to.params.code ?? '')}`,
        query: to.query,
      }),
    },
    { path: '/search', redirect: passQuery('/assistant') },
    { path: '/workbench', redirect: '/algorithm-workbench' },
    {
      path: '/workbench/templates/:code',
      redirect: (to: { params: RouteLocationNormalized['params'] }) => ({
        path: `/algorithm-workbench/${String(to.params.code ?? '')}/run`,
      }),
    },
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
        { path: '', redirect: '/home' },
        {
          path: 'home',
          name: 'home',
          component: () => import('@/views/home/HomeView.vue'),
          meta: { titleKey: 'menu.home', group: 'groupPortal' },
        },
        {
          // C2 待办中心：铃铛落地页
          path: 'todos',
          name: 'todo-center',
          component: () => import('@/views/todos/TodoCenterView.vue'),
          meta: { titleKey: 'todos.title', group: 'groupPortal' },
        },
        {
          // C1 统一事项详情：审批/申请/需求/任务/结果共用
          path: 'matter/:type/:code',
          name: 'matter-detail',
          component: () => import('@/views/matter/MatterDetailView.vue'),
          meta: { titleKey: 'matter.title', group: 'groupPortal' },
        },
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
            {
              path: 'profile',
              name: 'personal-profile',
              component: () => import('@/views/personal/sections/ProfileSection.vue'),
              meta: { titleKey: 'menu.profile', group: 'groupPortal' },
            },
            {
              path: 'qa',
              name: 'personal-qa',
              component: () => import('@/views/personal/sections/QaHistorySection.vue'),
              meta: { titleKey: 'menu.qa', group: 'groupPortal' },
            },
            {
              path: 'favorites',
              name: 'personal-favorites',
              component: () => import('@/views/personal/sections/FavoritesSection.vue'),
              meta: { titleKey: 'menu.favorites', group: 'groupPortal' },
            },
          ],
        },
        {
          path: 'data-workbench',
          component: () => import('@/views/MarketplaceView.vue'),
          meta: { titleKey: 'menu.marketplace', group: 'groupPortal' },
        },
        {
          path: 'data-workbench/dataset/:code',
          name: 'data-workbench-dataset',
          component: () => import('@/views/data-workbench/DatasetDetailView.vue'),
          meta: { titleKey: 'menu.marketplaceDetail', group: 'groupPortal' },
        },
        {
          path: 'data-workbench/:code',
          component: () => import('@/views/MarketplaceDetailView.vue'),
          meta: { titleKey: 'menu.marketplaceDetail', group: 'groupPortal' },
        },
        {
          path: 'algorithm-workbench',
          component: () => import('@/views/algorithm-workbench/AlgorithmWorkbenchView.vue'),
          meta: { titleKey: 'menu.algorithmWorkbench', group: 'groupPortal' },
        },
        {
          path: 'algorithm-workbench/:code',
          component: () => import('@/views/algorithm-workbench/AlgorithmServiceDetailView.vue'),
          meta: { titleKey: 'menu.algorithmWorkbench', group: 'groupPortal' },
        },
        {
          path: 'algorithm-workbench/:code/run',
          component: () => import('@/views/algorithm-workbench/RunWizardView.vue'),
          meta: { titleKey: 'menu.algorithmWorkbench', group: 'groupPortal' },
        },
        {
          path: 'admin',
          component: () => import('@/layouts/AdminLayout.vue'),
          meta: { titleKey: 'menu.admin', roles: ADMIN_ROLES },
          children: [
            { path: '', redirect: '/admin/operations' },
            {
              path: 'requirements',
              name: 'admin-requirements',
              component: () => import('@/views/admin/RequirementAdminView.vue'),
              meta: { titleKey: 'menu.adminRequirements', roles: ADMIN_ROLES },
            },
            {
              path: 'approvals',
              name: 'admin-approvals',
              component: () => import('@/views/admin/ApprovalAdminView.vue'),
              meta: { titleKey: 'menu.adminApprovals', roles: ADMIN_ROLES },
            },
            {
              path: 'iam',
              name: 'admin-iam',
              component: () => import('@/views/admin/IamAdminView.vue'),
              meta: { titleKey: 'menu.adminIam', roles: ADMIN_ROLES },
            },
            {
              path: 'operations',
              name: 'admin-operations',
              component: () => import('@/views/admin/OperationsAdminView.vue'),
              meta: { titleKey: 'menu.adminOperations', roles: ADMIN_ROLES },
            },
            // 应用上架/平台运维视图已删除，旧路径重定向到运营页
            { path: 'assemblies', redirect: '/admin/operations' },
            { path: 'platform', redirect: '/admin/operations' },
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
