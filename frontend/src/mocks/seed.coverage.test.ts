import { describe, expect, it } from 'vitest'

import { createAlgorithmWorkbenchMockApi } from './algorithmWorkbenchMockApi'
import { createDataWorkbenchMockApi } from './dataWorkbenchMockApi'
import { createPortalMockApi } from './portalMockApi'
import {
  seedAlgorithms,
  seedDataServices,
  seedDatasets,
  seedFeedbacks,
  seedNotices,
  seedNotifications,
  seedResults,
  seedUsers,
} from './seed'

const DAY = 24 * 3600e3
const REQUIREMENT_STATUSES = ['OPEN', 'ANALYZING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'] as const
const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'] as const
const SLA_STATES = ['MET', 'ON_TIME', 'DUE_SOON', 'OVERDUE'] as const
const RUN_STATUSES = ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'] as const

function assertRecent(iso: string) {
  const age = Date.now() - new Date(iso).getTime()
  expect(age, iso).toBeGreaterThanOrEqual(-60_000)
  expect(age, iso).toBeLessThanOrEqual(30 * DAY + 60_000)
}

describe('演示数据量与状态覆盖（§A1-2）', () => {
  it('种子数量达到设计下限', () => {
    expect(seedUsers.length).toBeGreaterThanOrEqual(10)
    expect(seedDataServices.length).toBeGreaterThanOrEqual(12)
    expect(seedDatasets.length).toBeGreaterThanOrEqual(15)
    expect(seedAlgorithms.length).toBeGreaterThanOrEqual(8)
    expect(seedNotices.length).toBeGreaterThanOrEqual(6)
    expect(seedFeedbacks.length).toBeGreaterThanOrEqual(5)
    expect(seedNotifications.length).toBeGreaterThanOrEqual(8)
    expect(seedResults.length).toBeGreaterThanOrEqual(10)
  })

  it('需求/审批/运行状态机全覆盖，列表达到演示密度', async () => {
    const portal = createPortalMockApi()
    const algo = createAlgorithmWorkbenchMockApi()
    const data = createDataWorkbenchMockApi()

    const requirements = (await portal.request('get', '/requirements')) as { items: Array<{ status: string }> }
    expect(requirements.items.length).toBeGreaterThanOrEqual(18)
    for (const status of REQUIREMENT_STATUSES) {
      expect(requirements.items.filter((item) => item.status === status).length, status).toBeGreaterThanOrEqual(2)
    }

    const approvals = (await portal.request('get', '/approvals')) as { items: Array<{ status: string; slaStatus: string }> }
    expect(approvals.items.length).toBeGreaterThanOrEqual(20)
    for (const status of APPROVAL_STATUSES) {
      expect(approvals.items.filter((item) => item.status === status).length, status).toBeGreaterThanOrEqual(1)
    }
    for (const sla of SLA_STATES) {
      expect(approvals.items.filter((item) => item.slaStatus === sla).length, sla).toBeGreaterThanOrEqual(1)
    }

    const runs = (await algo.request('GET', '/my/algorithm-runs', { page: 1, size: 50 })) as {
      total: number
      items: Array<{ status: string }>
    }
    expect(runs.total).toBeGreaterThanOrEqual(15)
    for (const status of RUN_STATUSES) {
      expect(runs.items.filter((item) => item.status === status).length, status).toBeGreaterThanOrEqual(1)
    }

    const datasets = (await data.request('GET', '/datasets', { page: 1, size: 50 })) as { total: number }
    const services = (await algo.request('GET', '/algorithm-services', { page: 1, size: 50 })) as { total: number }
    expect(datasets.total).toBeGreaterThanOrEqual(15)
    expect(services.total).toBeGreaterThanOrEqual(8)
  })

  it('演示时间都在最近 30 天内', async () => {
    const portal = createPortalMockApi()
    const approvals = (await portal.request('get', '/approvals')) as { items: Array<{ createdAt: string; updatedAt: string }> }
    const requirements = (await portal.request('get', '/requirements')) as { items: Array<{ createdAt: string }> }
    const notices = (await portal.request('get', '/operations/notices')) as { items: Array<{ createdAt: string }> }
    for (const item of [...approvals.items, ...requirements.items, ...notices.items]) {
      assertRecent(item.createdAt)
    }
  })
})
