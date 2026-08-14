import { createRouter, createWebHistory } from 'vue-router'

import MainLayout from '@/layouts/MainLayout.vue'

/** 管理门户五中心页面：与后端五大中心一一对应（对齐门户设计 Task 1+2）。 */
export default createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: MainLayout,
      children: [
        { path: '', redirect: '/operations' },
        { path: 'operations', component: () => import('@/views/OperationsView.vue'), meta: { title: '门户运营' } },
        { path: 'marketplace', component: () => import('@/views/MarketplaceView.vue'), meta: { title: '数据商城' } },
        { path: 'workbench', component: () => import('@/views/WorkbenchView.vue'), meta: { title: '算法工作台' } },
        { path: 'tasks', component: () => import('@/views/TasksView.vue'), meta: { title: '统一任务中心' } },
        { path: 'approvals', component: () => import('@/views/ApprovalsView.vue'), meta: { title: '审批中心' } },
        { path: 'results', component: () => import('@/views/ResultsView.vue'), meta: { title: '结果中心' } },
        { path: 'requirements', component: () => import('@/views/RequirementsView.vue'), meta: { title: '需求管理' } },
        { path: 'personal', component: () => import('@/views/PersonalCenterView.vue'), meta: { title: '个人中心' } },
      ],
    },
  ],
})
