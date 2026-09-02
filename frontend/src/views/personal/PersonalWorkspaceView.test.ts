import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { i18n } from '@/i18n'
import PersonalWorkspaceView from './PersonalWorkspaceView.vue'

const pushMock = vi.fn()
const routePath = ref('/personal')
const routeName = ref('personal-overview')

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: routePath.value, name: routeName.value }),
  useRouter: () => ({ push: pushMock }),
}))

const todosMock = vi.fn()
const unreadMock = vi.fn()
const taskListMock = vi.fn()
const resultListMock = vi.fn()
const meMock = vi.fn()

vi.mock('@/api/portal', () => ({
  personalApi: {
    me: (...args: unknown[]) => meMock(...args),
    todos: (...args: unknown[]) => todosMock(...args),
    unreadCount: (...args: unknown[]) => unreadMock(...args),
  },
  taskApi: {
    list: (...args: unknown[]) => taskListMock(...args),
  },
  resultApi: {
    list: (...args: unknown[]) => resultListMock(...args),
  },
}))

const stubs = {
  RouterView: { template: '<div class="child-view" />' },
  'a-tabs': {
    props: ['activeKey'],
    emits: ['change'],
    template:
      '<div class="tabs" :data-active="activeKey"><button class="goto-tasks" @click="$emit(\'change\', \'/personal/tasks\')">go-tasks</button><slot /></div>',
  },
  'a-tab-pane': { props: ['tab'], template: '<div class="tab">{{ tab }}</div>' },
}

function mountView() {
  return mount(PersonalWorkspaceView, {
    global: { plugins: [createPinia(), i18n], stubs },
  })
}

describe('PersonalWorkspaceView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routePath.value = '/personal'
    routeName.value = 'personal-overview'
    meMock.mockResolvedValue({
      name: '陈晓',
      tenantId: 'default',
      projectId: 'demo-project',
      roles: ['user'],
      devMode: true,
    })
    todosMock.mockResolvedValue({
      pendingApprovalCount: 2,
      myOpenRequirementCount: 1,
      myRequirementCount: 3,
      myApprovalCount: 4,
    })
    unreadMock.mockResolvedValue({ unread: 5 })
    taskListMock.mockResolvedValue({ total: 7, items: [] })
    resultListMock.mockResolvedValue({ total: 8, items: [] })
  })

  it('摘要条数字来自待办/进行中任务/结果/未读', async () => {
    const wrapper = mountView()
    await flushPromises()

    const bar = wrapper.find('[data-testid="personal-summary"]')
    expect(bar.text()).toContain('2')
    expect(bar.text()).toContain('7')
    expect(bar.text()).toContain('8')
    expect(bar.text()).toContain('5')
    expect(wrapper.text()).toContain('陈晓')
  })

  it('签页由路由驱动，点击任务签页 push 子路由', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('.tabs').attributes('data-active')).toBe('/personal')
    expect(wrapper.text()).toContain('概览')
    expect(wrapper.text()).toContain('任务')
    expect(wrapper.text()).toContain('审批')
    expect(wrapper.text()).toContain('需求')
    expect(wrapper.text()).toContain('结果')
    expect(wrapper.text()).toContain('通知')

    await wrapper.find('.goto-tasks').trigger('click')
    expect(pushMock).toHaveBeenCalledWith('/personal/tasks')
  })
})
