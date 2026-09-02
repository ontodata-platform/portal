import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/mocks/localMode', () => ({
  useLocalMock: false,
  apiMode: 'remote',
}))

vi.mock('@/api/agent', () => ({
  agentApi: {
    listDefs: vi.fn().mockRejectedValue(new Error('gateway down')),
  },
  streamSession: vi.fn(),
}))

describe('useAssistantEngine remote 降级', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.clear()
  })

  it('remote 请求失败后进入降级态', async () => {
    const { useAssistantEngine } = await import('./useAssistantEngine')
    const engine = useAssistantEngine()
    await engine.send('找数据')
    expect(engine.degraded.value).toBe(true)
  })
})
