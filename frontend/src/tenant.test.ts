import { beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_TENANT,
  TENANT_STORAGE_KEY,
  isValidTenant,
  loadTenant,
  setTenant,
  tenantState,
} from './tenant'

describe('租户上下文', () => {
  beforeEach(() => {
    window.localStorage.clear()
    tenantState.tenantId = DEFAULT_TENANT
  })

  it('租户标识校验与后端一致：小写字母/数字/连字符 1-64 位', () => {
    expect(isValidTenant('default')).toBe(true)
    expect(isValidTenant('tenant-a')).toBe(true)
    expect(isValidTenant('a-1')).toBe(true)
    expect(isValidTenant('a'.repeat(64))).toBe(true)
    expect(isValidTenant('')).toBe(false)
    expect(isValidTenant('BAD TENANT!')).toBe(false)
    expect(isValidTenant('UPPER')).toBe(false)
    expect(isValidTenant('a'.repeat(65))).toBe(false)
  })

  it('setTenant 更新响应式状态并持久化，刷新后 loadTenant 恢复', () => {
    expect(setTenant('tenant-a')).toBe('tenant-a')
    expect(tenantState.tenantId).toBe('tenant-a')
    expect(window.localStorage.getItem(TENANT_STORAGE_KEY)).toBe('tenant-a')
    expect(loadTenant()).toBe('tenant-a')
  })

  it('非法租户切换退回缺省租户 default', () => {
    setTenant('tenant-a')
    expect(setTenant('BAD TENANT!')).toBe(DEFAULT_TENANT)
    expect(tenantState.tenantId).toBe(DEFAULT_TENANT)
  })

  it('持久化中残留非法值（如手工篡改）时 loadTenant 退回 default', () => {
    window.localStorage.setItem(TENANT_STORAGE_KEY, 'NOT VALID!')
    expect(loadTenant()).toBe(DEFAULT_TENANT)
  })
})
