import { beforeEach, describe, expect, it, vi } from 'vitest'

import { personalApi } from '@/api/portal'
import { fetchCurrentIdentity } from './identity'

vi.mock('@/api/portal', () => ({
  personalApi: {
    me: vi.fn(),
  },
}))

describe('auth/identity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('成功从 personalApi.me 获取当前主体身份', async () => {
    const mockIdentity = {
      name: 'tester',
      tenantId: 'tenant-a',
      orgId: 'org-1',
      projectId: 'proj-1',
      roles: ['portal-admin'],
      devMode: false,
    }
    vi.mocked(personalApi.me).mockResolvedValue(mockIdentity)

    const identity = await fetchCurrentIdentity()
    expect(identity).toEqual(mockIdentity)
    expect(personalApi.me).toHaveBeenCalledTimes(1)
  })

  it('personalApi.me 失败时返回默认开发主体兜底', async () => {
    vi.mocked(personalApi.me).mockRejectedValue(new Error('Network error'))

    const identity = await fetchCurrentIdentity()
    expect(identity).toEqual({
      name: 'dev-user',
      tenantId: 'default',
      roles: [],
      devMode: true,
    })
  })
})
