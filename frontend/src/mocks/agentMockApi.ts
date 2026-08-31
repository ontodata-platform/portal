import type {
  AgentDef,
  AgentDetail,
  AgentMessage,
  AgentSession,
  CatalogSearchResponse,
  ConfirmResult,
} from '@/types/agent'

export interface LocalAgentStreamHandlers {
  onToken?: (text: string) => void
  onNode?: (node: string, status: string) => void
  onDone?: (payload: { sessionId: string; turnNo: number; answer: string; status: 'completed'; classification: string; messageId?: string }) => void
}

const timestamp = '2026-08-31T09:30:00.000Z'

const definition: AgentDetail = {
  id: 'agent-platform-assistant', tenantId: 'default', name: '平台助手（本地模拟）', description: '用于演示门户内的智能体会话流程。', owner: 'platform-team', createdAt: timestamp,
  versions: [{ agentId: 'agent-platform-assistant', version: 1, riskLevel: 'R1', status: 'published', createdAt: timestamp }],
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function createLocalAgentMockApi() {
  const sessions = new Map<string, AgentSession>()
  const messages = new Map<string, AgentMessage[]>()
  const listeners = new Map<string, Set<LocalAgentStreamHandlers>>()
  let sequence = 1

  function requireSession(sessionId: string): AgentSession {
    const session = sessions.get(sessionId)
    if (!session) throw new Error('本地模拟会话不存在')
    return session
  }

  async function emitReply(sessionId: string, content: string) {
    const history = messages.get(sessionId) ?? []
    const turnNo = Math.max(1, ...history.map((item) => item.turnNo)) + 1
    const answer = `已收到“${content}”。这是本地模拟回复：门户将保留资源定位与审批边界，真实环境恢复后再进行联调。`
    const handlers = [...(listeners.get(sessionId) ?? [])]
    handlers.forEach((handler) => handler.onNode?.('portal-assistant', 'RUNNING'))
    for (const chunk of [answer.slice(0, 16), answer.slice(16, 38), answer.slice(38)]) {
      handlers.forEach((handler) => handler.onToken?.(chunk))
    }
    const message: AgentMessage = { id: `msg-${sequence++}`, role: 'assistant', content: answer, classification: 'INTERNAL', turnNo, createdAt: timestamp }
    history.push(message)
    messages.set(sessionId, history)
    handlers.forEach((handler) => {
      handler.onNode?.('portal-assistant', 'SUCCESS')
      handler.onDone?.({ sessionId, turnNo, answer, status: 'completed', classification: 'INTERNAL', messageId: message.id })
    })
  }

  return {
    listDefs: async (): Promise<AgentDef[]> => [copy({ ...definition, versions: undefined } as AgentDef)],
    findDef: async (agentId: string): Promise<AgentDetail> => {
      if (agentId !== definition.id) throw new Error('本地模拟智能体不存在')
      return copy(definition)
    },
    createSession: async (body: { agentId: string; agentVersion: number }): Promise<AgentSession> => {
      if (body.agentId !== definition.id || body.agentVersion !== 1) throw new Error('本地模拟智能体版本不可用')
      const session: AgentSession = { id: `session-${sequence++}`, tenantId: 'default', userId: 'local-user', agentId: body.agentId, agentVersion: body.agentVersion, state: 'ACTIVE', createdAt: timestamp }
      sessions.set(session.id, session)
      messages.set(session.id, [])
      return copy(session)
    },
    findSession: async (sessionId: string): Promise<AgentSession> => copy(requireSession(sessionId)),
    listMessages: async (sessionId: string): Promise<AgentMessage[]> => copy(messages.get(requireSession(sessionId).id) ?? []),
    postMessage: async (sessionId: string, content: string) => {
      requireSession(sessionId)
      const history = messages.get(sessionId) ?? []
      const turnNo = Math.max(0, ...history.map((item) => item.turnNo)) + 1
      history.push({ id: `msg-${sequence++}`, role: 'user', content, classification: 'INTERNAL', turnNo, createdAt: timestamp })
      messages.set(sessionId, history)
      void emitReply(sessionId, content)
      return { sessionId, turnNo, status: 'accepted' }
    },
    confirm: async (_sessionId: string, body: { confirmToken: string; decision: 'approve' | 'reject' }): Promise<ConfirmResult> => ({
      status: body.decision === 'approve' ? 'executed' : 'rejected', tool: 'local.mock.tool', result: { confirmToken: body.confirmToken },
    }),
    catalogSearch: async (params: { q: string }): Promise<CatalogSearchResponse> => ({
      hits: params.q.trim()
        ? [{ kind: 'workflow', id: 'tpl-risk-flow', title: '供应链风险研判流程', snippet: '本地模拟目录命中。', classification: 'INTERNAL', source: 'recombine' }]
        : [],
    }),
    stream: async (sessionId: string, handlers: LocalAgentStreamHandlers, signal: AbortSignal): Promise<void> => {
      requireSession(sessionId)
      return new Promise((resolve) => {
        const sessionListeners = listeners.get(sessionId) ?? new Set<LocalAgentStreamHandlers>()
        sessionListeners.add(handlers)
        listeners.set(sessionId, sessionListeners)
        const stop = () => {
          sessionListeners.delete(handlers)
          if (sessionListeners.size === 0) listeners.delete(sessionId)
          resolve()
        }
        if (signal.aborted) stop()
        else signal.addEventListener('abort', stop, { once: true })
      })
    },
  }
}

export const localAgentMockApi = createLocalAgentMockApi()
