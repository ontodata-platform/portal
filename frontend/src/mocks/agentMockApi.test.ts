import { describe, expect, it, vi } from 'vitest'

import { SAMPLE_R4_APPROVAL, createLocalAgentMockApi } from './agentMockApi'

describe('local agent mock', () => {
  it('streams a stateful reply without connecting to agent-runtime', async () => {
    const api = createLocalAgentMockApi()
    const session = await api.createSession({ agentId: 'agent-platform-assistant', agentVersion: 1 })
    const controller = new AbortController()
    const tokens: string[] = []
    const done = vi.fn()
    const stream = api.stream(session.id, { onToken: (token) => tokens.push(token), onDone: done }, controller.signal)

    await api.postMessage(session.id, '查看任务状态')
    await Promise.resolve()

    expect(tokens.join('')).toContain('门户将保留资源定位与审批边界')
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }))
    controller.abort()
    await stream
  })

  it('keyword 更新打出 R2/R3 确认卡，confirm 后落审计', async () => {
    const api = createLocalAgentMockApi()
    const session = await api.createSession({ agentId: 'agent-platform-assistant', agentVersion: 1 })
    const controller = new AbortController()
    const cards: unknown[] = []
    const stream = api.stream(
      session.id,
      { onConfirmRequired: (payload) => cards.push(payload) },
      controller.signal,
    )

    await api.postMessage(session.id, '更新影像快照')
    await Promise.resolve()
    expect(cards).toHaveLength(1)
    const token = (cards[0] as { confirmToken: string }).confirmToken
    await api.confirm(session.id, { confirmToken: token, decision: 'approve' })
    const history = await api.listMessages(session.id)
    expect(history.some((item) => item.role === 'system' && item.content.includes('"audit":"confirm"'))).toBe(true)
    controller.abort()
    await stream
  })

  it('质量助手 run 打出 R4 审批中断，resume 后给出结果', async () => {
    const api = createLocalAgentMockApi()
    const defs = await api.listDefs()
    expect(defs.map((item) => item.id)).toContain('agent-quality-assistant')
    const session = await api.createSession({ agentId: 'agent-quality-assistant', agentVersion: 1 })
    const controller = new AbortController()
    const interrupts: unknown[] = []
    const dones: unknown[] = []
    const stream = api.stream(
      session.id,
      { onInterrupted: (payload) => interrupts.push(payload), onDone: (payload) => dones.push(payload) },
      controller.signal,
    )

    const run = await api.createRun(session.id, { graph: 'quality', input: { question: '分析高分光学影像' } })
    expect(run.status).toBe('interrupted')
    expect(interrupts).toEqual([
      expect.objectContaining({ kind: 'approval', ref: SAMPLE_R4_APPROVAL, tool: 'workflow.submit_execution' }),
    ])

    await api.resumeAfterApproval(session.id, SAMPLE_R4_APPROVAL)
    expect(dones).toEqual([expect.objectContaining({ status: 'succeeded', answer: expect.stringContaining(SAMPLE_R4_APPROVAL) })])
    controller.abort()
    await stream
  })
})
