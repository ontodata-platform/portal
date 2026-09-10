import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { dataWorkbenchApi } from '@/api/data-workbench'
import { marketplaceApi } from '@/api/portal'
import { i18n } from '@/i18n'
import { useIdentityStore } from '@/stores/identity'
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
  'a-textarea': { props: ['value'], template: '<textarea :value="value" />' },
  'a-date-picker': { props: ['value'], template: '<input :value="value" />' },
  'a-checkbox-group': { template: '<div><slot /></div>' },
  'a-checkbox': { props: ['value'], template: '<input type="checkbox" />' },
  'a-radio-group': { template: '<div><slot /></div>' },
  'a-radio-button': { props: ['value'], template: '<button><slot /></button>' },
  'a-button': {
    props: ['type', 'size', 'disabled', 'loading'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  'a-tag': { props: ['color'], template: '<span><slot /></span>' },
  'a-descriptions': { template: '<div><slot /></div>' },
  'a-descriptions-item': { props: ['label'], template: '<div>{{ label }}: <slot /></div>' },
}

function mountWizard(targets: unknown[], open = true) {
  const wrapper = mount(ApplyWizardModal, {
    props: {
      open,
      targets: targets as never,
      'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
    },
    global: { plugins: [createPinia(), i18n], stubs },
  })
  return wrapper
}

const serviceTarget = { code: 'ds-gaofen-optical', name: '东海高分光学影像服务', source: 'SERVICE' as const }

describe('ApplyWizardModal（B3 三步向导）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(marketplaceApi.apply).mockResolvedValue({ approvalCode: 'apr-data-001', status: 'PENDING' })
  })

  it('SERVICE 来源走 marketplaceApi.apply 并回传申请单数组（含四要素）', async () => {
    const wrapper = mountWizard([serviceTarget])

    // 直接提交（跳过 UI 步骤）：默认四要素为空但透传给接口
    await (wrapper.vm as unknown as { submitApply(): Promise<void> }).submitApply()
    await flushPromises()

    expect(marketplaceApi.apply).toHaveBeenCalledWith('ds-gaofen-optical', {
      grantedColumns: undefined,
      useIntent: expect.objectContaining({ purpose: '', regions: [], deliveryFrequency: 'ONCE' }),
    })
    const payload = wrapper.emitted('submitted')?.[0]?.[0] as Array<{ code: string }>
    expect(payload[0]).toMatchObject({ code: 'apr-data-001', serviceCode: 'ds-gaofen-optical' })
  })

  it('四要素缺失时无法进入确认步骤，补全后可进入并预览申请人', async () => {
    const wrapper = mountWizard([serviceTarget])
    const vm = wrapper.vm as unknown as {
      goToConfirm(): void
      applyStep: number
      applyForm: { purpose: string; regions: string[]; timeFrom: string; timeTo: string; deliveryFormats: string[] }
    }

    // 预置演示身份：确认页预览申请人
    useIdentityStore().setIdentity({ name: '陈晓', tenantId: 'demo', roles: ['user'], devMode: true })

    // 停留在要素步骤：字段为空不允许进入确认
    vm.applyStep = 1
    vm.goToConfirm()
    expect(vm.applyStep).toBe(1)

    // 补全四要素
    vm.applyForm.purpose = '港区目标特性提取'
    vm.applyForm.regions = ['东海']
    vm.applyForm.timeFrom = '2026-09-11'
    vm.applyForm.timeTo = '2026-12-31'
    vm.applyForm.deliveryFormats = ['CSV']
    vm.goToConfirm()
    await nextTick()
    expect(vm.applyStep).toBe(2)
    expect(wrapper.text()).toContain('陈晓')
  })

  it('多产品合并申请：逐个提交并回传全部单据', async () => {
    const wrapper = mountWizard([
      serviceTarget,
      { code: 'ds-sar-maritime', name: 'SAR海面目标检测辅助数据', source: 'SERVICE' as const },
    ])

    await (wrapper.vm as unknown as { submitApply(): Promise<void> }).submitApply()
    await flushPromises()

    expect(marketplaceApi.apply).toHaveBeenCalledTimes(2)
    const payload = wrapper.emitted('submitted')?.[0]?.[0] as Array<{ code: string }>
    expect(payload).toHaveLength(2)
  })

  it('DATASET 来源走 dataWorkbenchApi.apply', async () => {
    vi.mocked(dataWorkbenchApi.apply).mockResolvedValue({
      code: 'app-2026-004',
      serviceCode: 'dset-optical-snapshot',
      serviceName: '高分光学影像快照',
      status: 'PENDING',
      submittedAt: '2026-09-10T09:00:00.000Z',
      remark: '自数据集详情申请使用',
    })

    const wrapper = mountWizard([{
      code: 'dset-optical-snapshot',
      name: '高分光学影像快照',
      source: 'DATASET' as const,
      fields: ['scene_id'],
    }])
    await flushPromises()

    await (wrapper.vm as unknown as { submitApply(): Promise<void> }).submitApply()
    await flushPromises()

    expect(dataWorkbenchApi.apply).toHaveBeenCalledWith({
      source: 'DATASET',
      serviceCode: 'dset-optical-snapshot',
      serviceName: '高分光学影像快照',
      grantedColumns: ['scene_id'],
      useIntent: expect.objectContaining({ deliveryFrequency: 'ONCE' }),
    })
    expect(marketplaceApi.apply).not.toHaveBeenCalled()
    const payload = wrapper.emitted('submitted')?.[0]?.[0] as Array<{ code: string }>
    expect(payload[0]).toMatchObject({ code: 'app-2026-004' })
  })
})
