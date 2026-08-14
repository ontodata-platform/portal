import { createRouter, createWebHistory } from 'vue-router'

import MainLayout from '@/layouts/MainLayout.vue'

/**
 * 管理门户五中心页面：与后端五大中心一一对应（对齐门户设计 Task 1+2）。
 * meta.titleKey 指向 i18n 消息目录 menu.* 键——标题随界面语言切换（M5 国际化）。
 */
export default createRouter({
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
      ],
    },
  ],
})
