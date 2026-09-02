import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { personalApi } from '@/api/portal'
import { i18n, setLocale } from '@/i18n'
import MainLayout from './MainLayout.vue'

const pushMock = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/assistant', meta: { titleKey: 'menu.assistant' } }),
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/api/portal', () => ({
  personalApi: {
    me: vi.fn(),
    unreadCount: vi.fn(),
  },
}))

const stubs = {
  RouterView: { template: '<div class="router-view" />' },
  'a-layout': { template: '<div><slot /></div>' },
  'a-layout-sider': { props: ['collapsed', 'collapsible', 'theme', 'width'], template: '<div class="sider"><slot /></div>' },
  'a-layout-header': { template: '<header><slot /></header>' },
  'a-layout-content': { template: '<div><slot /></div>' },
  'a-menu': { props: ['theme', 'mode', 'selectedKeys'], emits: ['click'], template: '<div><slot /></div>' },
  'a-menu-item': { template: '<div class="menu-item"><slot /></div>' },
  'a-button': { props: ['type'], emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  'a-tag': { props: ['color'], template: '<span class="tag"><slot /></span>' },
  'a-alert': { props: ['type', 'message', 'description', 'showIcon', 'closable'], emits: ['close'], template: '<div class="alert"><slot /></div>' },
  'a-input': {
    props: ['value', 'placeholder'],
    emits: ['update:value', 'focus', 'pressEnter'],
    template:
      '<input class="global-search" :value="value" :placeholder="placeholder" @input="$emit(\'update:value\', $event.target.value)" @focus="$emit(\'focus\')" @keydown.enter="$emit(\'pressEnter\')" />',
  },
  'a-badge': { props: ['count'], template: '<div class="badge" :data-count="count"><slot /></div>' },
  'a-avatar': { template: '<span class="avatar"><slot /></span>' },
  'a-dropdown': { template: '<div class="dropdown"><slot /><slot name="overlay" /></div>' },
  'a-select': {
    props: ['value', 'mode', 'options'],
    emits: ['change'],
    template:
      '<select class="locale-select" :value="value" @change="$emit(\'change\', $event.target.value)"><option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option></select>',
  },
}

function mountLayout(pinia = createPinia()) {
  return mount(MainLayout, { global: { plugins: [pinia, i18n], stubs } })
}

describe('MainLayout v2', () => {
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
    vi.mocked(personalApi.unreadCount).mockResolvedValue({ unread: 3 })
  })

  it('侧栏仅 4 个用户入口，开发模式显示管理端，不展示开发模式字样', async () => {
    const wrapper = mountLayout()
    await flushPromises()

    expect(wrapper.text()).toContain('智能服务')
    expect(wrapper.text()).toContain('个人工作台')
    expect(wrapper.text()).toContain('数据工作台')
    expect(wrapper.text()).toContain('算法工作台')
    expect(wrapper.text()).toContain('管理端')
    expect(wrapper.text()).not.toContain('统一任务中心')
    expect(wrapper.text()).not.toContain('开发模式')
    expect(wrapper.text()).toContain('dev-user')
  })

  it('非 operator/admin 且 devMode=false 时隐藏管理端入口', async () => {
    vi.mocked(personalApi.me).mockResolvedValue({
      name: 'normal-user',
      tenantId: 'tenant-a',
      roles: ['portal-user'],
      devMode: false,
    })

    const wrapper = mountLayout()
    await flushPromises()

    expect(wrapper.text()).not.toContain('管理端')
    expect(wrapper.text()).toContain('智能服务')
  })

  it('具备 portal-admin 角色时展示管理端入口', async () => {
    vi.mocked(personalApi.me).mockResolvedValue({
      name: 'admin-user',
      tenantId: 'tenant-a',
      roles: ['portal-admin'],
      devMode: false,
    })

    const wrapper = mountLayout()
    await flushPromises()

    expect(wrapper.text()).toContain('管理端')
  })

  it('铃铛展示未读数，点击进入通知签页', async () => {
    const wrapper = mountLayout()
    await flushPromises()

    expect(wrapper.find('.badge').attributes('data-count')).toBe('3')
    await wrapper.find('.bell button').trigger('click')
    expect(pushMock).toHaveBeenCalledWith('/personal/notifications')
  })

  it('聚焦搜索跳转到智能服务并带入关键词', async () => {
    const wrapper = mountLayout()
    await flushPromises()
    const input = wrapper.find('input.global-search')
    await input.setValue('客户主数据')
    await input.trigger('focus')
    expect(pushMock).toHaveBeenCalledWith({ path: '/assistant', query: { q: '客户主数据' } })
  })

  it('切换语言即时生效并持久化（M5 国际化）', async () => {
    const wrapper = mountLayout()
    await flushPromises()
    expect(wrapper.text()).toContain('智能服务')

    await wrapper.find('select.locale-select').setValue('en-US')
    await flushPromises()

    expect(wrapper.text()).toContain('Intelligent Service')
    expect(window.localStorage.getItem('ontodata.locale')).toBe('en-US')
  })
})
