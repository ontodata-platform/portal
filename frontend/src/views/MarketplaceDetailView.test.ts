import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { marketplaceApi } from '@/api/portal'
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
  'a-modal': { props: ['open', 'title', 'confirmLoading'], emits: ['ok'], template: '<div><slot /></div>' },
  'a-form': { template: '<form><slot /></form>' },
  'a-form-item': { props: ['label', 'extra'], template: '<div><slot /></div>' },
  'a-input': { props: ['value'], emits: ['update:value'], template: '<input :value="value" />' },
}

describe('MarketplaceDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('成功加载数据服务详情并提交申请', async () => {
    vi.mocked(marketplaceApi.find).mockResolvedValue({
      sourceSystem: 'data-platform',
      available: true,
      body: {
        code: 'dsv-test-100',
        name: '测试客户数据服务',
        status: 'ONLINE',
        currentVersion: '1.2.0',
        description: '客户基础特征服务',
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

    expect(wrapper.text()).toContain('测试客户数据服务')
    expect(wrapper.text()).toContain('dsv-test-100')
    expect(wrapper.text()).toContain('v1.2.0')

    // 触发申请
    await (wrapper.vm as unknown as { submitApply: () => Promise<void> }).submitApply()
    await flushPromises()

    expect(marketplaceApi.apply).toHaveBeenCalledWith('dsv-test-100', { grantedColumns: undefined })
    expect(pushMock).toHaveBeenCalledWith('/personal')
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
