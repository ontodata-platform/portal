import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import IamAdminView from './IamAdminView.vue'

const usersMock = vi.fn()
const policiesMock = vi.fn()

vi.mock('@/api/portal', () => ({
  adminIamApi: {
    users: (...args: unknown[]) => usersMock(...args),
    policies: (...args: unknown[]) => policiesMock(...args),
  },
}))

const stubs = {
  PageHeader: {
    props: ['eyebrow', 'title', 'description'],
    template: '<header class="page-header"><h1>{{ title }}</h1></header>',
  },
  'a-card': { props: ['title'], template: '<section><h2>{{ title }}</h2><slot /></section>' },
  'a-table': {
    props: ['columns', 'dataSource', 'loading', 'rowKey'],
    template:
      '<div class="table"><div v-for="record in dataSource" :key="record.id || record.entry" class="table-row">{{ record.name }} {{ record.username }} {{ record.entry }} {{ Array.isArray(record.roles) ? record.roles.join(\' \') : record.roles }}<slot name="bodyCell" :column="{ key: \'name\' }" :record="record" /><slot name="bodyCell" :column="{ key: \'roles\' }" :record="record" /></div></div>',
  },
  'a-space': { template: '<div><slot /></div>' },
  'a-button': { props: ['type', 'href', 'target'], template: '<a :href="href"><slot /></a>' },
  'a-input': { props: ['value'], emits: ['update:value'], template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />' },
  'a-tag': { props: ['color'], template: '<span><slot /></span>' },
}

function mountView() {
  return mount(IamAdminView, {
    global: { plugins: [createPinia(), i18n], stubs },
  })
}

describe('IamAdminView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usersMock.mockResolvedValue({
      total: 2,
      items: [
        { id: 'u-chen', name: '陈晓', username: 'chenxiao', tenantId: 'default', roles: ['operator'], status: 'ACTIVE' },
        { id: 'u-alice', name: 'alice', username: 'alice', tenantId: 'default', roles: ['user'], status: 'ACTIVE' },
      ],
    })
    policiesMock.mockResolvedValue({
      items: [{ id: 'p-1', name: '管理端', resource: '/admin/**', action: 'access', effect: 'PERMIT', roles: ['portal-admin'] }],
    })
  })

  it('渲染用户列表、角色矩阵与 Keycloak 只读跳转', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(usersMock).toHaveBeenCalled()
    expect(policiesMock).toHaveBeenCalled()
    expect(wrapper.find('.page-header').exists()).toBe(false)
    expect(wrapper.text()).toContain('陈晓')
    expect(wrapper.text()).toContain('alice')
    expect(wrapper.text()).toContain('登录用户')
    expect(wrapper.text()).toContain('portal-admin')
    expect(wrapper.html()).toContain('http://localhost:8180/admin/master/console/')
    expect(wrapper.text()).not.toContain('新增用户')
    expect(wrapper.text()).not.toContain('分配角色')
  })
})
