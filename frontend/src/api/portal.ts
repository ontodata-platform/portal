/**
 * 门户五中心 REST API（对齐 portal 后端 task-center/approval-center/result-center/
 * requirement-center/operations-center）。
 */
import { client } from './client'

import type {
  ApprovalRequest,
  Feedback,
  Notice,
  OperationsStatistics,
  PageResponse,
  PortalResult,
  PortalTask,
  RequirementRequest,
  UpstreamAggregation,
} from '@/types/portal'

export interface ListParams {
  page: number
  size: number
  keyword?: string
  status?: string
  type?: string
  domain?: string
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
  create: (body: { approvalType: string; sourceSystem: string; sourceCode?: string; title: string; detail?: Record<string, unknown>; requester: string }) =>
    client.post<ApprovalRequest>('/approvals', body).then((r) => r.data),
  decide: (code: string, body: { decision: 'APPROVED' | 'REJECTED'; decisionBy: string; decisionNote?: string }) =>
    client.post<ApprovalRequest>(`/approvals/${code}/decision`, body).then((r) => r.data),
}

/** 结果中心：结果引用登记（来源系统与结果标识在路径上，可追踪率 100%）。 */
export const resultApi = {
  list: (params: ListParams) => client.get<PageResponse<PortalResult>>('/results', { params }).then((r) => r.data),
  find: (sourceSystem: string, resultId: string) => client.get<PortalResult>(`/results/${sourceSystem}/${resultId}`).then((r) => r.data),
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
  create: (body: { requirementType: 'DATA' | 'ALGORITHM' | 'COMPREHENSIVE'; title: string; description?: string; requester: string }) =>
    client.post<RequirementRequest>('/requirements', body).then((r) => r.data),
  analyze: (code: string) => client.post<RequirementRequest>(`/requirements/${code}/analyze`).then((r) => r.data),
  assign: (code: string, body: { assigneeSystem: string; assigneeRef?: string; plan?: Record<string, unknown> }) =>
    client.post<RequirementRequest>(`/requirements/${code}/assign`, body).then((r) => r.data),
  progress: (code: string) => client.post<RequirementRequest>(`/requirements/${code}/progress`).then((r) => r.data),
  complete: (code: string, body: { closedNote: string }) =>
    client.post<RequirementRequest>(`/requirements/${code}/complete`, body).then((r) => r.data),
  cancel: (code: string, body: { closedNote?: string }) =>
    client.post<RequirementRequest>(`/requirements/${code}/cancel`, body).then((r) => r.data),
}

/** 门户运营：公告（ntc-* 单向流转）、反馈（fb-*）、运营统计。 */
export const operationsApi = {
  notices: (params: ListParams) => client.get<PageResponse<Notice>>('/operations/notices', { params }).then((r) => r.data),
  createNotice: (body: { title: string; content: string; section: string }) =>
    client.post<Notice>('/operations/notices', body).then((r) => r.data),
  publishNotice: (code: string) => client.post<Notice>(`/operations/notices/${code}/publish`).then((r) => r.data),
  archiveNotice: (code: string) => client.post<Notice>(`/operations/notices/${code}/archive`).then((r) => r.data),
  feedbacks: (params: ListParams) => client.get<PageResponse<Feedback>>('/operations/feedbacks', { params }).then((r) => r.data),
  createFeedback: (body: { title: string; content: string; contact?: string }) =>
    client.post<Feedback>('/operations/feedbacks', body).then((r) => r.data),
  handleFeedback: (code: string, body: { handleNote: string }) =>
    client.post<Feedback>(`/operations/feedbacks/${code}/handle`, body).then((r) => r.data),
  statistics: () => client.get<OperationsStatistics>('/operations/statistics').then((r) => r.data),
}

/** 数据商城：经管理平台正式 REST 契约聚合数据服务目录（降级展示契约）。 */
export const marketplaceApi = {
  dataServices: (params: ListParams) =>
    client.get<UpstreamAggregation>('/marketplace/data-services', { params }).then((r) => r.data),
}

/** 算法工作台：能力目录（算法转换工具）与工作流模板（算法重组平台）聚合。 */
export const workbenchApi = {
  capabilities: (params: ListParams) =>
    client.get<UpstreamAggregation>('/workbench/capabilities', { params }).then((r) => r.data),
  workflowTemplates: (params: ListParams) =>
    client.get<UpstreamAggregation>('/workbench/workflow-templates', { params }).then((r) => r.data),
}
