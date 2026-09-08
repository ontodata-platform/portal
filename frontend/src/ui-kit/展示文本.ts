/**
 * 将接口枚举转换为面向用户的中文文案。
 *
 * 接口值、查询参数和路由中的稳定编码保持不变；仅在视图渲染时调用本函数，
 * 避免把英文枚举直接暴露给用户，也不影响后续真实后端联调。
 */
const 中文枚举: Record<string, string> = {
  ACTIVE: '启用',
  ADMITTED: '已准入',
  ALGORITHM: '算法需求',
  ALGORITHM_RECOMBINE: '算法重组平台',
  ALGORITHM_TRANSFORM: '算法转换工具',
  ACCESS: '访问',
  APPROVED: '已通过',
  ARCHIVED: '已归档',
  AWAITING_APPROVAL: '等待审批',
  AWAITING_CONFIRMATION: '等待确认',
  BUSINESS_DATA: '业务数据',
  CANCELED: '已取消',
  CANCELLED: '已取消',
  CAPABILITY: '算法能力',
  COMPLETED: '已完成',
  COMPREHENSIVE: '综合需求',
  CREATED: '已创建',
  DECIDE: '决策',
  DATA_ASSET: '数据资产',
  DATA_GRANT: '数据授权',
  DATA_IMPORT: '数据导入',
  DATA_PLATFORM: '数据管理平台',
  DATA: '数据需求',
  DATASET: '结构化数据集',
  DELIVERED: '已交付',
  DEPRECATED: '已下线',
  DISABLED: '已停用',
  DRAFT: '草稿',
  EVIDENCE: '证据材料',
  EXITED: '已退出',
  EXPIRING: '即将到期',
  FAILED: '失败',
  HANDLED: '已处理',
  INTERNAL: '内部',
  IN_PROGRESS: '进行中',
  MCP_GATEWAY: '智能体工具调用网关',
  ONTOLOGY_PLATFORM: '本体平台',
  OFFLINE: '已下线',
  ONLINE: '已上架',
  OPEN: '待分析',
  PENDING: '待处理',
  PERMIT: '允许',
  PORTAL: '服务门户',
  PORTAL_ADMIN: '门户管理员',
  PORTAL_OPERATOR: '门户运营人员',
  PUBLISHED: '已发布',
  QUALITY_REPORT: '质量报告',
  R4_TOOL_CALL: '高风险工具调用',
  RECOMBINE: '算法重组平台',
  REJECTED: '已拒绝',
  REPORT: '分析报告',
  RUNNING: '运行中',
  SNAPSHOT: '数据快照',
  SUBMITTED: '已提交',
  SUCCEEDED: '成功',
  SUCCESS: '成功',
  SYSTEM_PERMISSION: '系统权限',
  TEMPLATE: '工作流模板',
  WORKFLOW: '工作流',
  WORKFLOW_EXECUTION: '工作流执行',
  WORKFLOW_TEMPLATE: '工作流模板',
  USER: '普通用户',
  OPERATOR: '运营人员',
  'DATA.UPDATE_DATASET': '更新数据集',
  'RECOMBINE.SUBMIT_WORKFLOW': '提交工作流',
  'WORKFLOW.SUBMIT_EXECUTION': '提交工作流执行',
  EXECUTION_OUTPUT: '执行产出物',
}

/** 返回枚举的中文展示文本；未知值仍按原样返回，以免掩盖后端新增值。 */
export function 中文展示(value?: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  const 文本 = String(value).trim()
  const 标准值 = 文本.toUpperCase().replaceAll('-', '_')
  if (中文枚举[标准值]) return 中文枚举[标准值]
  return 文本.replace(/\b[A-Z][A-Z_]+\b/g, (枚举) => 中文枚举[枚举] ?? 枚举)
}
