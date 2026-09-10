/**
 * 场景编排封存，后端模块 retention-center 同批处理。
 * 前端业务代码禁止再引用本文件；仅保留真实模式契约，供后端启动时对照实现。
 */
import { client } from '../client'
import type { ListParams } from '../portal'
import type {
  PageResponse,
  PortalScenario,
  ProjectionRebuildSummary,
  RetentionCleanupResult,
  RetentionStatus,
  ScenarioBinding,
  ScenarioOntologyRef,
  ScenarioPresentation,
} from '@/types/portal'

/** 场景创建/草稿更新请求体：bindings 至少一条，版本全部精确钉扎 x.y.z。 */
export interface ScenarioUpsertBody {
  name: string
  description?: string
  projectId?: string
  ontologyRefs?: ScenarioOntologyRef[]
  bindings: ScenarioBinding[]
  presentation?: ScenarioPresentation
  createdBy?: string
}

/** 应用编排器（scenario-center）：scn-* 应用装配，全量钉扎 + 发布/下线状态机 + 不可变版本。 */
export const scenarioApi = {
  list: (params: ListParams) => client.get<PageResponse<PortalScenario>>('/scenarios', { params }).then((r) => r.data),
  find: (code: string) => client.get<PortalScenario>(`/scenarios/${code}`).then((r) => r.data),
  create: (body: ScenarioUpsertBody) => client.post<PortalScenario>('/scenarios', body).then((r) => r.data),
  update: (code: string, version: string, body: ScenarioUpsertBody) =>
    client.put<PortalScenario>(`/scenarios/${code}/versions/${version}`, body).then((r) => r.data),
  publish: (code: string, version: string) =>
    client.post<PortalScenario>(`/scenarios/${code}/versions/${version}/publish`).then((r) => r.data),
  deprecate: (code: string, version: string) =>
    client.post<PortalScenario>(`/scenarios/${code}/versions/${version}/deprecate`).then((r) => r.data),
  createDraft: (code: string) => client.post<PortalScenario>(`/scenarios/${code}/drafts`).then((r) => r.data),
}

/** 平台管理：投影重建与数据保留（原运维接口迁入 /admin/platform）。 */
export const platformApi = {
  rebuildProjections: () => client.post<ProjectionRebuildSummary>('/projections/rebuild').then((r) => r.data),
  retentionStatus: () => client.get<RetentionStatus>('/retention/status').then((r) => r.data),
  retentionCleanup: (dryRun = true) =>
    client.post<RetentionCleanupResult>('/retention/cleanup', undefined, { params: { dryRun } }).then((r) => r.data),
}
