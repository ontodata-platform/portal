import type {
  AssistantAction,
  AssistantCard,
  AssistantCitation,
  AssistantConfirmPayload,
} from '@/types/assistant'
import type { SeedAlgorithm, SeedDataService } from '@/types/seed'

/** 模板应答：在 AssistantTurnResult 之上增加快捷追问（引擎转成 navigate actions）。 */
export interface AssistantReply {
  text: string
  cards?: AssistantCard[]
  citations?: AssistantCitation[]
  actions?: AssistantAction[]
  confirm?: AssistantConfirmPayload
  approvalCode?: string
  quickReplies?: string[]
}

export interface AssistantMatterRef {
  code: string
  title: string
  status: string
  kind: 'approval' | 'requirement' | 'task'
}

export interface AssistantSearchHit {
  code: string
  name: string
  kind: 'service' | 'algorithm'
}

/** 模板渲染上下文：应答在渲染时从 seed 现查现组，不写死推荐数据。 */
export interface TemplateContext {
  question: string
  sessionId: string
  /** 上一轮命中的实体，支持"第一个怎么申请"式追问 */
  lastHits: AssistantSearchHit[]
  searchServices(q: string): SeedDataService[]
  searchAlgorithms(q: string): SeedAlgorithm[]
  todoSummary(): { pendingApprovals: number; runningTasks: number; openRequirements: number; unread: number }
  pendingApprovals(): Array<{ code: string; title: string; slaStatus: string }>
  unreadNotifications(): Array<{ id: string; title: string; body: string }>
  /** 单号直查：apr-/req-/tsk- 前缀的单据定位 */
  lookupMatter(code: string): AssistantMatterRef | null
}

export interface AssistantTemplate {
  id: string
  match: { keywords: string[]; patterns?: RegExp[] }
  /** 命中示例：供演示剧本与 e2e 断言使用 */
  samples: string[]
  compose: (ctx: TemplateContext) => AssistantReply
}
