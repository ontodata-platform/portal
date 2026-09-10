/**
 * 门户权限矩阵（D5-3）：角色 × 门户资源（菜单/页面/关键操作）。
 * localStorage 持久；路由守卫消费本矩阵判定可达性（devMode 直接放行）。
 * 真实模式契约（对齐后端 T1-1）：GET/PUT /api/v1/iam/portal-permissions
 */
export interface PermissionMatrixEntry {
  role: string
  resources: string[]
}

export const PORTAL_RESOURCES = [
  { key: 'PORTAL.ACCESS', label: '门户访问' },
  { key: 'HOME.VIEW', label: '首页' },
  { key: 'ASSISTANT.USE', label: '智能服务' },
  { key: 'PERSONAL.VIEW', label: '个人工作台' },
  { key: 'DATA.WORKBENCH', label: '数据工作台' },
  { key: 'ALGORITHM.WORKBENCH', label: '算法工作台' },
  { key: 'ADMIN.ACCESS', label: '管理端' },
  { key: 'ADMIN.STATISTICS', label: '统计看板' },
] as const

const MATRIX_KEY = 'od-permission-matrix'

const DEFAULT_MATRIX: PermissionMatrixEntry[] = [
  { role: 'user', resources: ['PORTAL.ACCESS', 'HOME.VIEW', 'ASSISTANT.USE', 'PERSONAL.VIEW', 'DATA.WORKBENCH', 'ALGORITHM.WORKBENCH'] },
  { role: 'operator', resources: ['PORTAL.ACCESS', 'HOME.VIEW', 'ASSISTANT.USE', 'PERSONAL.VIEW', 'DATA.WORKBENCH', 'ALGORITHM.WORKBENCH', 'ADMIN.ACCESS', 'ADMIN.STATISTICS'] },
  { role: 'portal-admin', resources: PORTAL_RESOURCES.map((item) => item.key) },
]

export function loadPermissionMatrix(): PermissionMatrixEntry[] {
  try {
    const raw = localStorage.getItem(MATRIX_KEY)
    if (!raw) return structuredClone(DEFAULT_MATRIX)
    const parsed = JSON.parse(raw) as PermissionMatrixEntry[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : structuredClone(DEFAULT_MATRIX)
  } catch {
    return structuredClone(DEFAULT_MATRIX)
  }
}

export function savePermissionMatrix(matrix: PermissionMatrixEntry[]): void {
  try {
    localStorage.setItem(MATRIX_KEY, JSON.stringify(matrix))
  } catch {
    /* 仅内存态 */
  }
}

/** 角色是否具备某资源（任一角色具备即通过）。 */
export function rolesHaveResource(roles: string[], resource: string, matrix: PermissionMatrixEntry[] = loadPermissionMatrix()): boolean {
  return matrix.some((entry) => roles.includes(entry.role) && entry.resources.includes(resource))
}
