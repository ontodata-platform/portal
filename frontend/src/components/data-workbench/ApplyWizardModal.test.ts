import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { dataWorkbenchApi } from '@/api/data-workbench'
import { marketplaceApi } from '@/api/portal'
import { i18n } from '@/i18n'
import ApplyWizardModal from './ApplyWizardModal.vue'

vi.mock('@/api/portal', () => ({
  marketplaceApi: {
    apply: vi.fn(),
  },
}))

vi.mock('@/api/data-workbench', () => ({
  dataWorkbenchApi: {
    apply: vi.fn(),
  },
}))

const stubs = {
  'a-modal': { props: ['open', 'title'], template: '<div v-if="open"><slot /><slot name="footer" /></div>' },
  'a-steps': { template: '<div><slot /></div>' },
  'a-step': { props: ['title'], template: '<div>{{ title }}</div>' },
  'a-form': { template: '<form><slot /></form>' },
  'a-form-item': { props: ['label', 'extra'], template: '<div><slot /></div>' },
  'a-input': { props: ['value'], template: '<input :value="value" />' },
  'a-button': {
    props: ['type', 'size', 'disabled', 'loading'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  'a-tag': { props: ['color'], template: '<span><slot /></span>' },
  'a-descriptions': { template: '<div><slot /></div>' },
  'a-descriptions-item': { props: ['label'], template: '<div>{{ label }}: <slot /></div>' },
}

describe('ApplyWizardModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('SERVICE 来源走 marketplaceApi.apply 并回传审批单号', async () => {
    vi.mocked(marketplaceApi.apply).mockResolvedValue({
      approvalCode: 'apr-data-001',
      status: 'PENDING',
    })

    const wrapper = mount(ApplyWizardModal, {
      props: {
        open: true,
        targets: [{ code: 'ds-gaofen-optical', name: '东海高分光学影像服务', source: 'SERVICE' as const }],
        'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
      },
      global: { plugins: [createPinia(), i18n], stubs },
    })

    await wrapper.vm.submitApply()
    await flushPromises()

    expect(marketplaceApi.apply).toHaveBeenCalledWith('ds-gaofen-optical', { grantedColumns: undefined })
    expect(dataWorkbenchApi.apply).not.toHaveBeenCalled()
    expect(wrapper.emitted('submitted')?.[0]?.[0]).toMatchObject({
      code: 'apr-data-001',
      serviceCode: 'ds-gaofen-optical',
    })
  })

  it('DATASET 来源走 dataWorkbenchApi.apply 并回传申请单号', async () => {
    vi.mocked(dataWorkbenchApi.apply).mockResolvedValue({
      code: 'app-2026-004',
      serviceCode: 'dset-optical-snapshot',
      serviceName: '高分光学影像快照',
      status: 'PENDING',
      submittedAt: '2026-09-10T09:00:00.000Z',
      remark: '自数据集详情申请使用',
    })

    const wrapper = mount(ApplyWizardModal, {
      props: {
        open: true,
        targets: [{
          code: 'dset-optical-snapshot',
          name: '高分光学影像快照',
          source: 'DATASET' as const,
          fields: ['scene_id'],
        }],
        'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
      },
      global: { plugins: [createPinia(), i18n], stubs },
    })
    await flushPromises()

    await wrapper.vm.submitApply()
    await flushPromises()

    expect(dataWorkbenchApi.apply).toHaveBeenCalledWith({
      source: 'DATASET',
      serviceCode: 'dset-optical-snapshot',
      serviceName: '高分光学影像快照',
      grantedColumns: ['scene_id'],
    })
    expect(marketplaceApi.apply).not.toHaveBeenCalled()
    expect(wrapper.emitted('submitted')?.[0]?.[0]).toMatchObject({ code: 'app-2026-004' })
  })
})
