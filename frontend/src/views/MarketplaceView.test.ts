import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { i18n } from '@/i18n'
import MarketplaceView from './MarketplaceView.vue'

const dataServicesMock = vi.fn()
const pushMock = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/api/portal', () => ({
  marketplaceApi: {
    dataServices: (...args: unknown[]) => dataServicesMock(...args),
  },
}))

const stubs = {
  'a-card': { template: '<div><slot /></div>' },
  'a-table': { props: ['columns', 'dataSource', 'loading', 'rowKey', 'pagination', 'customRow'], template: '<div class="table"><slot /></div>' },
  'a-space': { template: '<div><slot /></div>' },
  'a-button': { props: ['type', 'size', 'ghost'], emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  'a-tag': { props: ['color'], template: '<span class="tag"><slot /></span>' },
  'a-alert': { props: ['type', 'showIcon', 'message', 'description'], template: '<div class="alert"><slot />{{ message }}</div>' },
  'a-input-search': { props: ['value'], emits: ['update:value', 'search'], template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />' },
  'a-pagination': { template: '<div class="pager" />' },
  MarketServiceCard: { props: ['item'], template: '<div class="market-card">{{ item.name }}</div>' },
  SkeletonList: { template: '<div class="skel" />' },
}

function mountView() {
  return mount(
    defineComponent({
      components: { MarketplaceView },
      template: '<MarketplaceView />',
    }),
    { global: { plugins: [createPinia(), i18n], stubs } },
  )
}

describe('MarketplaceView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('上游可用时透传目录条目', async () => {
    dataServicesMock.mockResolvedValue({
      sourceSystem: 'data-platform',
      available: true,
      body: {
        total: 1,
        items: [{ code: 'dsv-12345678', name: '高分光学影像服务', status: 'ACTIVE', currentVersion: 1 }],
      },
    })
    const wrapper = mountView()
    await flushPromises()

    expect(dataServicesMock).toHaveBeenCalledWith({ page: 1, size: 20, keyword: undefined })
    expect(wrapper.find('.alert').exists()).toBe(false)
  })

  it('上游不可用时展示降级提示（不阻断页面）', async () => {
    dataServicesMock.mockResolvedValue({
      sourceSystem: 'data-platform',
      available: false,
      message: '管理平台数据服务目录不可用：返回错误（500）',
    })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('.alert').exists()).toBe(true)
    expect(wrapper.text()).toContain('管理平台数据服务目录不可用')
  })
})
