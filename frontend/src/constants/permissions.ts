/**
 * 权限字典（用户反馈重构）：权限分两类——页面访问权限（决定菜单/页面是否可见可达）
 * 与操作权限（决定按钮/动作是否可执行）。角色绑定权限，用户绑定角色。
 * 本文件是权限键的唯一来源；角色存储见 mocks/roleConfig.ts。
 */

export interface PermissionDef {
  key: string
  label: string
  kind: 'access' | 'operation'
}

/** 页面访问权限：控制导航与路由可达性。 */
export const ACCESS_PERMISSIONS: PermissionDef[] = [
  { key: 'PORTAL.ACCESS', label: '门户访问', kind: 'access' },
  { key: 'HOME.VIEW', label: '首页', kind: 'access' },
  { key: 'ASSISTANT.USE', label: '智能服务', kind: 'access' },
  { key: 'PERSONAL.VIEW', label: '个人工作台', kind: 'access' },
  { key: 'DATA.WORKBENCH', label: '数据工作台', kind: 'access' },
  { key: 'ALGORITHM.WORKBENCH', label: '算法工作台', kind: 'access' },
  { key: 'ADMIN.ACCESS', label: '管理端', kind: 'access' },
  { key: 'ADMIN.STATISTICS', label: '统计看板', kind: 'access' },
]

/** 操作权限：控制具体动作（申请/交付/审批/管理等）。 */
export const OPERATION_PERMISSIONS: PermissionDef[] = [
  { key: 'DATA.APPLY', label: '申请数据', kind: 'operation' },
  { key: 'DATA.MANAGE', label: '数据供给管理', kind: 'operation' },
  { key: 'DATA.DELIVER', label: '数据交付', kind: 'operation' },
  { key: 'ALGORITHM.RUN', label: '运行算法', kind: 'operation' },
  { key: 'ALGORITHM.MANAGE', label: '算法管理', kind: 'operation' },
  { key: 'WORKFLOW.MANAGE', label: '工作流管理', kind: 'operation' },
  { key: 'REQUIREMENT.HANDLE', label: '需求办理', kind: 'operation' },
  { key: 'APPROVAL.DECIDE', label: '审批决定', kind: 'operation' },
  { key: 'APPROVAL.VIEW', label: '审批查看', kind: 'operation' },
  { key: 'NOTICE.MANAGE', label: '公告管理', kind: 'operation' },
  { key: 'IAM.MANAGE', label: '用户与权限管理', kind: 'operation' },
]

export const ALL_PERMISSIONS: PermissionDef[] = [...ACCESS_PERMISSIONS, ...OPERATION_PERMISSIONS]

export function permissionLabel(key: string): string {
  return ALL_PERMISSIONS.find((item) => item.key === key)?.label ?? key
}
