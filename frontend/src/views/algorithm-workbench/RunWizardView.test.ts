import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import RunWizardView from './RunWizardView.vue'

const findServiceMock = vi.fn()
const listMyDeliveriesMock = vi.fn()
const preflightMock = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { code: 'quality-weekly' } }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/api/algorithm-workbench', () => ({
  algorithmWorkbenchApi: {
    findService: (...args: unknown[]) => findServiceMock(...args),
    listMyDeliveries: (...args: unknown[]) => listMyDeliveriesMock(...args),
    preflight: (...args: unknown[]) => preflightMock(...args),
    uploadTestData: vi.fn(),
    submitRun: vi.fn(),
  },
}))

const stubs = {
  'a-card': { template: '<div><slot /></div>' },
  'a-spin': { template: '<div><slot /></div>' },
  'a-steps': { template: '<div><slot /></div>' },
  'a-step': { template: '<div />' },
  'a-form': { template: '<form><slot /></form>' },
  'a-form-item': {
    props: ['label', 'help'],
    template: '<div><label>{{ label }}</label><slot /><small v-if="help">{{ help }}</small></div>',
  },
  'a-select': { props: ['options', 'value'], emits: ['update:value', 'blur'], template: '<select @blur="$emit(\'blur\')"><slot /></select>' },
  'a-input-number': { emits: ['update:value', 'blur'], template: '<input type="number" @blur="$emit(\'blur\')" />' },
  'a-date-picker': { emits: ['update:value', 'blur'], template: '<input @blur="$emit(\'blur\')" />' },
  'a-input': { emits: ['update:value', 'blur'], template: '<input @blur="$emit(\'blur\')" />' },
  'a-textarea': { emits: ['update:value'], template: '<textarea />' },
  'a-radio-group': { template: '<div><slot /></div>' },
  'a-radio': { template: '<label><slot /></label>' },
  'a-divider': { template: '<hr />' },
  'a-button': { props: ['disabled', 'loading'], emits: ['click'], template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>' },
  'a-tag': { template: '<span><slot /></span>' },
  'a-alert': { template: '<div><slot /></div>' },
  'a-descriptions': { template: '<div><slot /></div>' },
  'a-descriptions-item': { template: '<div><slot /></div>' },
}

describe('RunWizardView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findServiceMock.mockResolvedValue({
      code: 'quality-weekly',
      name: '数据质量分析',
      category: '质量分析',
      description: '校验待分析数据集质量',
      inputHint: '需要待分析数据集',
      typicalDuration: '5 分钟',
      runCount: 1,
      status: 'PUBLISHED',
      badges: [],
      descriptor: {
        schemaVersion: '1.0',
        serviceType: 'algorithm-service',
        provider: 'algorithm-platform',
        code: 'quality-weekly',
        name: '数据质量分析',
        summary: {},
        sections: [{ type: 'inputs', inputs: [{ key: 'dataset', label: '待分析数据集', kind: 'dataset-ref', required: true }] }],
        actions: [],
      },
    })
    listMyDeliveriesMock.mockResolvedValue([])
  })

  it('未选择必填数据集时保留在输入步骤并显示字段错误', async () => {
    const wrapper = mount(RunWizardView, {
      global: { plugins: [createPinia(), i18n], stubs },
    })
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text() === '下一步')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('待分析数据集 为必填项')
    expect(preflightMock).not.toHaveBeenCalled()
  })
})
