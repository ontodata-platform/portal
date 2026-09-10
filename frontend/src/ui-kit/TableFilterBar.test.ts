import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import TableFilterBar from './TableFilterBar.vue'

const stubs = {
  'a-select': {
    props: ['value', 'options', 'id', 'placeholder'],
    emits: ['change'],
    template:
      '<select :id="id" @change="$emit(\'change\', $event.target.value)"><option v-for="option in options || []" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
  },
  'a-input': {
    props: ['value', 'id', 'placeholder'],
    emits: ['update:value'],
    template: '<input :id="id" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
  },
  'a-button': { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot name="icon" /><slot /></button>' },
}

const filters = [
  { key: 'status', label: '状态', options: [{ label: '待分析', value: 'OPEN' }] },
  { key: 'type', label: '类型', options: [{ label: '数据需求', value: 'DATA' }] },
]

function mountBar(props: InstanceType<typeof TableFilterBar>['$props']) {
  return mount(TableFilterBar, {
    props,
    global: { plugins: [i18n], stubs },
  })
}

describe('TableFilterBar', () => {
  it('每个筛选控件渲染可见标签且 for 指向控件 id（A6-1）', () => {
    const wrapper = mountBar({ query: { status: '', type: '' }, filters, searchPlaceholder: '按标题搜索' })

    const labels = wrapper.findAll('label').map((label) => label.text())
    expect(labels).toEqual(['状态', '类型', '关键字'])
    expect(wrapper.find('select#tfb-status').exists()).toBe(true)
    expect(wrapper.find('input#tfb-keyword').exists()).toBe(true)
  })

  it('选择变更经 update 事件整体回写，不改写传入的 query 对象', async () => {
    const query = { status: '', type: '' }
    const wrapper = mountBar({ query, filters, searchPlaceholder: '按标题搜索' })

    await wrapper.find('select#tfb-status').setValue('OPEN')

    expect(wrapper.emitted('update')?.[0]?.[0]).toEqual({ status: 'OPEN', type: '' })
    expect(query.status).toBe('')
  })

  it('关键字输入回写到 searchKey 指定键', async () => {
    const wrapper = mountBar({ query: { section: '' }, filters: [], searchPlaceholder: '栏目', searchKey: 'section', searchLabel: '栏目' })

    await wrapper.find('input#tfb-section').setValue('服务动态')

    expect(wrapper.emitted('update')?.[0]?.[0]).toEqual({ section: '服务动态' })
    expect(wrapper.findAll('label').map((label) => label.text())).toEqual(['栏目'])
  })

  it('不传 searchPlaceholder 则不渲染关键字框，查询按钮走自定义文案', async () => {
    const wrapper = mountBar({ query: { status: '' }, filters: [filters[0]], searchText: '查询反馈' })

    expect(wrapper.find('input').exists()).toBe(false)
    const search = wrapper.findAll('button').find((button) => button.text().includes('查询反馈'))
    expect(search).toBeTruthy()
    await search!.trigger('click')
    expect(wrapper.emitted('search')).toHaveLength(1)
  })
})
