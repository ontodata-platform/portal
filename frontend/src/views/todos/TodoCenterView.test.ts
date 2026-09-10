import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import TodoCenterView from './TodoCenterView.vue'

const pushMock = vi.fn()
const aggregateMock = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/api/portal', () => ({
  personalApi: {
    aggregateTodos: (...args: unknown[]) => aggregateMock(...args),
    notifications: vi.fn().mockResolvedValue({ total: 0, items: [] }),
    unreadCount: vi.fn().mockResolvedValue({ unread: 0 }),
  },
}))

vi.mock('@/views/personal/sections/NotificationSection.vue', () => ({
  default: { template: '<div class="notification-section-stub">通知组件</div>' },
}))

const todosFixture = {
  items: [
    { kind: 'APPROVAL', code: 'apr-0201', title: '海表温度场订阅申请', deadline: null, slaStatus: 'ON_TIME', route: '/matter/approval/apr-0201' },
    { kind: 'ANOMALY', code: 'tsk-run-004', title: '任务异常：预检未通过', deadline: null, slaStatus: null, route: '/matter/task/tsk-run-004' },
  ],
}

const stubs = {
  'a-tabs': { template: '<div><slot /></div>' },
  'a-tab-pane': { props: ['tab'], template: '<div><slot /></div>' },
  'a-card': { template: '<div><slot /></div>' },
  'a-tag': { props: ['color'], template: '<span><slot /></span>' },
  'a-button': { props: ['size', 'type', 'ghost'], emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
}

function mountView() {
  return mount(TodoCenterView, {
    global: { plugins: [createPinia(), i18n], stubs },
  })
}

describe('TodoCenterView（C2 待办中心）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    aggregateMock.mockResolvedValue(todosFixture)
  })

  it('聚合审批待办与异常任务并提供办理入口', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(aggregateMock).toHaveBeenCalled()
    expect(wrapper.text()).toContain('海表温度场订阅申请')
    expect(wrapper.text()).toContain('审批待办')
    expect(wrapper.text()).toContain('异常任务')

    const handle = wrapper.findAll('button').find((button) => button.text().includes('去办理'))
    await handle!.trigger('click')
    expect(pushMock).toHaveBeenCalledWith('/matter/approval/apr-0201')
  })

  it('无待办时展示空状态引导', async () => {
    aggregateMock.mockResolvedValue({ items: [] })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('暂无待办')
  })
})
