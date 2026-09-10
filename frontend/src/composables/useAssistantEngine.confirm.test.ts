import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'

const confirmMock = vi.fn()

vi.mock('@/mocks/localMode', () => ({
  useLocalMock: true,
  apiMode: 'mock',
}))

vi.mock('@/api/agent', () => ({
  agentApi: {
    confirm: (...args: unknown[]) => confirmMock(...args),
  },
  streamSession: vi.fn(),
}))

describe('useAssistantEngine 确认卡收口', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    window.localStorage.clear()
    vi.clearAllMocks()
    i18n.global.locale.value = 'zh-CN'
  })

  it('停止生成时若仍有待确认，按拒绝走 confirm', async () => {
    confirmMock.mockResolvedValue({ status: 'rejected', tool: 'recombine.submit_workflow' })
    const { useAssistantEngine } = await import('./useAssistantEngine')
    const engine = useAssistantEngine()
    await engine.send('提交质量分析跑一遍')
    expect(engine.pendingConfirm.value).toBeTruthy()

    engine.stop()
    await vi.waitFor(() => {
      expect(confirmMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ decision: 'reject' }))
    })
    expect(engine.messages.value.some((item) => item.text?.includes('已取消该操作'))).toBe(true)
  })
})
