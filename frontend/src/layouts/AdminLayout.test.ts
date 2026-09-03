import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import AdminLayout from './AdminLayout.vue'

const pushMock = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/admin/operations' }),
  useRouter: () => ({ push: pushMock }),
}))

const stubs = {
  RouterView: { template: '<div class="admin-child" />' },
  'a-button': { props: ['type'], emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  'a-menu': { props: ['mode', 'selectedKeys'], emits: ['click'], template: '<nav><slot /></nav>' },
  'a-menu-item': { template: '<div class="admin-item"><slot /></div>' },
}

describe('AdminLayout', () => {
  it('渲染管理端标识、二级导航与返回用户视图', async () => {
    const wrapper = mount(AdminLayout, { global: { plugins: [i18n], stubs } })

    expect(wrapper.text()).toContain('管理端')
    expect(wrapper.text()).toContain('运营')
    expect(wrapper.text()).toContain('返回用户视图')

    await wrapper.find('.admin-back').trigger('click')
    expect(pushMock).toHaveBeenCalledWith('/personal')
  })
})
