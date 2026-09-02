import type {
  AgentDef,
  AgentDetail,
  AgentMessage,
  AgentRun,
  AgentRunAccepted,
  AgentSession,
  CatalogSearchResponse,
  ConfirmRequiredEvent,
  ConfirmResult,
  InterruptedEvent,
} from '@/types/agent'

export interface LocalAgentStreamHandlers {
  onToken?: (text: string) => void
  onNode?: (node: string, status: string) => void
  onConfirmRequired?: (payload: ConfirmRequiredEvent) => void
  onConfirmResolved?: (payload: { confirmToken: string; decision: string; tool: string }) => void
  onInterrupted?: (payload: InterruptedEvent) => void
  onDone?: (payload: {
    sessionId: string
    turnNo: number
    answer: string
    status: 'completed' | 'awaiting_confirmation' | 'succeeded' | 'failed' | 'cancelled'
    classification: string
    messageId?: string
    runId?: string
  }) => void
}

const timestamp = '2026-08-31T09:30:00.000Z'
export const SAMPLE_R4_APPROVAL = 'apr-r4-sample'

const retrievalDef: AgentDetail = {
  id: 'agent-platform-assistant',
  tenantId: 'default',
  name: '平台助手',
  description: '只读检索演示。输入「更新」可打出 R2/R3 确认卡。',
  owner: 'platform-team',
  createdAt: timestamp,
  versions: [{ agentId: 'agent-platform-assistant', version: 1, riskLevel: 'R1', status: 'published', createdAt: timestamp }],
}

const qualityDef: AgentDetail = {
  id: 'agent-quality-assistant',
  tenantId: 'default',
  name: '质量分析助手',
  description: '3B 确认流样板：提问 → 提交工作流 → R4 审批 → 结果。',
  owner: 'platform-team',
  createdAt: timestamp,
  versions: [{ agentId: 'agent-quality-assistant', version: 1, riskLevel: 'R4', status: 'published', createdAt: timestamp }],
}

const definitions: Record<string, AgentDetail> = {
  [retrievalDef.id]: retrievalDef,
  [qualityDef.id]: qualityDef,
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function asDef(detail: AgentDetail): AgentDef {
  const { versions: _versions, ...rest } = detail
  return rest
}

export function createLocalAgentMockApi() {
  const sessions = new Map<string, AgentSession>()
  const messages = new Map<string, AgentMessage[]>()
  const listeners = new Map<string, Set<LocalAgentStreamHandlers>>()
  const runs = new Map<string, AgentRun>()
  const pendingConfirms = new Map<string, { sessionId: string; tool: string }>()
  let sequence = 1

  function requireSession(sessionId: string): AgentSession {
    const session = sessions.get(sessionId)
    if (!session) throw new Error('本地模拟会话不存在')
    return session
  }

  function handlersOf(sessionId: string): LocalAgentStreamHandlers[] {
    return [...(listeners.get(sessionId) ?? [])]
  }

  function nextTurn(sessionId: string): number {
    const history = messages.get(sessionId) ?? []
    return Math.max(0, ...history.map((item) => item.turnNo)) + 1
  }

  function pushMessage(sessionId: string, role: AgentMessage['role'], content: string, turnNo: number): AgentMessage {
    const history = messages.get(sessionId) ?? []
    const message: AgentMessage = {
      id: `msg-${sequence++}`,
      role,
      content,
      classification: 'INTERNAL',
      turnNo,
      createdAt: timestamp,
    }
    history.push(message)
    messages.set(sessionId, history)
    return message
  }

  async function emitRetrievalReply(sessionId: string, content: string) {
    const turnNo = nextTurn(sessionId)
    const wantsConfirm = /更新|确认|写入/.test(content)
    const sessionHandlers = handlersOf(sessionId)
    if (wantsConfirm) {
      const payload: ConfirmRequiredEvent = {
        confirmToken: `cft-mock-${sequence++}`,
        tool: 'data.update_dataset',
        riskLevel: 'R3',
        summary: { code: 'dset-demo', plan: '更新演示数据集', impact: '覆盖写，需确认' },
        argumentsSummary: '{"code":"dset-demo"}',
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      }
      pendingConfirms.set(payload.confirmToken, { sessionId, tool: payload.tool })
      sessionHandlers.forEach((handler) => handler.onConfirmRequired?.(payload))
      sessionHandlers.forEach((handler) =>
        handler.onDone?.({ sessionId, turnNo, answer: '', status: 'awaiting_confirmation', classification: 'INTERNAL' }),
      )
      return
    }
    const answer = `已收到“${content}”。门户将保留资源定位与审批边界，可继续提问或去办理。`
    sessionHandlers.forEach((handler) => handler.onNode?.('portal-assistant', 'RUNNING'))
    for (const chunk of [answer.slice(0, 16), answer.slice(16, 38), answer.slice(38)]) {
      sessionHandlers.forEach((handler) => handler.onToken?.(chunk))
    }
    const message = pushMessage(sessionId, 'assistant', answer, turnNo)
    sessionHandlers.forEach((handler) => {
      handler.onNode?.('portal-assistant', 'SUCCESS')
      handler.onDone?.({ sessionId, turnNo, answer, status: 'completed', classification: 'INTERNAL', messageId: message.id })
    })
  }

  async function emitQualityInterrupt(sessionId: string, question: string) {
    const turnNo = nextTurn(sessionId)
    const runId = `run-${sequence++}`
    runs.set(runId, {
      id: runId,
      sessionId,
      graphName: 'quality',
      status: 'interrupted',
      waitKind: 'approval',
      waitRef: SAMPLE_R4_APPROVAL,
    })
    const audit = JSON.stringify({
      audit: 'approval',
      kind: 'approval',
      approvalCode: SAMPLE_R4_APPROVAL,
      tool: 'workflow.submit_execution',
      riskLevel: 'R4',
      status: 'awaiting_approval',
      question,
    })
    pushMessage(sessionId, 'system', audit, turnNo)
    const payload: InterruptedEvent = {
      runId,
      sessionId,
      status: 'awaiting_approval',
      kind: 'approval',
      ref: SAMPLE_R4_APPROVAL,
      tool: 'workflow.submit_execution',
      riskLevel: 'R4',
    }
    handlersOf(sessionId).forEach((handler) => {
      handler.onNode?.('submit', 'finished')
      handler.onInterrupted?.(payload)
    })
    return { runId, threadId: runId, status: 'interrupted' } satisfies AgentRunAccepted
  }

  return {
    listDefs: async (): Promise<AgentDef[]> => [copy(asDef(retrievalDef)), copy(asDef(qualityDef))],
    findDef: async (agentId: string): Promise<AgentDetail> => {
      const detail = definitions[agentId]
      if (!detail) throw new Error('本地模拟智能体不存在')
      return copy(detail)
    },
    createSession: async (body: { agentId: string; agentVersion: number }): Promise<AgentSession> => {
      const detail = definitions[body.agentId]
      if (!detail || body.agentVersion !== 1) throw new Error('本地模拟智能体版本不可用')
      const session: AgentSession = {
        id: `session-${sequence++}`,
        tenantId: 'default',
        userId: 'local-user',
        agentId: body.agentId,
        agentVersion: body.agentVersion,
        state: 'ACTIVE',
        createdAt: timestamp,
      }
      sessions.set(session.id, session)
      messages.set(session.id, [])
      return copy(session)
    },
    findSession: async (sessionId: string): Promise<AgentSession> => copy(requireSession(sessionId)),
    listMessages: async (sessionId: string): Promise<AgentMessage[]> => copy(messages.get(requireSession(sessionId).id) ?? []),
    postMessage: async (sessionId: string, content: string) => {
      requireSession(sessionId)
      const turnNo = nextTurn(sessionId)
      pushMessage(sessionId, 'user', content, turnNo)
      void emitRetrievalReply(sessionId, content)
      return { sessionId, turnNo, status: 'accepted' }
    },
    createRun: async (sessionId: string, body: { graph?: string; input: { question: string } }): Promise<AgentRunAccepted> => {
      requireSession(sessionId)
      const question = body.input.question
      const turnNo = nextTurn(sessionId)
      pushMessage(sessionId, 'user', question, turnNo)
      return emitQualityInterrupt(sessionId, question)
    },
    getRun: async (runId: string): Promise<AgentRun> => {
      const run = runs.get(runId)
      if (!run) throw new Error('本地模拟 run 不存在')
      return copy(run)
    },
    resumeAfterApproval: async (sessionId: string, approvalCode: string) => {
      requireSession(sessionId)
      const turnNo = nextTurn(sessionId)
      const answer = `质量分析工作流已受理（本地样板）。审批单 ${approvalCode} 已通过，执行编码 exe-sample-1。`
      const message = pushMessage(sessionId, 'assistant', answer, turnNo)
      const run = [...runs.values()].find((item) => item.sessionId === sessionId && item.waitRef === approvalCode)
      if (run) {
        run.status = 'succeeded'
        run.waitKind = null
        run.waitRef = null
      }
      handlersOf(sessionId).forEach((handler) =>
        handler.onDone?.({
          sessionId,
          turnNo,
          answer,
          status: 'succeeded',
          classification: 'INTERNAL',
          messageId: message.id,
          runId: run?.id,
        }),
      )
    },
    confirm: async (sessionId: string, body: { confirmToken: string; decision: 'approve' | 'reject' }): Promise<ConfirmResult> => {
      const pending = pendingConfirms.get(body.confirmToken)
      if (pending && pending.sessionId !== sessionId) throw new Error('确认票据仅可由发起会话的本人使用')
      pendingConfirms.delete(body.confirmToken)
      const tool = pending?.tool ?? 'local.mock.tool'
      const turnNo = nextTurn(sessionId)
      const audit = JSON.stringify({
        audit: 'confirm',
        decision: body.decision === 'approve' ? 'approved' : 'rejected',
        tool,
        operator: 'local-user',
        elapsedMs: 120,
      })
      pushMessage(sessionId, 'system', audit, turnNo)
      if (body.decision === 'approve') {
        pushMessage(sessionId, 'tool', JSON.stringify({ status: 'executed', tool }), turnNo)
      }
      handlersOf(sessionId).forEach((handler) =>
        handler.onConfirmResolved?.({ confirmToken: body.confirmToken, decision: body.decision, tool }),
      )
      return { status: body.decision === 'approve' ? 'executed' : 'rejected', tool, result: { confirmToken: body.confirmToken } }
    },
    catalogSearch: async (params: { q: string }): Promise<CatalogSearchResponse> => ({
      hits: params.q.trim()
        ? [{ kind: 'workflow', id: 'tpl-quality-weekly', title: '客户质量分析-周批', snippet: '目录命中质量分析流程。', classification: 'INTERNAL', source: 'recombine' }]
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
