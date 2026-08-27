import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { personalApi } from '@/api/portal'
import { i18n, setLocale } from '@/i18n'
import MainLayout from './MainLayout.vue'

const pushMock = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/tasks', meta: { titleKey: 'menu.tasks' } }),
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/api/portal', () => ({
  personalApi: {
    me: vi.fn(),
  },
}))

const stubs = {
  RouterView: { template: '<div class="router-view" />' },
  'a-layout': { template: '<div><slot /></div>' },
  'a-layout-sider': { props: ['collapsed', 'collapsible', 'theme', 'width'], template: '<div><slot /></div>' },
  'a-layout-header': { template: '<header><slot /></header>' },
  'a-layout-content': { template: '<div><slot /></div>' },
  'a-menu': { props: ['theme', 'mode', 'selectedKeys'], emits: ['click'], template: '<div><slot /></div>' },
  'a-menu-item-group': { props: ['title'], template: '<div><div class="group-title">{{ title }}</div><slot /></div>' },
  'a-menu-item': { template: '<div class="menu-item"><slot /></div>' },
  'a-button': { props: ['type'], emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  'a-tag': { props: ['color'], template: '<span class="tag"><slot /></span>' },
  'a-alert': { props: ['type', 'message', 'description', 'showIcon', 'closable'], emits: ['close'], template: '<div class="alert"><slot /></div>' },
  'a-select': {
    props: ['value', 'mode', 'options'],
    emits: ['change'],
    template:
      '<select :value="value" @change="$emit(\'change\', $event.target.value)"><option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option></select>',
  },
}

function mountLayout(pinia = createPinia()) {
  return mount(MainLayout, { global: { plugins: [pinia, i18n], stubs } })
}

describe('MainLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    setLocale('zh-CN')
    vi.mocked(personalApi.me).mockResolvedValue({
      name: 'dev-user',
      tenantId: 'default',
      roles: [],
      devMode: true,
    })
  })

  it('渲染分组导航与主体身份信息', async () => {
    const wrapper = mountLayout()
    await flushPromises()

    expect(wrapper.text()).toContain('统一任务中心')
    expect(wrapper.text()).toContain('个人工作台')
    expect(wrapper.text()).toContain('数据商城')
    expect(wrapper.text()).toContain('dev-user')
    expect(wrapper.text()).toContain('default')
    expect(wrapper.text()).toContain('开发模式')
  })

  it('非 operator/admin 且 devMode=false 时隐藏门户运营菜单', async () => {
    vi.mocked(personalApi.me).mockResolvedValue({
      name: 'normal-user',
      tenantId: 'tenant-a',
      roles: ['portal-user'],
      devMode: false,
    })

    const wrapper = mountLayout()
    await flushPromises()

    expect(wrapper.text()).not.toContain('门户运营')
  })

  it('具备 operator 角色时展示门户运营菜单', async () => {
    vi.mocked(personalApi.me).mockResolvedValue({
      name: 'admin-user',
      tenantId: 'tenant-a',
      roles: ['portal-admin'],
      devMode: false,
    })

    const wrapper = mountLayout()
    await flushPromises()

    expect(wrapper.text()).toContain('门户运营')
  })

  it('切换语言即时生效并持久化（M5 国际化）', async () => {
    const wrapper = mountLayout()
    await flushPromises()
    expect(wrapper.text()).toContain('统一任务中心')

    await wrapper.find('select.locale-select').setValue('en-US')
    await flushPromises()

    expect(wrapper.text()).toContain('Unified Task Center')
    expect(window.localStorage.getItem('ontodata.locale')).toBe('en-US')
  })
})
