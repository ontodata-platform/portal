import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import AlgorithmWorkbenchView from './AlgorithmWorkbenchView.vue'

const listServicesMock = vi.fn()
const listCategoriesMock = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({
    currentRoute: { value: { query: {} } },
    push: vi.fn(),
  }),
}))

vi.mock('@/api/algorithm-workbench', () => ({
  algorithmWorkbenchApi: {
    listServices: (...args: unknown[]) => listServicesMock(...args),
    listCategories: (...args: unknown[]) => listCategoriesMock(...args),
    listMyRuns: vi.fn(),
    rerun: vi.fn(),
    cancel: vi.fn(),
  },
}))

const stubs = {
  'a-card': { template: '<div><slot /></div>' },
  'a-tabs': { template: '<div><slot /></div>' },
  'a-tab-pane': { template: '<div><slot /></div>' },
  'a-tag': { props: ['color'], template: '<span><slot /></span>' },
  'a-input': { template: '<input />' },
  'a-button': { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  'a-spin': { template: '<div><slot /></div>' },
  'a-progress': { template: '<div />' },
  'a-table': { template: '<div><slot /></div>' },
  'a-space': { template: '<div><slot /></div>' },
  'a-alert': { template: '<div><slot /></div>' },
  'a-timeline': { template: '<div><slot /></div>' },
  'a-timeline-item': { template: '<div><slot /></div>' },
  'a-descriptions': { template: '<div><slot /></div>' },
  'a-descriptions-item': { template: '<div><slot /></div>' },
}

describe('AlgorithmWorkbenchView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listServicesMock.mockResolvedValue({ total: 0, items: [] })
    listCategoriesMock.mockResolvedValue(['质量分析', '预测'])
  })

  it('分类筛选以可聚焦按钮呈现，并用所选分类重新加载服务', async () => {
    const wrapper = mount(AlgorithmWorkbenchView, {
      global: { plugins: [createPinia(), i18n], stubs },
    })
    await flushPromises()

    const forecast = wrapper.findAll('button.category-filter').find((button) => button.text() === '预测')
    expect(forecast).toBeDefined()
    expect(forecast!.attributes('aria-pressed')).toBe('false')

    await forecast!.trigger('click')
    await flushPromises()

    expect(listServicesMock).toHaveBeenLastCalledWith({
      page: 1,
      size: 20,
      keyword: undefined,
      category: '预测',
    })
    expect(forecast!.attributes('aria-pressed')).toBe('true')
  })
})
