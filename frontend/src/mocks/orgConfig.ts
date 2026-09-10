/**
 * 组织管理（D5-2）：统一组织树（演示种子 + localStorage 编辑）。
 * 真实模式契约（对齐后端 T1-1）：GET/POST/PUT/DELETE /api/v1/iam/orgs
 */
export interface OrgNode {
  code: string
  name: string
  children?: OrgNode[]
}

const ORG_KEY = 'od-org-tree'

export const DEFAULT_ORG_TREE: OrgNode[] = [
  {
    code: 'org-dh-demo',
    name: '东海示范区',
    children: [
      { code: 'org-data', name: '数据管理部', children: [{ code: 'org-data-1', name: '数据治理岗' }, { code: 'org-data-2', name: '数据分析岗' }] },
      { code: 'org-algo', name: '算法运营部', children: [{ code: 'org-algo-1', name: '算法工程岗' }] },
      { code: 'org-portal', name: '门户运营部', children: [{ code: 'org-portal-1', name: '内容运营岗' }, { code: 'org-portal-2', name: '审批运营岗' }] },
    ],
  },
]

export function loadOrgTree(): OrgNode[] {
  try {
    const raw = localStorage.getItem(ORG_KEY)
    if (!raw) return structuredClone(DEFAULT_ORG_TREE)
    const parsed = JSON.parse(raw) as OrgNode[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : structuredClone(DEFAULT_ORG_TREE)
  } catch {
    return structuredClone(DEFAULT_ORG_TREE)
  }
}

export function saveOrgTree(tree: OrgNode[]): void {
  try {
    localStorage.setItem(ORG_KEY, JSON.stringify(tree))
  } catch {
    /* 仅内存态 */
  }
}
