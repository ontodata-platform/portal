import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { i18n } from '@/i18n'
import AssistantView from './AssistantView.vue'

const routeQuery = ref<Record<string, string>>({})
const pushMock = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routeQuery.value }),
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/mocks/localMode', () => ({
  useLocalMock: true,
  apiMode: 'mock',
}))

const stubs = {
  'a-button': { props: ['type', 'size', 'loading'], emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  'a-alert': { props: ['type', 'message'], template: '<div class="alert">{{ message }}<slot name="action" /></div>' },
  'a-card': { props: ['title', 'size'], template: '<div class="card"><slot /></div>' },
  'a-tag': { template: '<span><slot /></span>' },
  'a-space': { template: '<div><slot /></div>' },
  'a-list': { props: ['dataSource'], template: '<div />' },
  'a-list-item': { template: '<div />' },
  'a-row': { template: '<div><slot /></div>' },
  'a-col': { template: '<div><slot /></div>' },
  AgentConfirmCard: { template: '<div class="confirm-card" />' },
}

function mountView() {
  return mount(AssistantView, { global: { plugins: [createPinia(), i18n], stubs } })
}

describe('AssistantView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    routeQuery.value = {}
  })

  it('落地态渲染建议卡', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('随时问我吧')
    expect(wrapper.text()).toContain('找数据服务')
    expect(wrapper.text()).toContain('跑目标特性提取')
  })

  it('发送消息后出现数据服务卡片', async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('textarea.hero-input').setValue('帮我找数据服务')
    await wrapper.find('button.send-btn').trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('高分光学卫星影像-东海重点海域')
    })
  })

  it('?q= 自动作为首条消息发送', async () => {
    routeQuery.value = { q: '我有哪些待办审批' }
    const wrapper = mountView()
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('事项汇总')
    })
  })
})
