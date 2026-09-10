import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_IDENTITY, fetchCurrentIdentity } from '@/auth/identity'
import { useIdentityStore } from '@/stores/identity'

vi.mock('@/auth/identity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/identity')>()
  return { ...actual, fetchCurrentIdentity: vi.fn() }
})

describe('useIdentityStore 角色切换（A6-6）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('currentRole 取 roles 队首', () => {
    const store = useIdentityStore()
    store.setIdentity({ name: '陈晓', tenantId: 'demo', roles: ['user', 'operator'], devMode: true })
    expect(store.currentRole).toBe('user')
  })

  it('switchRole 把所选角色移到队首并保持其余顺序', () => {
    const store = useIdentityStore()
    store.setIdentity({ name: '陈晓', tenantId: 'demo', roles: ['user', 'operator', 'approver'], devMode: true })

    store.switchRole('operator')

    expect(store.roles).toEqual(['operator', 'user', 'approver'])
    expect(store.currentRole).toBe('operator')
  })

  it('switchRole 对不存在或已是当前的角色保持不变', () => {
    const store = useIdentityStore()
    store.setIdentity({ name: '陈晓', tenantId: 'demo', roles: ['user', 'operator'], devMode: true })

    store.switchRole('ghost')
    expect(store.roles).toEqual(['user', 'operator'])

    store.switchRole('user')
    expect(store.roles).toEqual(['user', 'operator'])
  })

  it('切换不携带 devMode 之外的副作用：身份其余字段原样保留', () => {
    const store = useIdentityStore()
    store.setIdentity({ name: '陈晓', tenantId: 'demo', roles: ['user', 'operator'], devMode: true })

    store.switchRole('operator')

    expect(store.identity).toMatchObject({ name: '陈晓', tenantId: 'demo', devMode: true })
    expect(DEFAULT_IDENTITY.roles).toEqual([])
    expect(vi.mocked(fetchCurrentIdentity)).not.toHaveBeenCalled()
  })
})
