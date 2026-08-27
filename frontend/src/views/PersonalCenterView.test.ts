import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import PersonalCenterView from './PersonalCenterView.vue'

const meMock = vi.fn()
const requirementsMock = vi.fn()
const approvalsMock = vi.fn()
const todosMock = vi.fn()
const pendingListMock = vi.fn()
const noticesMock = vi.fn()
const retryDeliveryMock = vi.fn()
const pushMock = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/api/portal', () => ({
  personalApi: {
    me: (...args: unknown[]) => meMock(...args),
    requirements: (...args: unknown[]) => requirementsMock(...args),
    approvals: (...args: unknown[]) => approvalsMock(...args),
    todos: (...args: unknown[]) => todosMock(...args),
  },
  approvalApi: {
    list: (...args: unknown[]) => pendingListMock(...args),
  },
  operationsApi: {
    notices: (...args: unknown[]) => noticesMock(...args),
  },
  marketplaceApi: {
    retryDelivery: (...args: unknown[]) => retryDeliveryMock(...args),
  },
}))

const stubs = {
  'a-card': { template: '<div class="card"><slot name="title" /><slot name="extra" /><slot /></div>' },
  'a-table': { props: ['columns', 'dataSource', 'loading', 'rowKey', 'pagination'], template: '<div class="table"><slot /></div>' },
  'a-space': { template: '<div><slot /></div>' },
  'a-button': { props: ['type', 'size', 'ghost', 'danger', 'loading'], emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  'a-avatar': { template: '<div class="avatar"><slot /></div>' },
  'a-row': { template: '<div><slot /></div>' },
  'a-col': { template: '<div><slot /></div>' },
  'a-statistic': { props: ['title', 'value', 'valueStyle'], template: '<div class="statistic">{{ title }}{{ value }}</div>' },
  'a-tag': { props: ['color'], template: '<span class="tag"><slot /></span>' },
  'a-spin': { props: ['spinning'], template: '<div><slot /></div>' },
  'a-list': { props: ['dataSource'], template: '<div><slot /></div>' },
  'a-list-item': { template: '<div><slot /></div>' },
  'a-modal': { props: ['open'], template: '<div><slot /></div>' },
  'a-divider': { template: '<hr />' },
  'a-empty': { props: ['description'], template: '<div>{{ description }}</div>' },
}

function mountView() {
  return mount(PersonalCenterView, {
    global: { plugins: [createPinia(), i18n], stubs },
  })
}

describe('PersonalCenterView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    meMock.mockResolvedValue({
      name: 'tester-user',
      tenantId: 'tenant-a',
      roles: ['portal-user'],
      devMode: false,
    })
    requirementsMock.mockResolvedValue({ total: 1, items: [{ code: 'req-1', title: '我的需求', status: 'OPEN' }] })
    approvalsMock.mockResolvedValue({
      total: 1,
      items: [
        {
          code: 'apr-1',
          title: '我的申请',
          approvalType: 'DATA_GRANT',
          status: 'APPROVED',
          detail: { deliveryStatus: 'FAILED' },
        },
      ],
    })
    todosMock.mockResolvedValue({
      pendingApprovalCount: 2,
      myOpenRequirementCount: 1,
      myRequirementCount: 3,
      myApprovalCount: 4,
    })
    pendingListMock.mockResolvedValue({ total: 2, items: [{ code: 'apr-1', title: '待办', status: 'PENDING' }] })
    noticesMock.mockResolvedValue({ total: 1, items: [{ code: 'ntc-1', title: '平台上线公告', section: '公告' }] })
  })

  it('挂载后加载当前身份与个人数据源（无 requester 参数）', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(meMock).toHaveBeenCalled()
    expect(todosMock).toHaveBeenCalledWith()
    expect(requirementsMock).toHaveBeenCalledWith({ page: 1, size: 10 })
    expect(approvalsMock).toHaveBeenCalledWith({ page: 1, size: 10 })
    expect(pendingListMock).toHaveBeenCalledWith({ page: 1, size: 10, status: 'PENDING' })
    expect(noticesMock).toHaveBeenCalledWith({ page: 1, size: 5, status: 'PUBLISHED' })

    expect(wrapper.text()).toContain('tester-user')
    expect(wrapper.text()).toContain('tenant-a')
    expect(wrapper.text()).toContain('待我审批')
  })

  it('重试投递调用 marketplaceApi.retryDelivery', async () => {
    retryDeliveryMock.mockResolvedValue({ code: 'apr-1', status: 'APPROVED' })
    const wrapper = mountView()
    await flushPromises()

    const vm = wrapper.vm as unknown as {
      handleRetryDelivery: (record: { code: string }) => Promise<void>
    }
    await vm.handleRetryDelivery({ code: 'apr-1' })
    await flushPromises()

    expect(retryDeliveryMock).toHaveBeenCalledWith('apr-1')
    expect(approvalsMock).toHaveBeenCalledTimes(2)
  })
})
