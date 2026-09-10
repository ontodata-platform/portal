/**
 * 门户 REST API（对齐 portal 后端 task-center/approval-center/result-center/
 * requirement-center/operations-center）。
 */
import { client } from './client'
import { localDataWorkbenchMockApi } from '@/mocks/dataWorkbenchMockApi'
import { useLocalMock } from '@/mocks/localMode'
import { mockResultFile } from '@/utils/download'

import type {
  ApplyDataServiceRequest,
  AbacPolicy,
  ApprovalNudgeResult,
  ApprovalRequest,
  BatchDecideResult,
  DataRequirementProfile,
  Feedback,
  IamAuditLog,
  IamRole,
  IamUser,
  MarketplaceApplyResponse,
  Notice,
  OperationsStatistics,
  PageResponse,
  PersonalTodo,
  PortalIdentity,
  PortalNotification,
  PortalResult,
  PortalScenario,
  PortalTask,
  ProjectionRebuildSummary,
  RetentionCleanupResult,
  RetentionStatus,
  RequirementRequest,
  RequirementAnalysis,
  RequirementOverlapCandidate,
  RequirementPlan,
  RequirementProgress,
  ScenarioBinding,
  ScenarioOntologyRef,
  ScenarioPresentation,
  SubmitWorkbenchRunRequest,
  UpstreamAggregation,
  WorkbenchRunResponse,
} from '@/types/portal'

export interface ListParams {
  page: number
  size: number
  keyword?: string
  status?: string
  type?: string
  domain?: string
  sla?: string
  role?: string
}

/** 统一任务中心：聚合副本（PUT 幂等 upsert，权威归产生它的软件）。 */
export const taskApi = {
  list: (params: ListParams) => client.get<PageResponse<PortalTask>>('/tasks', { params }).then((r) => r.data),
  find: (taskId: string) => client.get<PortalTask>(`/tasks/${taskId}`).then((r) => r.data),
}

/** 审批中心：apr-* 审批单，终态防重。 */
export const approvalApi = {
  list: (params: ListParams) => client.get<PageResponse<ApprovalRequest>>('/approvals', { params }).then((r) => r.data),
  find: (code: string) => client.get<ApprovalRequest>(`/approvals/${code}`).then((r) => r.data),
  create: (body: {
    approvalType: string
    sourceSystem: string
    sourceCode?: string
    title: string
    detail?: Record<string, unknown>
    requester?: string
    slaDeadline?: string
  }) => client.post<ApprovalRequest>('/approvals', body).then((r) => r.data),
  decide: (
    code: string,
    body: { decision: 'APPROVED' | 'REJECTED'; decisionBy?: string; decisionNote?: string },
  ) => client.post<ApprovalRequest>(`/approvals/${code}/decision`, body).then((r) => r.data),
  batchDecide: (body: {
    codes: string[]
    decision: 'APPROVED' | 'REJECTED'
    decisionNote?: string
  }) => client.post<BatchDecideResult>('/approvals/batch-decision', body).then((r) => r.data),
  nudge: (code: string) =>
    client.post<ApprovalNudgeResult>(`/admin/approvals/${code}/nudge`).then((r) => r.data),
}

/** 结果中心：结果引用登记（来源系统与结果标识在路径上，可追踪率 100%）。 */
export const resultApi = {
  list: (params: ListParams) => client.get<PageResponse<PortalResult>>('/results', { params }).then((r) => r.data),
  find: (sourceSystem: string, resultId: string) =>
    client.get<PortalResult>(`/results/${sourceSystem}/${resultId}`).then((r) => r.data),
  register: (
    sourceSystem: string,
    resultId: string,
    body: { resultType: string; resourceRefs?: string[]; metadata?: Record<string, unknown>; sourceTaskId?: string },
  ) => client.put<PortalResult>(`/results/${sourceSystem}/${resultId}`, body).then((r) => r.data),
}

/** 需求管理：req-* 需求单，单向状态机 + 同标题去重。 */
export const requirementApi = {
  list: (params: ListParams) => client.get<PageResponse<RequirementRequest>>('/requirements', { params }).then((r) => r.data),
  find: (code: string) => client.get<RequirementRequest>(`/requirements/${code}`).then((r) => r.data),
  create: (body: {
    requirementType: 'DATA' | 'ALGORITHM' | 'COMPREHENSIVE'
    title: string
    description?: string
    requester?: string
    dataProfile?: DataRequirementProfile
  }) => client.post<RequirementRequest>('/requirements', body).then((r) => r.data),
  analyze: (code: string, body?: { analysis: RequirementAnalysis }) =>
    client.post<RequirementRequest>(`/requirements/${code}/analyze`, body).then((r) => r.data),
  overlapCandidates: (code: string) =>
    client.get<RequirementOverlapCandidate[]>(`/requirements/${code}/overlap-candidates`).then((r) => r.data),
  consolidate: (code: string, body: { primaryCode: string; reason: string }) =>
    client.post<RequirementRequest>(`/requirements/${code}/consolidate`, body).then((r) => r.data),
  assign: (code: string, body: { assigneeSystem: string; assigneeRef?: string; plan: RequirementPlan }) =>
    client.post<RequirementRequest>(`/requirements/${code}/assign`, body).then((r) => r.data),
  progress: (code: string, body?: RequirementProgress) =>
    client.post<RequirementRequest>(`/requirements/${code}/progress`, body).then((r) => r.data),
  complete: (code: string, body: { closedNote: string }) =>
    client.post<RequirementRequest>(`/requirements/${code}/complete`, body).then((r) => r.data),
  cancel: (code: string, body: { closedNote?: string }) =>
    client.post<RequirementRequest>(`/requirements/${code}/cancel`, body).then((r) => r.data),
}

/** 门户运营：公告（ntc-* 单向流转）、反馈（fb-*）、运营统计。 */
export const operationsApi = {
  notices: (params: Partial<ListParams>) => client.get<PageResponse<Notice>>('/operations/notices', { params }).then((r) => r.data),
  createNotice: (body: { title: string; content: string; section: string }) =>
    client.post<Notice>('/operations/notices', body).then((r) => r.data),
  publishNotice: (code: string) => client.post<Notice>(`/operations/notices/${code}/publish`).then((r) => r.data),
  archiveNotice: (code: string) => client.post<Notice>(`/operations/notices/${code}/archive`).then((r) => r.data),
  feedbacks: (params: Partial<ListParams>) => client.get<PageResponse<Feedback>>('/operations/feedbacks', { params }).then((r) => r.data),
  createFeedback: (body: { title: string; content: string; contact?: string }) =>
    client.post<Feedback>('/operations/feedbacks', body).then((r) => r.data),
  handleFeedback: (code: string, body: { handleNote: string }) =>
    client.post<Feedback>(`/operations/feedbacks/${code}/handle`, body).then((r) => r.data),
  statistics: () => client.get<OperationsStatistics>('/operations/statistics').then((r) => r.data),
}

/** 数据工作台：经管理平台正式 REST 契约聚合数据目录与使用申请（API 路径仍为 /marketplace/*）。 */
export const marketplaceApi = {
  dataServices: (params: ListParams) =>
    client.get<UpstreamAggregation>('/marketplace/data-services', { params }).then((r) => r.data),
  find: (code: string) =>
    client.get<UpstreamAggregation>(`/marketplace/data-services/${code}`).then((r) => r.data),
  apply: (code: string, body?: ApplyDataServiceRequest) =>
    client.post<MarketplaceApplyResponse>(`/marketplace/data-services/${code}/apply`, body).then((r) => r.data),
  retryDelivery: (approvalCode: string) =>
    client.post<ApprovalRequest>(`/marketplace/applications/${approvalCode}/retry-delivery`).then((r) => r.data),

  /**
   * 订阅交付下载。真实模式：GET /api/v1/results/{sourceSystem}/{resultId}/download
   * （对齐后端 T0-1：受控下载，302 签名链接或流式二选一，由后端定）。
   */
  downloadDeliverable: (code: string): Promise<{ filename: string; mime: string; blob: Blob }> =>
    useLocalMock
      ? localDataWorkbenchMockApi.request('GET', `/subscriptions/${encodeURIComponent(code)}/download`).then((payload) => {
          const data = payload as { filename: string; mime: string; title: string; rows: Record<string, unknown>[] }
          return { filename: data.filename, mime: data.mime, blob: mockResultFile(data.title, data.rows) }
        })
      : client.get(`/results/data-platform/${encodeURIComponent(code)}/download`, { responseType: 'blob' }).then((response) => ({
          filename: `${code}.csv`,
          mime: String(response.headers['content-type'] ?? 'text/csv;charset=utf-8'),
          blob: response.data as Blob,
        })),
}

/** 算法工作台：能力目录（算法转换工具）与工作流模板（算法重组平台）聚合及运行。 */
export const workbenchApi = {
  capabilities: (params: ListParams) =>
    client.get<UpstreamAggregation>('/workbench/capabilities', { params }).then((r) => r.data),
  capability: (code: string) =>
    client.get<UpstreamAggregation>(`/workbench/capabilities/${code}`).then((r) => r.data),
  workflowTemplates: (params: ListParams) =>
    client.get<UpstreamAggregation>('/workbench/workflow-templates', { params }).then((r) => r.data),
  template: (code: string) =>
    client.get<UpstreamAggregation>(`/workbench/workflow-templates/${code}`).then((r) => r.data),
  run: (code: string, body: SubmitWorkbenchRunRequest) =>
    client.post<WorkbenchRunResponse>(`/workbench/workflow-templates/${code}/runs`, body).then((r) => r.data),
}

/** 应用编排器（scenario-center）：scn-* 应用装配，全量钉扎 + 发布/下线状态机 + 不可变版本。不等于本体 executionScenarios。 */
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

/** 个人中心：身份/我的需求/我的申请/待办统计（M5 身份取认证上下文）。 */
export const personalApi = {
  me: () => client.get<PortalIdentity>('/personal/me').then((r) => r.data),
  requirements: (params: Partial<ListParams> = {}) =>
    client.get<PageResponse<RequirementRequest>>('/personal/requirements', { params }).then((r) => r.data),
  approvals: (params: Partial<ListParams> = {}) =>
    client.get<PageResponse<ApprovalRequest>>('/personal/approvals', { params }).then((r) => r.data),
  todos: () => client.get<PersonalTodo>('/personal/todos').then((r) => r.data),
  notifications: (params: Partial<ListParams> = {}) =>
    client.get<PageResponse<PortalNotification>>('/personal/notifications', { params }).then((r) => r.data),
  unreadCount: () => client.get<{ unread: number }>('/personal/notifications/unread-count').then((r) => r.data),
  markRead: (id: string) =>
    client.post<PortalNotification>(`/personal/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => client.post<{ unread: number }>('/personal/notifications/read-all').then((r) => r.data),
}

/**
 * 管理端 IAM 聚合。身份仍由统一身份服务权威管理；门户后端在真实联调时
 * 负责代理用户状态与角色调整，并返回审计记录，前端不直连身份服务。
 */
export const adminIamApi = {
  users: (params: Partial<ListParams> = {}) =>
    client.get<PageResponse<IamUser>>('/admin/iam/users', { params }).then((r) => r.data),
  roles: () => client.get<{ items: IamRole[] }>('/admin/iam/roles').then((r) => r.data),
  updateUserRoles: (userId: string, body: { roles: string[] }) =>
    client.put<IamUser>(`/admin/iam/users/${userId}/roles`, body).then((r) => r.data),
  updateUserStatus: (userId: string, status: IamUser['status']) =>
    client.put<IamUser>(`/admin/iam/users/${userId}/status`, { status }).then((r) => r.data),
  auditLogs: () => client.get<{ items: IamAuditLog[] }>('/admin/iam/audit-logs').then((r) => r.data),
  policies: () => client.get<{ items: AbacPolicy[] }>('/admin/abac-policies').then((r) => r.data),
}

/** 平台管理：投影重建与数据保留（原运维接口迁入 /admin/platform）。 */
export const platformApi = {
  rebuildProjections: () => client.post<ProjectionRebuildSummary>('/projections/rebuild').then((r) => r.data),
  retentionStatus: () => client.get<RetentionStatus>('/retention/status').then((r) => r.data),
  retentionCleanup: (dryRun = true) =>
    client.post<RetentionCleanupResult>('/retention/cleanup', undefined, { params: { dryRun } }).then((r) => r.data),
}
