export type AssistantRole = 'user' | 'assistant' | 'system'

export interface AssistantCitation {
  source: string
  version?: string
}

export interface AssistantAction {
  label: string
  kind: 'navigate' | 'api'
  target: string
}

export type AssistantCard =
  | {
      type: 'data-service'
      payload: {
        code: string
        name: string
        version: string
        classification: string
        source: string
        subscribed: boolean
      }
    }
  | {
      type: 'algorithm'
      payload: {
        code: string
        name: string
        kind: 'capability' | 'template'
        version: string
        status: string
      }
    }
  | {
      type: 'task-summary'
      payload: {
        pendingApprovals: number
        runningTasks: number
        openRequirements: number
        unread: number
      }
    }
  | {
      type: 'guide'
      payload: {
        title: string
        steps: string[]
        target: string
      }
    }

export interface AssistantMessage {
  id: string
  role: AssistantRole
  streaming?: boolean
  text?: string
  cards?: AssistantCard[]
  citations?: AssistantCitation[]
  actions?: AssistantAction[]
  confirmToken?: string
  approvalCode?: string
}

export interface IntentSuggestion {
  id: string
  icon: string
  title: string
  example: string
}

export interface AssistantSession {
  id: string
  title: string
  updatedAt: number
  messages: AssistantMessage[]
}

export interface AssistantConfirmPayload {
  confirmToken: string
  tool: string
  riskLevel: string
  summary: { code: string; plan: string; impact: string }
  argumentsSummary: string
  expiresAt: string
}

export interface AssistantTurnResult {
  text: string
  cards?: AssistantCard[]
  citations?: AssistantCitation[]
  actions?: AssistantAction[]
  confirm?: AssistantConfirmPayload
  approvalCode?: string
}
