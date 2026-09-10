/**
 * 全局搜索（B4）：跨数据服务/算法/事项三类对象。
 *
 * 契约（后端落地时实现）：
 *   GET /api/v1/search?q={keyword}
 *   → { services: SearchHit[], algorithms: SearchHit[], matters: SearchHit[] }
 * mock 直接对 seed 目录与单据种子做包含匹配；matters 支持单号前缀（apr-/req-/tsk-）。
 */
import { createSeedApprovals, createSeedRequirements, createSeedTasks } from '@/mocks/seed.volume'
import { seedAlgorithms, seedDataServices } from '@/mocks/seed'

export interface SearchHit {
  code: string
  name: string
  /** 导航路由：产品/算法直达详情，事项直达对应工作台。 */
  route: string
}

export interface GlobalSearchResult {
  services: SearchHit[]
  algorithms: SearchHit[]
  matters: SearchHit[]
}

/** 事项单据 → 工作台路由映射（req-/apr-/tsk- 前缀）。 */
export function routeOfMatter(code: string): string {
  if (code.startsWith('req-')) return '/personal/requirements'
  if (code.startsWith('tsk-')) return '/personal/tasks'
  return '/personal/approvals'
}

function matchName(name: string, q: string): boolean {
  return name.toLowerCase().includes(q.toLowerCase())
}

export const searchApi = {
  /** 全局检索：q 为空/少于 2 字符时返回空分组。 */
  globalSearch,
}

export async function globalSearch(q: string): Promise<GlobalSearchResult> {
  const query = q.trim()
  if (!query) return { services: [], algorithms: [], matters: [] }

  return {
    services: seedDataServices
      .filter((item) => matchName(`${item.name} ${item.code}`, query))
      .slice(0, 5)
      .map((item) => ({ code: item.code, name: item.name, route: `/data-workbench/${item.code}` })),
    algorithms: seedAlgorithms
      .filter((item) => matchName(`${item.name} ${item.code}`, query))
      .slice(0, 5)
      .map((item) => ({ code: item.code, name: item.name, route: `/algorithm-workbench/${item.code}` })),
    matters: [
      ...createSeedApprovals().map((item) => ({ code: String(item.code), title: String(item.title), status: String(item.status) })),
      ...createSeedRequirements().map((item) => ({ code: String(item.code), title: String(item.title), status: String(item.status) })),
      ...createSeedTasks().map((item) => ({ code: String(item.taskId), title: String(item.stage ?? item.taskId), status: String(item.status) })),
    ]
      .filter((item) => matchName(`${item.code} ${item.title}`, query))
      .slice(0, 3)
      .map((item) => ({ code: item.code, name: item.title, route: routeOfMatter(item.code) })),
  }
}
