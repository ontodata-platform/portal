import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/client'
import { i18n } from '@/i18n'
import { useMessageStore } from '@/stores/message'
import ScenariosView from './ScenariosView.vue'

const listMock = vi.fn()
const createMock = vi.fn()
const updateMock = vi.fn()
const publishMock = vi.fn()
const deprecateMock = vi.fn()
const createDraftMock = vi.fn()

const unavailableCatalog = { sourceSystem: 'upstream', available: false, message: '目录不可用' }

vi.mock('@/api/portal', () => ({
  scenarioApi: {
    list: (...args: unknown[]) => listMock(...args),
    create: (...args: unknown[]) => createMock(...args),
    update: (...args: unknown[]) => updateMock(...args),
    publish: (...args: unknown[]) => publishMock(...args),
    deprecate: (...args: unknown[]) => deprecateMock(...args),
    createDraft: (...args: unknown[]) => createDraftMock(...args),
  },
  marketplaceApi: {
    dataServices: () => Promise.resolve(unavailableCatalog),
  },
  workbenchApi: {
    capabilities: () => Promise.resolve(unavailableCatalog),
    workflowTemplates: () => Promise.resolve(unavailableCatalog),
  },
}))

const stubs = {
  'a-card': { template: '<div><slot /></div>' },
  'a-table': { props: ['columns', 'dataSource', 'loading', 'rowKey', 'pagination'], template: '<div class="table"><slot /></div>' },
  'a-space': { template: '<div><slot /></div>' },
  'a-button': { props: ['type', 'size', 'danger', 'disabled', 'block'], emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  'a-input': { props: ['value'], emits: ['update:value'], template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />' },
  'a-textarea': { props: ['value', 'rows'], emits: ['update:value'], template: '<textarea :value="value" @input="$emit(\'update:value\', $event.target.value)" />' },
  'a-select': { props: ['value'], emits: ['update:value'], template: '<select :value="value"><slot /></select>' },
  'a-select-option': { template: '<option />' },
  'a-tag': { props: ['color'], template: '<span><slot /></span>' },
  'a-row': { template: '<div><slot /></div>' },
  'a-col': { template: '<div><slot /></div>' },
  'a-divider': { template: '<hr />' },
  'a-modal': {
    props: ['open', 'title', 'confirmLoading', 'width'],
    emits: ['ok', 'update:open'],
    template: '<div class="modal"><slot /></div><button class="modal-ok" @click="$emit(\'ok\')">ok</button>',
  },
  'a-alert': { props: ['type', 'message', 'showIcon'], template: '<div class="alert">{{ message }}</div>' },
  'a-form': { template: '<form><slot /></form>' },
  'a-form-item': { props: ['label', 'required'], template: '<div><slot /></div>' },
}

function mountView(pinia = createPinia()) {
  const wrapper = mount(ScenariosView, {
    global: { plugins: [pinia, i18n], stubs },
  })
  return { wrapper, pinia }
}

const draftScenario = {
  code: 'scn-abc123',
  version: '1.0.0',
  name: '客户数据质量分析场景',
  status: 'DRAFT',
  bindings: [
    { type: 'DATA_SNAPSHOT', ref: 'snap-customer-master', version: '3.0.0', alias: 'customerData', sourceSystem: 'DATA_PLATFORM' },
  ],
  tenantId: 'default',
  createdAt: '2026-08-26T08:00:00Z',
  updatedAt: '2026-08-26T08:00:00Z',
}

describe('ScenariosView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listMock.mockResolvedValue({ total: 1, items: [draftScenario] })
    createMock.mockResolvedValue({ ...draftScenario })
    publishMock.mockResolvedValue({ ...draftScenario, status: 'PUBLISHED' })
  })

  it('挂载后加载场景列表', async () => {
    const { wrapper } = mountView()
    await flushPromises()

    expect(listMock).toHaveBeenCalledWith({ page: 1, size: 20, status: undefined, keyword: undefined })
    expect(wrapper.text()).toContain('查询')
  })

  it('创建提交走 scenarioApi.create 并提示成功', async () => {
    const { wrapper, pinia } = mountView()
    await flushPromises()

    const createButton = wrapper.findAll('button').find((button) => button.text().includes('创建场景'))
    await createButton!.trigger('click')

    const vm = wrapper.vm as unknown as {
      form: { name: string; bindings: { type: string; sourceSystem: string; ref: string; version: string }[] }
    }
    vm.form.name = '新测试场景'
    vm.form.bindings[0].ref = 'snap-test-1'
    vm.form.bindings[0].version = '1.0.0'

    await wrapper.find('.modal-ok').trigger('click')
    await flushPromises()

    expect(createMock).toHaveBeenCalledTimes(1)
    const payload = createMock.mock.calls[0][0] as {
      bindings: { version: string; sourceSystem: string; type: string }[]
    }
    expect(payload.bindings[0].version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(payload.bindings[0].sourceSystem).toBe('ALGORITHM_RECOMBINE')
    expect(payload.bindings[0].type).toBe('WORKFLOW_TEMPLATE')
    expect(payload.presentation).toBeUndefined()
    expect(useMessageStore(pinia).feedback?.kind).toBe('success')
  })

  it('展示配置用动态行提交，未知别名前端拦截', async () => {
    const { wrapper } = mountView()
    await flushPromises()

    const createButton = wrapper.findAll('button').find((button) => button.text().includes('创建场景'))
    await createButton!.trigger('click')

    const vm = wrapper.vm as unknown as {
      form: {
        name: string
        entryView: string
        bindings: { alias: string; ref: string; version: string }[]
        widgets: { kind: string; bindingAlias: string }[]
      }
      addWidgetRow: () => void
    }
    vm.form.name = '带展示配置的场景'
    vm.form.bindings[0].ref = 'wf-test-1'
    vm.form.bindings[0].version = '1.0.0'
    vm.form.bindings[0].alias = 'flow'
    vm.form.entryView = 'scenario-overview'
    vm.addWidgetRow()
    vm.form.widgets[0].bindingAlias = 'ghost'

    await wrapper.find('.modal-ok').trigger('click')
    await flushPromises()

    expect(createMock).not.toHaveBeenCalled()
    expect(wrapper.find('.alert').text()).toContain('ghost')

    vm.form.widgets[0].bindingAlias = 'flow'
    await wrapper.find('.modal-ok').trigger('click')
    await flushPromises()

    expect(createMock).toHaveBeenCalledTimes(1)
    const payload = createMock.mock.calls[0][0] as {
      presentation?: { entryView?: string; widgets?: { kind: string; bindingAlias: string }[] }
    }
    expect(payload.presentation).toEqual({
      entryView: 'scenario-overview',
      widgets: [{ kind: 'TABLE', bindingAlias: 'flow' }],
    })
    expect(wrapper.find('textarea').exists()).toBe(false)
  })

  it('钉扎预检：绑定版本为 latest 时前端直接拦截，不调后端', async () => {
    const { wrapper } = mountView()
    await flushPromises()

    const createButton = wrapper.findAll('button').find((button) => button.text().includes('创建场景'))
    await createButton!.trigger('click')

    const vm = wrapper.vm as unknown as {
      form: { name: string; bindings: { type: string; sourceSystem: string; ref: string; version: string }[] }
    }
    vm.form.name = '新测试场景'
    vm.form.bindings[0].ref = 'snap-test-1'
    vm.form.bindings[0].version = 'latest'

    await wrapper.find('.modal-ok').trigger('click')
    await flushPromises()

    expect(createMock).not.toHaveBeenCalled()
    expect(wrapper.find('.alert').text()).toContain('latest')
  })

  it('后端 400 钉扎校验错误在弹窗内联展示且不关窗', async () => {
    createMock.mockRejectedValue(
      new ApiError(400, 'VALIDATION_FAILED', '请求参数校验失败', '/api/v1/scenarios', 'trace-1', {
        'bindings[0].version': '版本必须钉扎精确语义版本 x.y.z（禁止 latest/通配符）',
      }),
    )
    const { wrapper } = mountView()
    await flushPromises()

    const createButton = wrapper.findAll('button').find((button) => button.text().includes('创建场景'))
    await createButton!.trigger('click')

    const vm = wrapper.vm as unknown as {
      form: { name: string; bindings: { type: string; sourceSystem: string; ref: string; version: string }[] }
    }
    vm.form.name = '新测试场景'
    vm.form.bindings[0].ref = 'snap-test-1'
    vm.form.bindings[0].version = '1.0.0'

    await wrapper.find('.modal-ok').trigger('click')
    await flushPromises()

    expect(wrapper.find('.alert').text()).toContain('请求参数校验失败')
  })

  it('列表加载失败时上报错误而不抛出', async () => {
    const pinia = createPinia()
    listMock.mockRejectedValue({ response: { data: { status: 500, code: 'INTERNAL_SERVER_ERROR', message: '服务处理失败', path: '/x' } } })
    mountView(pinia)
    await flushPromises()

    expect(useMessageStore(pinia).feedback?.content).toContain('服务处理失败')
  })
})
