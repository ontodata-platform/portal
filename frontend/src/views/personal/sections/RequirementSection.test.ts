import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import RequirementSection from './RequirementSection.vue'

const listMock = vi.fn()
const createMock = vi.fn()

vi.mock('@/api/portal', () => ({
  requirementApi: {
    list: (...args: unknown[]) => listMock(...args),
    create: (...args: unknown[]) => createMock(...args),
    analyze: vi.fn(),
    assign: vi.fn(),
    progress: vi.fn(),
    complete: vi.fn(),
    cancel: vi.fn(),
  },
}))

const stubs = {
  'a-card': { template: '<div><slot /></div>' },
  'a-space': { template: '<div><slot /></div>' },
  'a-divider': { template: '<div><slot /></div>' },
  OdTable: {
    props: ['dataSource'],
    template: '<div class="table"><div v-for="record in dataSource" :key="record.code"><slot name="bodyCell" :column="{ key: \'action\' }" :record="record" /></div></div>',
  },
  'a-table': { props: ['dataSource'], template: '<div><slot name="bodyCell" /></div>' },
  'a-button': { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  'a-select': { props: ['value'], emits: ['update:value'], inheritAttrs: false, template: '<select v-bind="$attrs" :value="value" @change="$emit(\'update:value\', $event.target.value)"><slot /></select>' },
  'a-select-option': { props: ['value'], template: '<option :value="value"><slot /></option>' },
  'a-input': { props: ['value'], emits: ['update:value'], inheritAttrs: false, template: '<input v-bind="$attrs" :value="value" @input="$emit(\'update:value\', $event.target.value)" />' },
  'a-textarea': { props: ['value'], emits: ['update:value'], inheritAttrs: false, template: '<textarea v-bind="$attrs" :value="value" @input="$emit(\'update:value\', $event.target.value)" />' },
  'a-modal': { props: ['open'], emits: ['ok'], template: '<section v-if="open" class="modal"><slot /><button class="modal-ok" @click="$emit(\'ok\')">确认</button></section>' },
  'a-form': { template: '<form><slot /></form>' },
  'a-form-item': { props: ['label'], template: '<label>{{ label }}<slot /></label>' },
  'a-radio-group': { template: '<div><slot /></div>' },
  'a-radio-button': { props: ['value'], template: '<button type="button"><slot /></button>' },
  'a-tag': { template: '<span><slot /></span>' },
}

function mountView() {
  return mount(RequirementSection, { global: { plugins: [createPinia(), i18n], stubs } })
}

describe('RequirementSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listMock.mockResolvedValue({ total: 0, items: [] })
    createMock.mockResolvedValue({ code: 'req-020', status: 'OPEN' })
  })

  it('提交数据需求时携带结构化数据范围，供后续相似需求分析使用', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text().includes('登记需求'))!.trigger('click')
    await wrapper.find('input[name="title"]').setValue('华东仓储库存补货分析')
    await wrapper.find('textarea[name="description"]').setValue('用于制定补货计划。')
    await wrapper.find('input[name="businessDomain"]').setValue('供应链')
    await wrapper.find('input[name="dataObject"]').setValue('区域仓储库存')
    await wrapper.find('input[name="scope"]').setValue('华东区域')
    await wrapper.find('input[name="granularity"]').setValue('日')
    await wrapper.find('input[name="fields"]').setValue('warehouse_id，inventory_qty')
    await wrapper.find('input[name="useCase"]').setValue('供应链库存分析')
    await wrapper.find('.modal-ok').trigger('click')
    await flushPromises()

    expect(createMock).toHaveBeenCalledWith({
      requirementType: 'DATA',
      title: '华东仓储库存补货分析',
      description: '用于制定补货计划。',
      dataProfile: {
        businessDomain: '供应链',
        dataObject: '区域仓储库存',
        scope: '华东区域',
        granularity: '日',
        fields: ['warehouse_id', 'inventory_qty'],
        useCase: '供应链库存分析',
        sensitivity: 'INTERNAL',
      },
    })
  })

  it('个人需求页只允许撤回待受理需求，不显示运营分析、分派和办结动作', async () => {
    listMock.mockResolvedValue({
      total: 1,
      items: [{ code: 'req-002', requirementType: 'DATA', title: '补充区域仓储数据', requester: '陈晓', status: 'OPEN' }],
    })
    const wrapper = mountView()
    await flushPromises()

    const actionTexts = wrapper.find('.table').findAll('button').map((button) => button.text())
    expect(actionTexts).toEqual(['撤回'])
  })
})
