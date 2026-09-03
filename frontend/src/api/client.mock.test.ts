import { describe, expect, it, vi } from 'vitest'

vi.mock('@/mocks/localMode', () => ({ useLocalMock: true }))

import { approvalApi, personalApi, workbenchApi } from './portal'

describe('portal API local mock transport', () => {
  it('uses the same public API adapters without opening a network connection', async () => {
    const identity = await personalApi.me()
    expect(identity).toMatchObject({ name: '陈晓', tenantId: 'default' })

    const approvals = await approvalApi.list({ page: 1, size: 10, status: 'PENDING' })
    expect(approvals.items.length).toBeGreaterThanOrEqual(2)

    const templates = await workbenchApi.workflowTemplates({ page: 1, size: 10 })
    expect(templates.available).toBe(true)
  })
})
