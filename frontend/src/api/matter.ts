/**
 * 统一事项 API（C1）：跨审批/需求/任务/结果的单一单据视图。
 *
 * 契约（后端落地时实现）：
 *   GET /api/v1/matter/{kind}/{code}   kind ∈ approval | requirement | task | result
 *   → MatterDetail（含统一时间轴、处理动作）
 * mock 由 portalMockApi 的 /matter/* 路由承接（对种子单据做聚合并合成时间轴）。
 */
import { client } from './client'

import type { MatterDetail } from '@/types/portal'

export type MatterKind = 'approval' | 'requirement' | 'task' | 'result'

export const matterApi = {
  getMatter(kind: MatterKind, code: string): Promise<MatterDetail> {
    return client
      .get<MatterDetail>(`/matter/${kind}/${encodeURIComponent(code)}`)
      .then((response) => response.data)
  },
}
