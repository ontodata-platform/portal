import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import ApprovalAdminView from './ApprovalAdminView.vue'

const listMock = vi.fn()
const findMock = vi.fn()
const nudgeMock = vi.fn()
const pushMock = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/api/portal', () => ({
  approvalApi: {
    list: (...args: unknown[]) => listMock(...args),
    find: (...args: unknown[]) => findMock(...args),
    nudge: (...args: unknown[]) => nudgeMock(...args),
  },
}))

const stubs = {
  PageHeader: {
    props: ['eyebrow', 'title', 'description'],
    template: '<header class="page-header"><h1>{{ title }}</h1><p v-if="description" class="page-desc">{{ description }}</p></header>',
  },
  'a-card': { template: '<div><slot /></div>' },
  'a-table': {
    props: ['columns', 'dataSource', 'loading', 'rowKey', 'pagination'],
    template:
      '<div class="table"><div v-for="record in dataSource" :key="record.code" class="table-row"><slot name="bodyCell" :column="{ key: \'code\' }" :record="record" /><slot name="bodyCell" :column="{ key: \'action\' }" :record="record" /></div></div>',
  },
  'a-space': { template: '<div><slot /></div>' },
  'a-button': { props: ['type', 'size', 'danger', 'ghost'], emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  'a-select': { props: ['value'], emits: ['update:value'], template: '<select :value="value"><slot /></select>' },
  'a-select-option': { template: '<option><slot /></option>' },
  'a-input': { props: ['value'], emits: ['update:value'], template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />' },
  'a-tag': { props: ['color'], template: '<span><slot /></span>' },
  'a-drawer': { props: ['open', 'title'], template: '<div v-if="open" class="drawer"><slot /><slot name="extra" /><slot name="footer" /></div>' },
  'a-descriptions': { template: '<div><slot /></div>' },
  'a-descriptions-item': { props: ['label'], template: '<div><slot /></div>' },
}

const pendingOverdue = {
  code: 'apr-overdue-003',
  approvalType: 'DATA_GRANT',
  sourceSystem: 'data-platform',
  title: '超期数据授权',
  requester: '王工',
  status: 'PENDING',
  slaStatus: 'OVERDUE',
  createdAt: '2026-08-30T09:30:00.000Z',
  updatedAt: '2026-08-31T09:30:00.000Z',
}

function mountView() {
  return mount(ApprovalAdminView, {
    global: { plugins: [createPinia(), i18n], stubs },
  })
}

describe('ApprovalAdminView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listMock.mockResolvedValue({ total: 1, items: [pendingOverdue] })
    findMock.mockResolvedValue(pendingOverdue)
    nudgeMock.mockResolvedValue({ ok: true, code: pendingOverdue.code })
  })

  it('聚合统计条并禁止代办批准/驳回', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(listMock).toHaveBeenCalled()
    expect(wrapper.text()).toContain('审批监管')
    expect(wrapper.text()).toContain('待审批')
    expect(wrapper.text()).toContain('超时')
    expect(wrapper.text()).toContain('今日已决')
    expect(wrapper.text()).not.toContain('批准')
    expect(wrapper.text()).not.toContain('驳回')
    expect(wrapper.text()).not.toContain('批量通过')
  })

  it('对 PENDING 单催办并提供工作台深链', async () => {
    const wrapper = mountView()
    await flushPromises()

    const nudge = wrapper.findAll('button').find((button) => button.text().includes('催办'))
    expect(nudge).toBeTruthy()
    await nudge!.trigger('click')
    await flushPromises()
    expect(nudgeMock).toHaveBeenCalledWith('apr-overdue-003')

    const detail = wrapper.findAll('button').find((button) => button.text().includes('详情'))
    await detail!.trigger('click')
    await flushPromises()
    expect(wrapper.find('.drawer').exists()).toBe(true)

    const workbench = wrapper.findAll('button').find((button) => button.text().includes('在工作台中查看'))
    expect(workbench).toBeTruthy()
    await workbench!.trigger('click')
    expect(pushMock).toHaveBeenCalledWith({ path: '/personal/approvals', query: { code: 'apr-overdue-003' } })
  })
})
