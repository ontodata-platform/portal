import { describe, expect, it } from 'vitest'

import { createLocalAgentMockApi } from './agentMockApi'

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

    expect(tokens.join('')).toContain('本地模拟回复')
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }))
    controller.abort()
    await stream
  })
})
