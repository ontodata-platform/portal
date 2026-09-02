const hour = 3600e3

export const demoIdentity = {
  name: '陈晓',
  title: '数据分析师',
  team: '制造业数据团队',
  tenantId: 'default',
  orgId: 'mfg-analytics',
  projectId: 'proj-quality',
  roles: ['user', 'operator'],
  devMode: true,
}

export function relativeIso(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * hour).toISOString()
}

export const seedDataServices = [
  {
    code: 'ds-customer-monthly',
    name: '客户主数据-月度快照',
    version: '2.1.0',
    classification: 'INTERNAL',
    source: 'data-platform',
    subscribed: true,
  },
  {
    code: 'ds-device-daily',
    name: '设备遥测-日增量',
    version: '1.4.2',
    classification: 'CONFIDENTIAL',
    source: 'data-platform',
    subscribed: false,
  },
  {
    code: 'ds-supplier-credit',
    name: '供应商信用-季度版',
    version: '3.0.1',
    classification: 'INTERNAL',
    source: 'data-platform',
    subscribed: false,
  },
]

export const seedAlgorithms = [
  {
    code: 'tpl-quality-weekly',
    name: '客户质量分析-周批',
    kind: 'template' as const,
    version: '1.2.0',
    status: 'admitted',
  },
  {
    code: 'cap-anomaly-detect',
    name: '设备异常检测',
    kind: 'capability' as const,
    version: '2.0.0',
    status: 'admitted',
  },
  {
    code: 'tpl-churn-train',
    name: '流失预测-训练',
    kind: 'template' as const,
    version: '0.9.0',
    status: 'draft',
  },
]

export const seedIntents = [
  { id: 'find-data', icon: 'search', title: '找数据服务', example: '帮我找客户主数据服务' },
  { id: 'run-algo', icon: 'experiment', title: '跑质量分析', example: '跑一遍客户质量分析' },
  { id: 'todos', icon: 'audit', title: '看今日待办', example: '我有哪些待办审批' },
  { id: 'grant', icon: 'safety', title: '申请开通', example: '申请开通设备遥测权限' },
  { id: 'predict', icon: 'line-chart', title: '做流失预测', example: '用流失预测模板分析一下' },
  { id: 'notify', icon: 'bell', title: '查通知', example: '看看未读通知' },
]
