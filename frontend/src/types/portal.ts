/**
 * 门户契约类型：与门户后端五大中心 API 对齐（portal 仓库 backend）。
 * 分页/错误协议与 common 模块（PageResponse/ApiErrorResponse）同构。
 */

/** 统一分页响应（对齐 common PageResponse）。 */
export interface PageResponse<T> {
  total: number
  items: T[]
}

/** 统一错误协议（对齐 common ApiErrorResponse + GlobalExceptionHandler）。 */
export interface ApiErrorBody {
  status: number
  code: string
  message: string
  path: string
  traceId?: string
  fieldErrors?: Record<string, string>
}

/** 任务投影（task-center）：权威状态在源系统，门户副本可由事件流重建。 */
export interface PortalTask {
  taskId: string
  taskType: string
  sourceSystem: string
  parentTaskId?: string
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELED'
  stage?: string
  progress: number
  resourceRefs: string[]
  resultRefs: string[]
  traceId?: string
  createdAt: string
  updatedAt: string
}

/** 审批单（approval-center）：apr-* 编码，终态防重。 */
export interface ApprovalRequest {
  code: string
  approvalType: string
  sourceSystem: string
  sourceCode?: string
  title: string
  detail?: {
    deliveryStatus?: 'PENDING' | 'SUCCEEDED' | 'FAILED'
    serviceCode?: string
    serviceId?: string
    grantedColumns?: string[]
    deliveryError?: string
    [key: string]: unknown
  }
  requester: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  decisionBy?: string
  decisionNote?: string
  decisionAt?: string
  slaDeadline?: string
  slaStatus?: 'NONE' | 'ON_TIME' | 'DUE_SOON' | 'OVERDUE' | 'MET' | 'MISSED'
  createdAt: string
  updatedAt: string
}

export interface BatchDecideResult {
  decision: string
  succeeded: ApprovalRequest[]
  failed: { code: string; message: string }[]
}

export interface PortalNotification {
  id: string
  type: 'APPROVAL_DECIDED' | 'TASK_COMPLETED' | string
  title: string
  body?: string
  resourceRef: string
  readAt?: string
  createdAt: string
}

/** 结果引用登记（result-center）：可追踪率 100%。 */
export interface PortalResult {
  resultId: string
  sourceSystem: string
  resultType: string
  resourceRefs: string[]
  metadata: Record<string, unknown>
  sourceTaskId?: string
  traceId?: string
  createdAt: string
  updatedAt: string
}

export interface DataRequirementProfile {
  businessDomain: string
  dataObject: string
  scope: string
  granularity: string
  period?: string
  frequency?: string
  fields: string[]
  useCase: string
  sensitivity: 'INTERNAL' | 'SENSITIVE'
  deliveryDeadline?: string
}

export interface RequirementAnalysis {
  conclusion: string
  feasibility: 'FEASIBLE' | 'NEEDS_CLARIFICATION' | 'NOT_FEASIBLE'
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  risks?: string
  analyzedBy?: string
  analyzedAt?: string
}

export interface RequirementPlan {
  owner: string
  deliverable: string
  targetDate: string
  milestones?: string
}

export interface RequirementProgress {
  percent: number
  note: string
  recordedBy?: string
  recordedAt?: string
}

export interface RequirementOverlapCandidate {
  code: string
  title: string
  requester: string
  status: RequirementRequest['status']
  score: number
  reasons: string[]
}

export interface RequirementConsolidation {
  primaryCode: string
  role: 'PRIMARY' | 'RELATED'
  reason: string
  consolidatedBy?: string
  consolidatedAt?: string
  relatedCodes?: string[]
}

/** 需求单（requirement-center）：req-* 编码，单向状态机。 */
export interface RequirementRequest {
  code: string
  requirementType: 'DATA' | 'ALGORITHM' | 'COMPREHENSIVE'
  title: string
  description?: string
  requester: string
  status: 'OPEN' | 'ANALYZING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED'
  assigneeSystem?: string
  assigneeRef?: string
  dataProfile?: DataRequirementProfile
  analysis?: RequirementAnalysis
  plan?: RequirementPlan
  progressEntries?: RequirementProgress[]
  consolidation?: RequirementConsolidation
  closedNote?: string
  createdAt: string
  updatedAt: string
}

/** 公告（operations-center）：ntc-* 编码，单向流转。 */
export interface Notice {
  code: string
  title: string
  content: string
  section: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

/** 统一事项详情（C1）：跨审批/需求/任务/结果的单一单据视图。 */
export interface MatterTimelineItem {
  time: string
  title: string
  state: 'done' | 'current' | 'blocked'
}

export interface MatterDetail {
  kind: 'approval' | 'requirement' | 'task' | 'result'
  code: string
  title: string
  status: string
  slaStatus?: string | null
  requester?: string | null
  detail?: Record<string, unknown> | null
  timeline: MatterTimelineItem[]
  actions: string[]
}

/** 首页跨域待办聚合（B1）：口径=审批 PENDING / 任务 RUNNING / 需求未终态 / 通知未读。 */
export interface HomeTodoAggregate {
  pendingApprovals: number
  runningTasks: number
  openRequirements: number
  unread: number
}

/** 首页推荐入口位（B1）：D4 内容运营上线后由运营配置驱动。 */
export interface HomeEntry {
  code: string
  title: string
  description: string
  route: string
  icon: 'database' | 'appstore' | 'robot' | 'file-done'
}

/** 首页公告摘要（B1）：仅取已发布公告。 */
export interface HomeNotice {
  code: string
  title: string
  content: string
  section: string
  publishedAt?: string
}

/** 首页聚合数据（B1）：GET /api/v1/content/home。 */
export interface HomeData {
  greetingName: string
  notices: HomeNotice[]
  entries: HomeEntry[]
  todo: HomeTodoAggregate
}

/** 反馈（operations-center）：fb-* 编码。 */
export interface Feedback {
  code: string
  title: string
  content: string
  contact?: string
  status: 'PENDING' | 'HANDLED'
  handleNote?: string
  handledAt?: string
  createdAt: string
  updatedAt: string
}

/** 运营统计（operations-center）。 */
export interface OperationsStatistics {
  noticeTotal: number
  publishedNotices: number
  pendingFeedbacks: number
}

/** 上游目录条目（数据工作台/算法工作台聚合透传，字段与各软件目录响应同构）。 */
export interface CatalogEntry {
  code: string
  name: string
  status: string
  currentVersion: number | string
  description?: string
  [key: string]: unknown
}

/** 上游分页目录体（列表接口）。 */
export interface CatalogPageBody {
  total?: number
  items?: CatalogEntry[]
}

/**
 * 上游聚合响应（aggregation-center）：available=false 时展示降级卡片。
 * 列表 body 为 { items, total }；详情 body 即单条 CatalogEntry（与后端门面一致）。
 */
export interface UpstreamAggregation {
  sourceSystem: string
  available: boolean
  message?: string
  body?: CatalogPageBody & Partial<CatalogEntry>
  item?: CatalogEntry
}

/** 当前主体身份（personal-center / personal/me）。 */
export interface PortalIdentity {
  name: string
  tenantId: string
  orgId?: string
  projectId?: string
  roles: string[]
  devMode: boolean
}

/** 数据工作台申请请求体。 */
import type { ApplicationUseIntent } from './application'

export interface ApplyDataServiceRequest {
  grantedColumns?: string[]
  /** 申请四要素（B3-1）：使用目的/范围/时间/交付，审批人决策依据 */
  useIntent?: ApplicationUseIntent
}

/** 数据工作台申请响应。 */
export interface MarketplaceApplyResponse {
  approvalCode: string
  status: string
}

/** 算法工作台运行请求体。 */
export interface SubmitWorkbenchRunRequest {
  templateVersion: number
  resourceRefs?: Record<string, unknown>
  ontologyRuntimeContractVersion?: string
  dataSnapshotVersion?: string
}

/** 算法工作台运行响应。 */
export interface WorkbenchRunResponse {
  taskId: string
  status: string
  started: boolean
}

/** 管理端用户视图。身份权威源仍为统一身份服务，门户只呈现和受控代理管理操作。 */
export interface IamUser {
  id: string
  name: string
  username: string
  tenantId: string
  roles: string[]
  status: 'ACTIVE' | 'DISABLED'
}

/** 角色目录（角色编码稳定，展示名称和权限范围由服务端返回）。 */
export interface IamRole {
  code: string
  description: string
  permissions: string[]
}

/** 用户与角色调整的审计记录。 */
export interface IamAuditLog {
  id: string
  action: string
  targetId: string
  targetName: string
  detail: string
  operator: string
  createdAt: string
}

/** ABAC 策略只读条目。 */
export interface AbacPolicy {
  id: string
  name: string
  resource: string
  action: string
  effect: 'PERMIT' | 'DENY'
  roles: string[]
}

/** 审批催办结果。 */
export interface ApprovalNudgeResult {
  ok: boolean
  code: string
}

/** 个人中心待办统计（personal-center，M5 接 IAM 后随认证上下文）。 */
export interface PersonalTodo {
  pendingApprovalCount: number
  myOpenRequirementCount: number
  myRequirementCount: number
  myApprovalCount: number
}

/** 应用装配绑定（scenario-center，scenario/v1 契约）：版本一律精确钉扎 x.y.z。 */
export interface ScenarioBinding {
  type: 'DATA_SNAPSHOT' | 'CAPABILITY' | 'WORKFLOW_TEMPLATE'
  ref: string
  version: string
  alias?: string
  sourceSystem: 'DATA_PLATFORM' | 'ALGORITHM_TRANSFORM' | 'ALGORITHM_RECOMBINE'
}

/** 本体发布包引用：packageCode 为 pkg-*，version 精确钉扎。 */
export interface ScenarioOntologyRef {
  packageCode: string
  version: string
}

/** 展示配置（可选）：widget 的 bindingAlias 必须指向 bindings[].alias。 */
export interface ScenarioPresentation {
  entryView?: string
  widgets?: { kind: 'TABLE' | 'CHART' | 'METRIC' | 'REPORT_LINK'; bindingAlias: string; config?: Record<string, unknown> }[]
}

/** 投影重建结果（task-center POST /projections/rebuild）。 */
export interface ProjectionRebuildSummary {
  consumerGroup: string
  polled: number
  applied: number
  duplicate: number
  stale: number
  unknown: number
  tasks: number
  elapsedMillis: number
}

/** 数据保留状态（GET /retention/status）。 */
export interface RetentionStatus {
  retentionDays: number
  cutoffAt: string
  tasks: number
  approvals: number
  requirements: number
  feedbacks: number
  notices: number
}

/** 数据保留清理结果（POST /retention/cleanup）。 */
export interface RetentionCleanupResult {
  dryRun: boolean
  tasks: number
  approvals: number
  requirements: number
  feedbacks: number
  notices: number
}

/** 应用装配（scenario-center）：scn-* 编码 + 不可变语义版本，DRAFT→PUBLISHED→DEPRECATED。 */
export interface PortalScenario {
  code: string
  version: string
  name: string
  description?: string
  projectId?: string
  status: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED'
  ontologyRefs?: ScenarioOntologyRef[]
  bindings: ScenarioBinding[]
  presentation?: ScenarioPresentation
  tenantId: string
  createdBy?: string
  createdAt: string
  updatedAt: string
}
