import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { workbenchApi } from '@/api/portal'
import { i18n } from '@/i18n'
import WorkbenchRunView from './WorkbenchRunView.vue'

const pushMock = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { code: 'wf-recon-001' } }),
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/api/portal', () => ({
  workbenchApi: {
    template: vi.fn(),
    run: vi.fn(),
  },
}))

const stubs = {
  'a-card': { template: '<div class="card"><slot name="title" /><slot /></div>' },
  'a-spin': { props: ['spinning'], template: '<div><slot /></div>' },
  'a-alert': { props: ['type', 'message', 'description', 'showIcon'], template: '<div class="alert">{{ message }} {{ description }}</div>' },
  'a-space': { template: '<div><slot /></div>' },
  'a-button': { props: ['type', 'size', 'disabled', 'loading', 'htmlType'], emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  'a-tag': { props: ['color'], template: '<span class="tag"><slot /></span>' },
  'a-divider': { template: '<hr />' },
  'a-empty': { props: ['description'], template: '<div>{{ description }}</div>' },
  'a-form': { template: '<form><slot /></form>' },
  'a-form-item': { props: ['label', 'extra', 'required'], template: '<div><slot /></div>' },
  'a-input': { props: ['value'], emits: ['update:value'], template: '<input :value="value" />' },
  'a-input-number': { props: ['value', 'min'], emits: ['update:value'], template: '<input type="number" :value="value" />' },
}

describe('WorkbenchRunView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('成功加载工作流模板并提交运行', async () => {
    vi.mocked(workbenchApi.template).mockResolvedValue({
      sourceSystem: 'algorithm-recombine',
      available: true,
      body: {
        code: 'wf-recon-001',
        name: '多模态风险分析工作流',
        status: 'PUBLISHED',
        currentVersion: 2,
      },
    })
    vi.mocked(workbenchApi.run).mockResolvedValue({
      taskId: 'task-run-888',
      status: 'RUNNING',
      started: true,
    })

    const wrapper = mount(WorkbenchRunView, {
      global: { plugins: [createPinia(), i18n], stubs },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('多模态风险分析工作流')
    expect(wrapper.text()).toContain('wf-recon-001')
    expect(wrapper.text()).toContain('v2')

    // 提交运行
    await (wrapper.vm as unknown as { submitRun: () => Promise<void> }).submitRun()
    await flushPromises()

    expect(workbenchApi.run).toHaveBeenCalledWith('wf-recon-001', {
      templateVersion: 2,
      ontologyRuntimeContractVersion: undefined,
      dataSnapshotVersion: undefined,
      resourceRefs: undefined,
    })
    expect(pushMock).toHaveBeenCalledWith('/personal/tasks')
  })

  it('契约版本格式不合法时拦截提交', async () => {
    vi.mocked(workbenchApi.template).mockResolvedValue({
      sourceSystem: 'algorithm-recombine',
      available: true,
      item: {
        code: 'wf-recon-001',
        name: '多模态风险分析工作流',
        status: 'PUBLISHED',
        currentVersion: 1,
      },
    })

    const wrapper = mount(WorkbenchRunView, {
      global: { plugins: [createPinia(), i18n], stubs },
    })
    await flushPromises()

    const vm = wrapper.vm as unknown as {
      form: { ontologyRuntimeContractVersion: string }
      submitRun: () => Promise<void>
      formError: string
    }
    vm.form.ontologyRuntimeContractVersion = 'invalid-version'
    await vm.submitRun()
    await flushPromises()

    expect(vm.formError).toContain('本体运行契约版本必须符合 x.y 格式')
    expect(workbenchApi.run).not.toHaveBeenCalled()
  })
})
