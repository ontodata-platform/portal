import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { i18n } from '@/i18n'
import type { ConfirmRequiredEvent } from '@/types/agent'
import AgentConfirmCard from './AgentConfirmCard.vue'

const confirmMock = vi.fn()

vi.mock('@/api/agent', () => ({
  agentApi: {
    confirm: (...args: unknown[]) => confirmMock(...args),
  },
}))

/** Ant Design Vue 组件在测试中需要全局 stub，避免依赖完整样式与挂载动画。 */
const stubs = {
  'a-card': { template: '<div><slot /></div>' },
  'a-tag': { props: ['color'], template: '<span><slot /></span>' },
  'a-descriptions': { props: ['column', 'size', 'bordered'], template: '<div><slot /></div>' },
  'a-descriptions-item': { props: ['label'], template: '<div><slot /></div>' },
  // emits 必须声明：未声明 click 时父级 @click 会作为原生监听回落到根元素，与 $emit 双触发
  'a-button': {
    props: ['type', 'danger', 'loading', 'disabled'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  'a-alert': {
    props: ['type', 'message', 'description', 'showIcon'],
    template: '<div class="alert">{{ message }}{{ description }}</div>',
  },
}

function makePayload(expiresAt = new Date(Date.now() + 300_000).toISOString()): ConfirmRequiredEvent {
  return {
    confirmToken: 'ct-1',
    tool: 'data.update_dataset',
    riskLevel: 'R3',
    summary: { code: 'ds-1', plan: '更新数据集', impact: '覆盖写目标表' },
    argumentsSummary: '{"id":"ds-1"}',
    expiresAt,
  }
}

function mountCard(payload = makePayload()) {
  return mount(AgentConfirmCard, {
    props: { sessionId: 's-1', payload },
    global: { plugins: [i18n], stubs },
  })
}

describe('AgentConfirmCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('展示工具名/风险级/计划/影响/参数摘要与倒计时', () => {
    const wrapper = mountCard()

    expect(wrapper.text()).toContain('data.update_dataset')
    expect(wrapper.text()).toContain('R3')
    expect(wrapper.text()).toContain('更新数据集')
    expect(wrapper.text()).toContain('覆盖写目标表')
    expect(wrapper.text()).toContain('{"id":"ds-1"}')
    expect(wrapper.text()).toContain('剩余')
    wrapper.unmount()
  })

  it('确认执行：POST confirm approve，卡片置为已执行并发出 resolved', async () => {
    confirmMock.mockResolvedValue({ status: 'executed', tool: 'data.update_dataset', result: { ok: true } })
    const wrapper = mountCard()

    const approve = wrapper.findAll('button').find((button) => button.text().includes('确认执行'))!
    await approve.trigger('click')
    await flushPromises()

    expect(confirmMock).toHaveBeenCalledWith('s-1', { confirmToken: 'ct-1', decision: 'approve' })
    expect(wrapper.text()).toContain('已确认执行')
    expect(wrapper.emitted('resolved')).toEqual([[{ decision: 'executed', tool: 'data.update_dataset' }]])
    wrapper.unmount()
  })

  it('拒绝：POST confirm reject，卡片置为已拒绝', async () => {
    confirmMock.mockResolvedValue({ status: 'rejected', tool: 'data.update_dataset' })
    const wrapper = mountCard()

    const reject = wrapper.findAll('button').find((button) => button.text() === '拒绝')!
    await reject.trigger('click')
    await flushPromises()

    expect(confirmMock).toHaveBeenCalledWith('s-1', { confirmToken: 'ct-1', decision: 'reject' })
    expect(wrapper.text()).toContain('已拒绝')
    wrapper.unmount()
  })

  it('409 重放：展示"已处理"提示且按钮区消失（不可重复提交）', async () => {
    confirmMock.mockRejectedValue(new ApiError(409, 'CONFLICT', '票据已使用'))
    const wrapper = mountCard()

    const approve = wrapper.findAll('button').find((button) => button.text().includes('确认执行'))!
    await approve.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('该确认已被处理，请勿重复操作')
    expect(wrapper.findAll('button')).toHaveLength(0)
    wrapper.unmount()
  })

  it('410 过期：展示过期提示', async () => {
    confirmMock.mockRejectedValue(new ApiError(410, 'EXPIRED', '票据已过期'))
    const wrapper = mountCard()

    const approve = wrapper.findAll('button').find((button) => button.text().includes('确认执行'))!
    await approve.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('确认票据已过期')
    wrapper.unmount()
  })

  it('倒计时归零（expiresAt 已过）：本地置为过期态，不再允许提交', async () => {
    vi.useFakeTimers()
    const wrapper = mountCard(makePayload(new Date(Date.now() - 1000).toISOString()))

    await vi.advanceTimersByTimeAsync(1100)

    expect(wrapper.text()).toContain('确认票据已过期')
    expect(confirmMock).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('其他错误：展示失败与后端原文', async () => {
    confirmMock.mockRejectedValue(new ApiError(500, 'INTERNAL', '网关调用失败'))
    const wrapper = mountCard()

    const approve = wrapper.findAll('button').find((button) => button.text().includes('确认执行'))!
    await approve.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('确认提交失败')
    expect(wrapper.text()).toContain('网关调用失败')
    wrapper.unmount()
  })
})
