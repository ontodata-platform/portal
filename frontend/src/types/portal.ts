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
  slaStatus?: 'NONE' | 'ON_TIME' | 'OVERDUE' | 'MET' | 'MISSED'
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
  plan?: Record<string, unknown>
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

/** 上游目录条目（数据商城/算法工作台聚合透传，字段与各软件目录响应同构）。 */
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

/** 数据商城申请请求体。 */
export interface ApplyDataServiceRequest {
  grantedColumns?: string[]
}

/** 数据商城申请响应。 */
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

/** 个人中心待办统计（personal-center，M5 接 IAM 后随认证上下文）。 */
export interface PersonalTodo {
  pendingApprovalCount: number
  myOpenRequirementCount: number
  myRequirementCount: number
  myApprovalCount: number
}

/** 场景装配绑定（scenario-center，scenario/v1 契约）：版本一律精确钉扎 x.y.z。 */
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

/** 场景（scenario-center）：scn-* 编码 + 不可变语义版本，DRAFT→PUBLISHED→DEPRECATED。 */
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
