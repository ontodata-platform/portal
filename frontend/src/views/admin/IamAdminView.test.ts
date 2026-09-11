import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import IamAdminView from './IamAdminView.vue'

const usersMock = vi.fn()
const policiesMock = vi.fn()
const rolesMock = vi.fn()
const auditLogsMock = vi.fn()
const updateUserRolesMock = vi.fn()
const updateUserStatusMock = vi.fn()

vi.mock('@/api/portal', () => ({
  adminIamApi: {
    users: (...args: unknown[]) => usersMock(...args),
    policies: (...args: unknown[]) => policiesMock(...args),
    roles: (...args: unknown[]) => rolesMock(...args),
    auditLogs: (...args: unknown[]) => auditLogsMock(...args),
    updateUserRoles: (...args: unknown[]) => updateUserRolesMock(...args),
    updateUserStatus: (...args: unknown[]) => updateUserStatusMock(...args),
  },
}))

const stubs = {
  'a-card': { props: ['title'], template: '<section><h2>{{ title }}</h2><slot /></section>' },
  'a-tabs': { template: '<div><slot /></div>' },
  'a-tab-pane': { props: ['tab'], template: '<div class="tab-pane"><span class="tab-label">{{ tab }}</span><slot /></div>' },
  'a-table': {
    props: ['columns', 'dataSource', 'loading', 'rowKey'],
    template:
      '<div class="table"><div v-for="record in dataSource" :key="record.id || record.code || record.entry" class="table-row">{{ record.name }} {{ record.username }} {{ record.entry }} {{ Array.isArray(record.roles) ? record.roles.join(\' \') : record.roles }}<slot name="bodyCell" :column="{ key: \'name\' }" :record="record" /><slot name="bodyCell" :column="{ key: \'role\' }" :record="record" /><slot name="bodyCell" :column="{ key: \'roles\' }" :record="record" /><slot name="bodyCell" :column="{ key: \'permissions\' }" :record="record" /><slot name="bodyCell" :column="{ key: \'status\' }" :record="record" /><slot name="bodyCell" :column="{ key: \'action\' }" :record="record" /></div></div>',
  },
  'a-space': { template: '<div><slot /></div>' },
  'a-button': { props: ['type', 'loading', 'danger'], emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  'a-input': { props: ['value'], emits: ['update:value'], template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />' },
  'a-select': { props: ['value', 'options'], emits: ['update:value'], template: '<select :value="value" @change="$emit(\'update:value\', $event.target.value)"><slot /></select>' },
  'a-select-option': { props: ['value'], template: '<option :value="value"><slot /></option>' },
  'a-tag': { props: ['color'], template: '<span><slot /></span>' },
  'a-modal': { props: ['open', 'title'], emits: ['ok'], template: '<section v-if="open" class="modal" v-bind="$attrs"><slot /><button class="modal-ok" @click="$emit(\'ok\')">确认</button></section>' },
  'a-drawer': { props: ['open', 'title'], template: '<section v-if="open" class="drawer"><slot /><slot name="footer" /></section>' },
  'a-form': { template: '<form><slot /></form>' },
  'a-form-item': { props: ['label'], template: '<div><slot /></div>' },
  'a-checkbox-group': { name: 'ACheckboxGroup', props: ['value'], emits: ['update:value'], template: '<div class="checkbox-group"><slot /></div>' },
  'a-checkbox': { props: ['value'], template: '<label><input type="checkbox" :value="value" /><slot /></label>' },
  'a-descriptions': { template: '<div><slot /></div>' },
  'a-descriptions-item': { props: ['label'], template: '<div><slot /></div>' },
  'a-divider': { template: '<div><slot /></div>' },
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
    rolesMock.mockResolvedValue({
      items: [
        { code: 'user', description: '使用门户、数据与算法工作台。', permissions: ['PORTAL.ACCESS'] },
        { code: 'operator', description: '处理需求并运营门户内容。', permissions: ['REQUIREMENT.HANDLE', 'NOTICE.MANAGE'] },
        { code: 'portal-admin', description: '管理用户、角色与访问策略。', permissions: ['IAM.MANAGE_USERS', 'IAM.VIEW_POLICIES'] },
        { code: 'data-manager', description: '负责数据服务供给与交付。', permissions: ['DATA.MANAGE'] },
      ],
    })
    auditLogsMock.mockResolvedValue({ items: [] })
    updateUserRolesMock.mockResolvedValue({ id: 'u-chen', roles: ['user', 'data-manager'] })
    updateUserStatusMock.mockResolvedValue({ id: 'u-chen', status: 'DISABLED' })
  })

  it('渲染用户、角色和权限全景，不再显示外部身份管理入口', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(usersMock).toHaveBeenCalled()
    expect(policiesMock).toHaveBeenCalled()
    expect(rolesMock).toHaveBeenCalled()
    expect(auditLogsMock).toHaveBeenCalled()
    expect(wrapper.find('.page-header').exists()).toBe(false)
    expect(wrapper.text()).toContain('陈晓')
    expect(wrapper.text()).toContain('alice')
    expect(wrapper.text()).toContain('角色')
    expect(wrapper.text()).toContain('访问策略（数据规则）')
    expect(wrapper.text()).toContain('portal-admin')
    expect(wrapper.find('.keycloak-card').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('8180')
  })

  it('可在本地模拟中配置用户角色并启停用户', async () => {
    const wrapper = mountView()
    await flushPromises()

    const configureRoles = wrapper.findAll('button').find((button) => button.text() === '配置角色')
    expect(configureRoles).toBeTruthy()
    await configureRoles!.trigger('click')
    const roleGroup = wrapper.findComponent({ name: 'ACheckboxGroup' })
    await roleGroup.vm.$emit('update:value', ['user', 'data-manager'])
    await wrapper.find('.modal-ok').trigger('click')
    await flushPromises()
    expect(updateUserRolesMock).toHaveBeenCalledWith('u-chen', { roles: ['user', 'data-manager'] })

    const disable = wrapper.findAll('button').find((button) => button.text() === '停用')
    expect(disable).toBeTruthy()
    await disable!.trigger('click')
    await flushPromises()
    expect(updateUserStatusMock).toHaveBeenCalledWith('u-chen', 'DISABLED')
  })
})
