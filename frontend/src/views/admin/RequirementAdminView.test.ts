import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import RequirementAdminView from './RequirementAdminView.vue'

const listMock = vi.fn()
const analyzeMock = vi.fn()
const assignMock = vi.fn()
const progressMock = vi.fn()
const completeMock = vi.fn()
const cancelMock = vi.fn()

vi.mock('@/api/portal', () => ({
  requirementApi: {
    list: (...args: unknown[]) => listMock(...args),
    analyze: (...args: unknown[]) => analyzeMock(...args),
    assign: (...args: unknown[]) => assignMock(...args),
    progress: (...args: unknown[]) => progressMock(...args),
    complete: (...args: unknown[]) => completeMock(...args),
    cancel: (...args: unknown[]) => cancelMock(...args),
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
  'a-textarea': { props: ['value'], emits: ['update:value'], template: '<textarea :value="value" @input="$emit(\'update:value\', $event.target.value)" />' },
  'a-tag': { props: ['color'], template: '<span><slot /></span>' },
  'a-drawer': { props: ['open', 'title'], template: '<div v-if="open" class="drawer"><slot /><slot name="extra" /><slot name="footer" /></div>' },
  'a-timeline': { template: '<ol class="timeline"><slot /></ol>' },
  'a-timeline-item': { props: ['color'], template: '<li><slot /></li>' },
  'a-form': { template: '<form><slot /></form>' },
  'a-form-item': { props: ['label'], template: '<div><slot /></div>' },
  'a-descriptions': { template: '<div><slot /></div>' },
  'a-descriptions-item': { props: ['label'], template: '<div><slot /></div>' },
}

const openItem = {
  code: 'req-002',
  requirementType: 'DATA',
  title: '补充区域仓储数据',
  requester: 'alice',
  status: 'OPEN',
  createdAt: '2026-08-31T09:30:00.000Z',
  updatedAt: '2026-08-31T09:30:00.000Z',
}

function mountView() {
  return mount(RequirementAdminView, {
    global: { plugins: [createPinia(), i18n], stubs },
  })
}

describe('RequirementAdminView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listMock.mockResolvedValue({ total: 1, items: [openItem] })
    analyzeMock.mockResolvedValue({ ...openItem, status: 'ANALYZING' })
  })

  it('挂载后加载全量需求且不展示新建与页头说明', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(listMock).toHaveBeenCalledWith({
      page: 1,
      size: 20,
      status: undefined,
      type: undefined,
      keyword: undefined,
    })
    expect(wrapper.text()).toContain('需求管理')
    expect(wrapper.text()).toContain('req-002')
    expect(wrapper.text()).not.toContain('登记需求')
    expect(wrapper.text()).not.toContain('新建需求')
    expect(wrapper.find('.page-desc').exists()).toBe(false)
  })

  it('办理抽屉可对 OPEN 单执行分析', async () => {
    const wrapper = mountView()
    await flushPromises()

    const handle = wrapper.findAll('button').find((button) => button.text().includes('办理'))
    expect(handle).toBeTruthy()
    await handle!.trigger('click')
    await flushPromises()

    expect(wrapper.find('.drawer').exists()).toBe(true)
    expect(wrapper.text()).toContain('接收')

    const analyze = wrapper.findAll('button').find((button) => button.text() === '分析')
    expect(analyze).toBeTruthy()
    await analyze!.trigger('click')
    await flushPromises()

    expect(analyzeMock).toHaveBeenCalledWith('req-002')
    expect(listMock).toHaveBeenCalledTimes(2)
  })
})
