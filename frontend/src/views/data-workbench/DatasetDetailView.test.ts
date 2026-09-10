import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { dataWorkbenchApi } from '@/api/data-workbench'
import ApplyWizardModal from '@/components/data-workbench/ApplyWizardModal.vue'
import { i18n } from '@/i18n'
import type { ServiceDescriptor } from '@/types/descriptor'
import DatasetDetailView from './DatasetDetailView.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { code: 'dset-optical-snapshot' } }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: { props: ['to'], template: '<a :href="String(to)"><slot /></a>' },
}))

vi.mock('@/api/data-workbench', () => ({
  dataWorkbenchApi: {
    findDataset: vi.fn(),
    apply: vi.fn(),
  },
}))

const descriptor: ServiceDescriptor = {
  schemaVersion: '1.0',
  serviceType: 'data-service',
  provider: 'data-platform',
  code: 'dset-optical-snapshot',
  name: '高分光学影像快照',
  summary: { version: 'v2026.08', status: 'ONLINE' },
  sections: [
    { type: 'fields', title: '字段与口径', fields: [{ label: 'scene_id', value: '景号' }] },
    {
      type: 'sample',
      title: '数据样例',
      sample: { columns: ['scene_id'], rows: [['GF1-001']] },
    },
  ],
  actions: [
    { id: 'apply', label: '申请使用', kind: 'flow', flow: 'apply' },
    { id: 'preview', label: '查看样例', kind: 'navigate' },
  ],
}

const stubs = {
  'a-card': { template: '<div class="card"><slot /></div>' },
  'a-alert': {
    props: ['type', 'message', 'description', 'showIcon'],
    template: '<div class="alert">{{ message }}<slot name="action" /></div>',
  },
  'a-space': { template: '<div><slot /></div>' },
  'a-tag': { props: ['color'], template: '<span><slot /></span>' },
  'a-descriptions': { template: '<div><slot /></div>' },
  'a-descriptions-item': { props: ['label'], template: '<div>{{ label }}: <slot /></div>' },
  'a-table': { props: ['dataSource'], template: '<div class="table" />' },
  'a-button': {
    props: ['type', 'size', 'disabled', 'loading'],
    emits: ['click'],
    template: '<button @click="$emit(\'click\')"><slot /></button>',
  },
  'a-modal': { props: ['open', 'title'], template: '<div v-if="open"><slot /><slot name="footer" /></div>' },
  'a-form': { template: '<form><slot /></form>' },
  'a-form-item': { props: ['label', 'extra'], template: '<div><slot /></div>' },
  'a-input': { props: ['value'], template: '<input :value="value" />' },
  'a-steps': { template: '<div><slot /></div>' },
  'a-step': { props: ['title'], template: '<div>{{ title }}</div>' },
}

describe('DatasetDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(dataWorkbenchApi.findDataset).mockResolvedValue({
      code: 'dset-optical-snapshot',
      name: '高分光学影像快照',
      domain: '光学影像',
      classification: '内部',
      version: 'v2026.08',
      snapshotDate: '2026-09-03',
      qualityPassRate: '98%',
      status: 'ONLINE',
      description: '东海示范区光学快照',
      descriptor,
    })
    vi.mocked(dataWorkbenchApi.apply).mockResolvedValue({
      code: 'app-2026-004',
      serviceCode: 'dset-optical-snapshot',
      serviceName: '高分光学影像快照',
      status: 'PENDING',
      submittedAt: '2026-09-10T09:00:00.000Z',
      remark: '自数据集详情申请使用',
    })
  })

  it('申请使用打开向导，提交后出现横幅且申请落入我的申请契约', async () => {
    const wrapper = mount(DatasetDetailView, {
      global: { plugins: [createPinia(), i18n], stubs },
    })
    await flushPromises()

    const applyButton = wrapper.findAll('button').find((button) => button.text() === '申请使用')
    expect(applyButton).toBeTruthy()
    await applyButton!.trigger('click')

    const wizard = wrapper.findComponent(ApplyWizardModal)
    expect(wizard.exists()).toBe(true)
    await wizard.vm.submitApply()
    await flushPromises()

    expect(dataWorkbenchApi.apply).toHaveBeenCalledWith({
      source: 'DATASET',
      serviceCode: 'dset-optical-snapshot',
      serviceName: '高分光学影像快照',
      grantedColumns: ['scene_id'],
    })
    expect(wrapper.text()).toContain('app-2026-004')
    expect(wrapper.text()).toContain('查看我的申请')
  })

  it('查看样例滚动到样例节', async () => {
    const scrollIntoView = vi.fn()
    const sample = document.createElement('section')
    sample.id = 'descriptor-sample'
    sample.scrollIntoView = scrollIntoView
    document.body.appendChild(sample)

    const wrapper = mount(DatasetDetailView, {
      global: { plugins: [createPinia(), i18n], stubs },
    })
    await flushPromises()

    const previewButton = wrapper.findAll('button').find((button) => button.text() === '查看样例')
    expect(previewButton).toBeTruthy()
    await previewButton!.trigger('click')

    expect(scrollIntoView).toHaveBeenCalled()
    sample.remove()
  })
})
