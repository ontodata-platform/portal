import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { i18n } from '@/i18n'
import SearchView from './SearchView.vue'

const catalogSearchMock = vi.fn()
const pushMock = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/api/agent', () => ({
  agentApi: {
    catalogSearch: (...args: unknown[]) => catalogSearchMock(...args),
  },
}))

const stubs = {
  'a-card': { template: '<div><slot /></div>' },
  'a-space': { template: '<div><slot /></div>' },
  'a-input-search': {
    props: ['value', 'placeholder'],
    emits: ['update:value', 'search'],
    template:
      '<input class="search-input" :value="value" :placeholder="placeholder" @input="$emit(\'update:value\', $event.target.value)" @keyup.enter="$emit(\'search\', value)" />',
  },
  'a-select': {
    props: ['value', 'options', 'allowClear'],
    emits: ['update:value'],
    template: '<select class="kind-select" :value="value" @change="$emit(\'update:value\', $event.target.value)"><slot /></select>',
  },
  'a-select-option': { props: ['value'], template: '<option :value="value"><slot /></option>' },
  'a-list': {
    props: ['dataSource', 'loading'],
    template: '<div class="hit-list"><div v-for="item in dataSource" :key="item.id" class="hit-item"><slot name="renderItem" :item="item" /></div></div>',
  },
  'a-list-item': { emits: ['click'], template: '<div class="hit" @click="$emit(\'click\')"><slot /></div>' },
  'a-list-item-meta': { props: ['title', 'description'], template: '<div><div class="hit-title">{{ title }}</div><div class="hit-desc">{{ description }}</div></div>' },
  'a-tag': { props: ['color'], template: '<span class="tag"><slot /></span>' },
  'a-empty': { props: ['description'], template: '<div class="empty">{{ description }}</div>' },
  'a-alert': { props: ['type', 'showIcon', 'message'], template: '<div class="alert">{{ message }}</div>' },
  PageHeader: { props: ['title', 'description'], template: '<header>{{ title }}</header>' },
  EmptyState: { props: ['title'], template: '<div class="empty">{{ title }}</div>' },
  ErrorState: { props: ['reason'], template: '<div class="error">{{ reason }}</div>' },
}

function mountView() {
  return mount(
    defineComponent({
      components: { SearchView },
      template: '<SearchView />',
    }),
    { global: { plugins: [createPinia(), i18n], stubs } },
  )
}

describe('SearchView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    catalogSearchMock.mockResolvedValue({
      hits: [
        {
          kind: 'data_asset',
          id: 'dsv-a1',
          title: '高分光学影像',
          snippet: '东海示范区光学影像',
          classification: 'INTERNAL',
          source: 'data-platform',
        },
        {
          kind: 'workflow',
          id: 'wf-b2',
          title: '风险编排',
          snippet: '多模态分析',
          classification: 'INTERNAL',
          source: 'recombine',
        },
      ],
    })
  })

  it('提交关键词后调用 catalog/search 并展示命中', async () => {
    const wrapper = mountView()
    const view = wrapper.findComponent(SearchView)
    ;(view.vm as unknown as { query: { q: string } }).query.q = '高分'
    await (view.vm as unknown as { search: () => Promise<void> }).search()
    await flushPromises()

    expect(catalogSearchMock).toHaveBeenCalledWith({ q: '高分', kind: undefined, limit: 20 })
    expect(wrapper.text()).toContain('高分光学影像')
    expect(wrapper.text()).toContain('风险编排')
  })

  it('空关键词不发请求', async () => {
    const wrapper = mountView()
    const view = wrapper.findComponent(SearchView)
    await (view.vm as unknown as { search: () => Promise<void> }).search()
    await flushPromises()

    expect(catalogSearchMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('输入关键词后检索跨域目录')
  })

  it('点击数据资产命中进入商城详情', async () => {
    const wrapper = mountView()
    const view = wrapper.findComponent(SearchView)
    ;(view.vm as unknown as { query: { q: string } }).query.q = '高分'
    await (view.vm as unknown as { search: () => Promise<void> }).search()
    await flushPromises()

    ;(view.vm as unknown as { openHit: (hit: { kind: string; id: string }) => void }).openHit({
      kind: 'data_asset',
      id: 'dsv-a1',
    })
    expect(pushMock).toHaveBeenCalledWith('/data-workbench/dsv-a1')
  })
})
