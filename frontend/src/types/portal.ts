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

/** 任务聚合副本（task-center）：权威归产生它的软件。 */
export interface PortalTask {
  taskId: string
  taskType: string
  ownerSystem: string
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
  detail?: Record<string, unknown>
  requester: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  decisionBy?: string
  decisionNote?: string
  decisionAt?: string
  createdAt: string
  updatedAt: string
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
}

/** 上游聚合响应（aggregation-center）：available=false 时展示降级卡片。 */
export interface UpstreamAggregation {
  sourceSystem: string
  available: boolean
  message?: string
  body?: { total: number; items: CatalogEntry[] }
}
