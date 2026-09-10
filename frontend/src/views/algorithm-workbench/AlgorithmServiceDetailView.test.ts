import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import AlgorithmServiceDetailView from './AlgorithmServiceDetailView.vue'

const findServiceMock = vi.fn()
const pushMock = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { code: 'tpl-quality-weekly' } }),
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/api/algorithm-workbench', () => ({
  algorithmWorkbenchApi: {
    findService: (...args: unknown[]) => findServiceMock(...args),
  },
}))

const stubs = {
  'a-button': { props: ['type'], emits: ['click'], template: '<button @click="$emit(\'click\')"><slot name="icon" /><slot /></button>' },
  'a-card': { template: '<div><slot /></div>' },
  'a-tag': { template: '<span><slot /></span>' },
  DescriptorRenderer: { template: '<div class="descriptor" />' },
  SkeletonList: { template: '<div class="skeleton" />' },
}

describe('AlgorithmServiceDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findServiceMock.mockResolvedValue({
      code: 'tpl-quality-weekly',
      name: '目标特性提取-周批',
      category: '目标特性提取',
      descriptor: { sections: [] },
    })
  })

  it('提供返回算法列表操作', async () => {
    const wrapper = mount(AlgorithmServiceDetailView, {
      global: { plugins: [createPinia(), i18n], stubs },
    })
    await flushPromises()

    const back = wrapper.findAll('button').find((button) => button.text().includes('返回算法列表'))
    expect(back).toBeDefined()
    await back!.trigger('click')
    expect(pushMock).toHaveBeenCalledWith('/algorithm-workbench')
  })
})
