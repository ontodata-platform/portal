import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { marketplaceApi } from '@/api/portal'
import ApplyWizardModal from '@/components/data-workbench/ApplyWizardModal.vue'
import { i18n } from '@/i18n'
import MarketplaceDetailView from './MarketplaceDetailView.vue'

const pushMock = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { code: 'dsv-test-100' } }),
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/api/portal', () => ({
  marketplaceApi: {
    find: vi.fn(),
    apply: vi.fn(),
  },
}))

const stubs = {
  'a-card': { template: '<div class="card"><slot name="title" /><slot /></div>' },
  'a-spin': { props: ['spinning'], template: '<div><slot /></div>' },
  'a-alert': { props: ['type', 'message', 'description', 'showIcon'], template: '<div class="alert">{{ message }} {{ description }}</div>' },
  'a-space': { template: '<div><slot /></div>' },
  'a-button': { props: ['type', 'size', 'disabled'], emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  'a-tag': { props: ['color'], template: '<span class="tag"><slot /></span>' },
  'a-divider': { template: '<hr />' },
  'a-descriptions': { props: ['title', 'bordered', 'column', 'size'], template: '<div class="descriptions"><slot /></div>' },
  'a-descriptions-item': { props: ['label', 'span'], template: '<div class="desc-item">{{ label }}: <slot /></div>' },
  'a-empty': { props: ['description'], template: '<div>{{ description }}</div>' },
  'a-modal': { props: ['open', 'title', 'confirmLoading'], template: '<div v-if="open"><slot /><slot name="footer" /></div>' },
  'a-form': { template: '<form><slot /></form>' },
  'a-form-item': { props: ['label', 'extra'], template: '<div><slot /></div>' },
  'a-input': { props: ['value'], emits: ['update:value'], template: '<input :value="value" />' },
  'a-table': { props: ['columns', 'dataSource'], template: '<div class="table" />' },
  'a-steps': { template: '<div><slot /></div>' },
  'a-step': { props: ['title'], template: '<div>{{ title }}</div>' },
}

describe('MarketplaceDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('成功加载数据服务详情并提交申请后停留本页刷新', async () => {
    vi.mocked(marketplaceApi.find).mockResolvedValue({
      sourceSystem: 'data-platform',
      available: true,
      body: {
        code: 'dsv-test-100',
        name: '高分光学影像服务',
        status: 'ONLINE',
        currentVersion: '1.2.0',
        description: '东海示范区光学影像服务',
        descriptor: {
          overview: '东海示范区光学影像服务，按周更发布。',
          fieldSpecs: [{ name: 'scene_id', type: 'string', desc: '景号' }],
          sample: { columns: ['scene_id'], rows: [{ scene_id: 'GF1-001' }] },
          updateCycle: '周更',
          applyRequirements: ['密级：内部，登录门户即可申请'],
          delivery: { formats: ['GeoTIFF', 'CSV'], channel: '门户订阅签页在线领取', sla: '周更窗口关闭后 1 个工作日可申请' },
        },
      },
    })
    vi.mocked(marketplaceApi.apply).mockResolvedValue({
      approvalCode: 'apr-data-001',
      status: 'PENDING',
    })

    const wrapper = mount(MarketplaceDetailView, {
      global: { plugins: [createPinia(), i18n], stubs },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('高分光学影像服务')
    expect(wrapper.text()).toContain('dsv-test-100')
    expect(wrapper.text()).toContain('v1.2.0')
    expect(wrapper.text()).toContain('数据信息')
    expect(wrapper.text()).toContain('字段与口径')
    expect(wrapper.text()).toContain('数据样例')
    expect(wrapper.text()).toContain('申请条件')
    expect(wrapper.text()).toContain('交付方式')
    expect(wrapper.text()).toContain('密级：内部，登录门户即可申请')

    const applyButton = wrapper.findAll('button').find((button) => button.text().includes('填写申请'))
    expect(applyButton).toBeTruthy()
    await applyButton!.trigger('click')

    const wizard = wrapper.findComponent(ApplyWizardModal)
    await wizard.vm.submitApply()
    await flushPromises()

    expect(marketplaceApi.apply).toHaveBeenCalledWith('dsv-test-100', {
      grantedColumns: ['scene_id'],
      useIntent: expect.objectContaining({ deliveryFrequency: 'ONCE' }),
    })
    expect(pushMock).not.toHaveBeenCalled()
    expect(marketplaceApi.find).toHaveBeenCalledTimes(2)
  })

  it('上游不可用时展示降级警告', async () => {
    vi.mocked(marketplaceApi.find).mockResolvedValue({
      sourceSystem: 'data-platform',
      available: false,
      message: '管理平台服务异常',
    })

    const wrapper = mount(MarketplaceDetailView, {
      global: { plugins: [createPinia(), i18n], stubs },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('管理平台服务异常')
  })

  it('详情 404 展示本页空态且不上抛全局错误条', async () => {
    const { ApiError } = await import('@/api/client')
    const { useMessageStore } = await import('@/stores/message')
    vi.mocked(marketplaceApi.find).mockRejectedValue(new ApiError(404, 'NOT_FOUND', '未找到对应资源', '/marketplace/data-services/x', 'mock-not-found'))

    const pinia = createPinia()
    const wrapper = mount(MarketplaceDetailView, {
      global: { plugins: [pinia, i18n], stubs },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('未找到这条数据')
    expect(useMessageStore(pinia).feedback).toBeNull()
  })
})
