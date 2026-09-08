import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import DescriptorRenderer from '../DescriptorRenderer.vue'
import type { ServiceDescriptor } from '@/types/descriptor'

const descriptor: ServiceDescriptor = {
  schemaVersion: '1.0',
  serviceType: 'algorithm-service',
  provider: 'algorithm-recombine',
  code: 'tpl-quality-weekly',
  name: '客户质量分析-周批',
  summary: { version: '1.2.0', status: 'PUBLISHED', badges: ['准入：APPROVED'] },
  sections: [
    { type: 'summary', title: '基本信息', fields: [{ label: '服务编码', value: 'tpl-quality-weekly' }] },
    { type: 'richtext', title: '服务说明', text: '对客户主数据做字段级质量核查。' },
    { type: 'mystery-block', title: '未来新区块' },
    { type: 'inputs', title: '输入要求', inputs: [
      { key: 'customerData', label: '客户主数据', kind: 'dataset-ref', required: true },
      { key: 'qualityThreshold', label: '质量合格阈值', kind: 'number', defaultValue: '0.8' },
    ] },
  ],
  actions: [
    { id: 'run', label: '立即运行', kind: 'flow', flow: 'run' },
    { id: 'doc', label: '查看文档', kind: 'navigate', target: '/assistant' },
  ],
}

const stubs = {
  'a-space': { template: '<div><slot /></div>' },
  'a-tag': { props: ['color'], template: '<span class="tag"><slot /></span>' },
  'a-descriptions': { props: ['column', 'size', 'bordered'], template: '<div class="desc"><slot /></div>' },
  'a-descriptions-item': { props: ['label'], template: '<div class="desc-item"><span>{{ label }}</span><slot /></div>' },
  'a-table': {
    props: ['columns', 'dataSource', 'pagination', 'rowKey', 'size'],
    template: '<div class="stub-table"><div v-for="row in dataSource" :key="String(row.rowKey ?? row.label)" class="stub-row">{{ JSON.stringify(row) }}</div></div>',
  },
  'a-timeline': { template: '<div><slot /></div>' },
  'a-timeline-item': { props: ['color'], template: '<div class="tl-item"><slot /></div>' },
  'a-button': {
    props: ['type', 'size', 'ghost', 'danger', 'loading'],
    emits: ['click'],
    template: '<button @click="$emit(\'click\')"><slot /></button>',
  },
}

function mountRenderer() {
  return mount(DescriptorRenderer, {
    props: { descriptor },
    global: { plugins: [i18n], stubs },
  })
}

describe('DescriptorRenderer', () => {
  it('渲染服务名称与摘要徽章', () => {
    const wrapper = mountRenderer()
    expect(wrapper.text()).toContain('客户质量分析-周批')
    expect(wrapper.text()).toContain('1.2.0')
    expect(wrapper.text()).toContain('准入：已通过')
  })

  it('按描述符区块序列渲染已知类型', () => {
    const wrapper = mountRenderer()
    const text = wrapper.text()
    expect(text).toContain('基本信息')
    expect(text).toContain('服务编码')
    expect(text).toContain('tpl-quality-weekly')
    expect(text).toContain('服务说明')
    expect(text).toContain('对客户主数据做字段级质量核查。')
    expect(text).toContain('输入要求')
    expect(text).toContain('客户主数据')
    expect(text).toContain('数据引用')
  })

  it('未知区块类型降级为文本块，不白屏', () => {
    const wrapper = mountRenderer()
    expect(wrapper.text()).toContain('未来新区块')
    expect(wrapper.text()).toContain('该区块类型暂不支持图形化渲染')
  })

  it('动作按钮触发 action 事件', async () => {
    const wrapper = mountRenderer()
    const runButton = wrapper.findAll('button').find((button) => button.text() === '立即运行')
    expect(runButton).toBeTruthy()
    await runButton!.trigger('click')
    const emitted = wrapper.emitted('action')
    expect(emitted).toHaveLength(1)
    expect((emitted![0][0] as { id: string }).id).toBe('run')
  })
})
