const hour = 3600e3

export const demoIdentity = {
  name: '陈晓',
  title: '遥感分析师',
  team: '空间信息应用团队',
  tenantId: 'default',
  orgId: 'space-information',
  projectId: 'proj-remote-sensing',
  roles: ['user', 'operator'],
  devMode: true,
}

export function relativeIso(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * hour).toISOString()
}

export const seedDataServices = [
  {
    code: 'ds-gaofen-optical',
    name: '高分光学卫星影像-东海重点海域',
    version: '2.1.0',
    classification: 'INTERNAL',
    source: 'data-platform',
    subscribed: true,
  },
  {
    code: 'ds-sar-maritime',
    name: 'SAR海面目标检测辅助数据',
    version: '1.4.2',
    classification: 'CONFIDENTIAL',
    source: 'data-platform',
    subscribed: false,
  },
  {
    code: 'ds-payload-telemetry',
    name: '卫星载荷遥测-轨次增量',
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
  { id: 'find-data', icon: 'search', title: '找数据服务', example: '帮我找东海高分光学影像服务' },
  { id: 'run-algo', icon: 'experiment', title: '跑目标特性提取', example: '跑一遍港区目标特性提取' },
  { id: 'todos', icon: 'audit', title: '看今日待办', example: '我有哪些待办审批' },
  { id: 'grant', icon: 'safety', title: '申请开通', example: '申请开通SAR海面目标检测数据' },
  { id: 'predict', icon: 'line-chart', title: '做态势预测', example: '用载荷遥测趋势预测分析一下' },
  { id: 'notify', icon: 'bell', title: '查通知', example: '看看未读通知' },
]
