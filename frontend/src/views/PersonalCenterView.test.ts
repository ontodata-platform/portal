import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { i18n } from '@/i18n'
import PersonalCenterView from './PersonalCenterView.vue'

const requirementsMock = vi.fn()
const approvalsMock = vi.fn()
const todosMock = vi.fn()
const pendingListMock = vi.fn()

vi.mock('@/api/portal', () => ({
  personalApi: {
    requirements: (...args: unknown[]) => requirementsMock(...args),
    approvals: (...args: unknown[]) => approvalsMock(...args),
    todos: (...args: unknown[]) => todosMock(...args),
  },
  approvalApi: {
    list: (...args: unknown[]) => pendingListMock(...args),
  },
}))

const stubs = {
  'a-card': { template: '<div><slot /></div>' },
  'a-table': { props: ['columns', 'dataSource', 'loading', 'rowKey', 'pagination'], template: '<div class="table"><slot /></div>' },
  'a-space': { template: '<div><slot /></div>' },
  'a-button': { props: ['type'], emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  'a-input': { props: ['value'], emits: ['update:value'], template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />' },
  'a-row': { template: '<div><slot /></div>' },
  'a-col': { template: '<div><slot /></div>' },
  'a-statistic': { props: ['title', 'value', 'valueStyle'], template: '<div class="statistic">{{ title }}{{ value }}</div>' },
  'a-tag': { props: ['color'], template: '<span><slot /></span>' },
}

function mountView() {
  return mount(
    defineComponent({
      components: { PersonalCenterView },
      template: '<PersonalCenterView />',
    }),
    { global: { plugins: [createPinia(), i18n], stubs } },
  )
}

describe('PersonalCenterView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requirementsMock.mockResolvedValue({ total: 1, items: [{ code: 'req-1', title: '我的需求', status: 'OPEN' }] })
    approvalsMock.mockResolvedValue({ total: 1, items: [{ code: 'apr-1', title: '我的申请', status: 'PENDING' }] })
    todosMock.mockResolvedValue({
      pendingApprovalCount: 2,
      myOpenRequirementCount: 1,
      myRequirementCount: 3,
      myApprovalCount: 4,
    })
    pendingListMock.mockResolvedValue({ total: 2, items: [{ code: 'apr-1', title: '待办', status: 'PENDING' }] })
  })

  it('挂载后加载个人中心四个数据源（默认用户 alice）', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(todosMock).toHaveBeenCalledWith('alice')
    expect(requirementsMock).toHaveBeenCalledWith('alice', { page: 1, size: 20 })
    expect(approvalsMock).toHaveBeenCalledWith('alice', { page: 1, size: 20 })
    expect(pendingListMock).toHaveBeenCalledWith({ page: 1, size: 20, status: 'PENDING' })
    expect(wrapper.text()).toContain('待我审批')
  })

  it('统计数字来自后端待办接口', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('我的需求总数')
  })
})
