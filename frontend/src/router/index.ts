import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'

import { iamEnabled } from '@/auth/oidc'
import { ensureAccessToken } from '@/auth/session'
import MainLayout from '@/layouts/MainLayout.vue'

/**
 * 登录门守卫（WP-07 身份闭环）：IAM 关闭（开发模式）直通；IAM 启用时无有效会话
 * （无令牌或已过期且无法续期）一律重定向登录页，并以 redirect 查询参数记录目标路由，
 * 登录成功后由回调页回跳。登录页/授权回调页自身除外（避免重定向环）。
 * 临期会话在这里顺带完成续期（ensureAccessToken 内部去重并发续期）。
 */
export async function authGuard(to: RouteLocationNormalized): Promise<true | { path: string; query: Record<string, string> }> {
  if (!iamEnabled()) {
    return true
  }
  if (to.path === '/login' || to.path === '/auth/callback') {
    return true
  }
  const token = await ensureAccessToken()
  if (token) {
    return true
  }
  return { path: '/login', query: { redirect: to.fullPath } }
}

/**
 * 管理门户五中心页面：与后端五大中心一一对应（对齐门户设计 Task 1+2）。
 * meta.titleKey 指向 i18n 消息目录 menu.* 键——标题随界面语言切换（M5 国际化）。
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
        { path: '', redirect: '/operations' },
        { path: 'operations', component: () => import('@/views/OperationsView.vue'), meta: { titleKey: 'menu.operations' } },
        { path: 'marketplace', component: () => import('@/views/MarketplaceView.vue'), meta: { titleKey: 'menu.marketplace' } },
        { path: 'workbench', component: () => import('@/views/WorkbenchView.vue'), meta: { titleKey: 'menu.workbench' } },
        { path: 'tasks', component: () => import('@/views/TasksView.vue'), meta: { titleKey: 'menu.tasks' } },
        { path: 'approvals', component: () => import('@/views/ApprovalsView.vue'), meta: { titleKey: 'menu.approvals' } },
        { path: 'results', component: () => import('@/views/ResultsView.vue'), meta: { titleKey: 'menu.results' } },
        { path: 'requirements', component: () => import('@/views/RequirementsView.vue'), meta: { titleKey: 'menu.requirements' } },
        { path: 'personal', component: () => import('@/views/PersonalCenterView.vue'), meta: { titleKey: 'menu.personal' } },
        { path: 'agent/chat', component: () => import('@/views/AgentChatView.vue'), meta: { titleKey: 'menu.agentChat' } },
      ],
    },
  ],
})

router.beforeEach(authGuard)

export default router
