import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { i18n } from '@/i18n'
import NotificationSection from './NotificationSection.vue'

const listMock = vi.fn()
const markReadMock = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/api/portal', () => ({
  personalApi: {
    notifications: (...args: unknown[]) => listMock(...args),
    markRead: (...args: unknown[]) => markReadMock(...args),
    markAllRead: vi.fn().mockResolvedValue({ unread: 0 }),
  },
}))

const stubs = {
  'a-card': { template: '<div><slot /></div>' },
  'a-table': { props: ['columns', 'dataSource', 'loading', 'rowKey'], template: '<div class="table"><slot /></div>' },
  'a-space': { template: '<div><slot /></div>' },
  'a-button': { props: ['type', 'size'], emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  'a-tag': { props: ['color'], template: '<span><slot /></span>' },
}

function mountView() {
  return mount(
    defineComponent({
      components: { NotificationSection },
      template: '<NotificationSection />',
    }),
    { global: { plugins: [createPinia(), i18n], stubs } },
  )
}

describe('NotificationSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listMock.mockResolvedValue({
      total: 1,
      items: [
        {
          id: 'n-1',
          type: 'APPROVAL_DECIDED',
          title: '审批已通过：超期待审',
          body: 'apr-1 APPROVED',
          resourceRef: 'apr-1',
          createdAt: '2026-08-27T00:00:00Z',
        },
      ],
    })
    markReadMock.mockResolvedValue({ id: 'n-1', readAt: '2026-08-27T01:00:00Z' })
  })

  it('挂载后加载通知列表', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(listMock).toHaveBeenCalled()
    expect(wrapper.text()).toContain('全部已读')
    expect(wrapper.text()).not.toContain('通知中心')
  })

  it('可将单条标为已读并刷新', async () => {
    const wrapper = mountView()
    await flushPromises()
    const view = wrapper.findComponent(NotificationSection)
    await (view.vm as unknown as { markRead: (id: string) => Promise<void> }).markRead('n-1')
    await flushPromises()
    expect(markReadMock).toHaveBeenCalledWith('n-1')
    expect(listMock).toHaveBeenCalledTimes(2)
  })

  it('空列表展示空态引导', async () => {
    listMock.mockResolvedValue({ total: 0, items: [] })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('暂无通知')
  })
})
