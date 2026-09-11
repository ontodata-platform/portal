/**
 * 角色存储（用户反馈重构）：角色 = 用户角色的载体，绑定一组权限键。
 * 数据模型：用户 --绑定--> 角色 --绑定--> 权限（页面访问 + 操作）。
 * localStorage 持久；真实模式契约（对齐后端 T1-1/D5）：
 *   GET/POST/PUT/DELETE /api/v1/iam/roles
 */
import { ALL_PERMISSIONS } from '@/constants/permissions'

export interface RoleDef {
  code: string
  name: string
  description: string
  permissions: string[]
  /** 内置角色不可删除（演示种子） */
  builtin?: boolean
}

const ROLES_KEY = 'od-roles'

/** 内置角色种子：权限 = 页面访问 + 操作的组合。 */
export const DEFAULT_ROLES: RoleDef[] = [
  {
    code: 'user',
    name: '普通用户',
    description: '使用门户、浏览目录、申请数据并运行算法。',
    permissions: [
      'PORTAL.ACCESS', 'HOME.VIEW', 'ASSISTANT.USE', 'PERSONAL.VIEW', 'DATA.WORKBENCH', 'ALGORITHM.WORKBENCH',
      'DATA.APPLY', 'ALGORITHM.RUN', 'REQUIREMENT.HANDLE',
    ],
    builtin: true,
  },
  {
    code: 'data-manager',
    name: '数据管理员',
    description: '维护数据服务供给，承接数据需求并组织交付。',
    permissions: [
      'PORTAL.ACCESS', 'HOME.VIEW', 'ASSISTANT.USE', 'PERSONAL.VIEW', 'DATA.WORKBENCH',
      'DATA.MANAGE', 'DATA.DELIVER', 'REQUIREMENT.HANDLE',
    ],
    builtin: true,
  },
  {
    code: 'algorithm-operator',
    name: '算法运营人员',
    description: '维护算法服务与工作流，承接算法需求并组织运行。',
    permissions: [
      'PORTAL.ACCESS', 'HOME.VIEW', 'ASSISTANT.USE', 'PERSONAL.VIEW', 'ALGORITHM.WORKBENCH',
      'ALGORITHM.MANAGE', 'WORKFLOW.MANAGE', 'ALGORITHM.RUN',
    ],
    builtin: true,
  },
  {
    code: 'operator',
    name: '运营人员',
    description: '统筹需求、审批监管和门户内容运营。',
    permissions: [
      'PORTAL.ACCESS', 'HOME.VIEW', 'ASSISTANT.USE', 'PERSONAL.VIEW',
      'REQUIREMENT.HANDLE', 'APPROVAL.VIEW', 'NOTICE.MANAGE',
      'ADMIN.ACCESS', 'ADMIN.STATISTICS',
    ],
    builtin: true,
  },
  {
    code: 'approval-approver',
    name: '审批人员',
    description: '在授权范围内处理数据授权和高风险操作审批。',
    permissions: ['PORTAL.ACCESS', 'PERSONAL.VIEW', 'APPROVAL.DECIDE', 'APPROVAL.VIEW'],
    builtin: true,
  },
  {
    code: 'portal-admin',
    name: '门户管理员',
    description: '管理门户用户、角色、权限与全部运营事项。',
    permissions: ALL_PERMISSIONS.map((item) => item.key),
    builtin: true,
  },
]

function load(): RoleDef[] {
  try {
    const raw = localStorage.getItem(ROLES_KEY)
    if (!raw) return structuredClone(DEFAULT_ROLES)
    const parsed = JSON.parse(raw) as RoleDef[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : structuredClone(DEFAULT_ROLES)
  } catch {
    return structuredClone(DEFAULT_ROLES)
  }
}

function save(roles: RoleDef[]): void {
  try {
    localStorage.setItem(ROLES_KEY, JSON.stringify(roles))
  } catch {
    /* 仅内存态 */
  }
}

export function loadRoles(): RoleDef[] {
  return load()
}

export function persistRoles(roles: RoleDef[]): void {
  save(roles)
}

export function upsertRole(roles: RoleDef[], role: RoleDef): RoleDef[] {
  const index = roles.findIndex((item) => item.code === role.code)
  if (index >= 0) {
    const next = [...roles]
    next[index] = { ...role }
    return next
  }
  return [...roles, { ...role }]
}

/** 角色是否具备某权限：用户权限 = 其所有角色权限的并集。 */
export function rolesHavePermission(userRoles: string[], permission: string, roles: RoleDef[] = load()): boolean {
  return roles
    .filter((role) => userRoles.includes(role.code))
    .some((role) => role.permissions.includes(permission))
}
