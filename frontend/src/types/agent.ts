/**
 * agent-runtime（智能体运行时，端口 18086）M2 接口类型：会话 REST + SSE 事件载荷。
 * 字段与后端 AgentOut/SessionOut/MessageOut 及 SSE data JSON 一一对应（camelCase）。
 */

/** 已发布智能体定义（GET /agent/defs）。 */
export interface AgentDef {
  id: string
  tenantId: string
  name: string
  description: string
  owner: string
  createdAt: string
}

/** 智能体版本（生命周期：draft → published → deprecated，发布即不可变）。 */
export interface AgentVersion {
  agentId: string
  version: number
  riskLevel: string
  status: string
  createdAt: string
}

export interface AgentDetail extends AgentDef {
  versions: AgentVersion[]
}

/** 会话（终身锁定一个已发布 AgentVersion）。 */
export interface AgentSession {
  id: string
  tenantId: string
  userId: string
  agentId: string
  agentVersion: number
  state: string
  createdAt: string
}

export type AgentMessageRole = 'user' | 'assistant' | 'tool' | 'system'

export interface AgentMessage {
  id: string
  role: AgentMessageRole
  content: string
  classification: string
  turnNo: number
  createdAt: string
}

/** SSE confirm_required 事件载荷（R2/R3 确认卡）。 */
export interface ConfirmRequiredEvent {
  confirmToken: string
  tool: string
  riskLevel: string
  summary: { code?: string; plan?: string; impact?: string }
  argumentsSummary: string
  expiresAt: string
}

/** SSE confirm_resolved 事件载荷（确认/拒绝后广播）。 */
export interface ConfirmResolvedEvent {
  confirmToken: string
  decision: string
  tool: string
}

/** SSE done 事件载荷（轮次结束）。 */
export interface StreamDoneEvent {
  sessionId: string
  turnNo: number
  answer: string
  status: 'completed' | 'awaiting_confirmation'
  classification: string
  messageId?: string
}

/** POST /agent/sessions/{id}/confirm 响应。 */
export interface ConfirmResult {
  status: 'executed' | 'rejected'
  tool: string
  result?: Record<string, unknown>
}

/** GET /agent/catalog/search 命中（F3a-1，与 agent-runtime catalog 契约对齐）。 */
export type CatalogSearchKind = 'data_asset' | 'capability' | 'workflow'

export interface CatalogSearchHit {
  kind: CatalogSearchKind
  id: string
  title: string
  snippet: string
  classification: string
  source: 'data-platform' | 'transform' | 'recombine'
}

export interface CatalogSearchResponse {
  hits: CatalogSearchHit[]
}
