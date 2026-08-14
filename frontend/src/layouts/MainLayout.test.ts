import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { useMessageStore } from '@/stores/message'
import { DEFAULT_TENANT, TENANT_STORAGE_KEY, setTenant, tenantState } from '@/tenant'
import MainLayout from './MainLayout.vue'

const pushMock = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/tasks', meta: { title: '统一任务中心' } }),
  useRouter: () => ({ push: pushMock }),
}))

/** 布局组件 stub：a-select 渲染为原生 select，change 事件回传选择值（模拟租户切换）。 */
const stubs = {
  RouterView: { template: '<div class="router-view" />' },
  'a-layout': { template: '<div><slot /></div>' },
  'a-layout-sider': { template: '<div><slot /></div>' },
  'a-layout-header': { template: '<header><slot /></header>' },
  'a-layout-content': { template: '<div><slot /></div>' },
  'a-menu': { props: ['theme', 'mode', 'selectedKeys'], emits: ['click'], template: '<div><slot /></div>' },
  'a-menu-item': { template: '<div><slot /></div>' },
  'a-alert': { props: ['type', 'message', 'description', 'showIcon', 'closable'], emits: ['close'], template: '<div class="alert"><slot /></div>' },
  'a-select': {
    props: ['value', 'mode', 'options'],
    emits: ['change'],
    template:
      '<select :value="value" @change="$emit(\'change\', $event.target.value)"><option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option></select>',
  },
}

function mountLayout(pinia: Pinia = createPinia()) {
  return mount(
    defineComponent({
      components: { MainLayout },
      template: '<MainLayout />',
    }),
    { global: { plugins: [pinia], stubs } },
  )
}

describe('MainLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    setTenant(DEFAULT_TENANT)
  })

  it('渲染导航与当前租户选择器', async () => {
    const wrapper = mountLayout()
    await flushPromises()

    expect(wrapper.text()).toContain('统一任务中心')
    expect(wrapper.text()).toContain('租户')
    expect(wrapper.find('header select').exists()).toBe(true)
    expect((wrapper.find('header select').element as HTMLSelectElement).value).toBe(DEFAULT_TENANT)
    expect(wrapper.text()).toContain('tenant-a（验收租户 A）')
  })

  it('切换租户更新上下文并持久化', async () => {
    const wrapper = mountLayout()
    await flushPromises()

    await wrapper.find('header select').setValue('tenant-a')

    expect(tenantState.tenantId).toBe('tenant-a')
    expect(window.localStorage.getItem(TENANT_STORAGE_KEY)).toBe('tenant-a')
  })

  it('非法租户输入退回 default 并提示错误', async () => {
    const pinia = createPinia()
    const wrapper = mountLayout(pinia)
    await flushPromises()

    await wrapper.find('header select').setValue('BAD TENANT!')

    expect(tenantState.tenantId).toBe(DEFAULT_TENANT)
    const store = useMessageStore(pinia)
    expect(store.feedback?.content).toContain('租户标识只能包含小写字母、数字与连字符')
  })
})
