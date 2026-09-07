import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { useMessageStore } from '@/stores/message'

describe('useMessageStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('success 记录成功反馈', () => {
    const store = useMessageStore()
    store.success('需求登记成功')
    expect(store.feedback).toEqual({ kind: 'success', content: '需求登记成功' })
  })

  it('reportError 记录错误与 traceId 对账提示', () => {
    const store = useMessageStore()
    store.reportError(new ApiError(409, 'STATE_CONFLICT', '终态防重', '/x', 'trace-9'))
    expect(store.feedback?.kind).toBe('error')
    expect(store.feedback?.content).toBe('终态防重')
    expect(store.feedback?.traceId).toBe('trace-9')
  })

  it('reportError 对非 ApiError 做归一化', () => {
    const store = useMessageStore()
    store.reportError({ code: 'ECONNABORTED' })
    expect(store.feedback?.content).toContain('超时')
  })

  it('clear 清除反馈', () => {
    const store = useMessageStore()
    store.success('x')
    store.clear()
    expect(store.feedback).toBeNull()
  })

  it('反馈在 4.5 秒后自动消失，避免跨页面滞留', () => {
    vi.useFakeTimers()
    const store = useMessageStore()
    store.warning('请补充必填项')
    vi.advanceTimersByTime(4_500)
    expect(store.feedback).toBeNull()
    vi.useRealTimers()
  })
})
