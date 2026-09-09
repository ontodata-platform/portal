import { describe, expect, it } from 'vitest'

import { createPortalMockApi } from './portalMockApi'

type MockPage = { items: unknown[] }
type MockApproval = { code: string; status: string }
type MockTemplateList = { body: { items: unknown[] } }
type MockRun = { started: boolean; status: string }
type MockUnread = { unread: number }
type MockNotification = { id: string }
type MockRequirement = {
  code: string
  requester: string
  title?: string
  dataProfile?: { businessDomain: string; dataObject: string; useCase: string }
  consolidation?: { primaryCode: string; role: string; reason: string }
}
type MockOverlapCandidate = { code: string; score: number; reasons: string[] }

describe('portal local mock API', () => {
  it('keeps the approval, workbench, and notification flows stateful in one browser session', async () => {
    const api = createPortalMockApi()

    const pending = await api.request('get', '/approvals', { status: 'PENDING' }) as MockPage
    const approval = pending.items[0] as MockApproval
    expect(approval.status).toBe('PENDING')

    const decided = await api.request('post', `/approvals/${approval.code}/decision`, {}, { decision: 'APPROVED' }) as MockApproval
    expect(decided.status).toBe('APPROVED')

    const templates = await api.request('get', '/workbench/workflow-templates') as MockTemplateList
    const template = templates.body.items[0] as { code: string; currentVersion: number }
    const run = await api.request('post', `/workbench/workflow-templates/${template.code}/runs`, {}, { templateVersion: template.currentVersion }) as MockRun
    expect(run).toMatchObject({ started: true, status: 'RUNNING' })

    const unread = await api.request('get', '/personal/notifications/unread-count') as MockUnread
    expect(unread.unread).toBeGreaterThan(0)
    const notifications = await api.request('get', '/personal/notifications') as MockPage
    await api.request('post', `/personal/notifications/${(notifications.items[0] as MockNotification).id}/read`)
    expect((await api.request('get', '/personal/notifications/unread-count') as MockUnread).unread).toBe(unread.unread - 1)
  })

  it('exposes diversified requirement requesters and SLA-aware approvals for admin consoles', async () => {
    const api = createPortalMockApi()
    const requirements = await api.request('get', '/requirements') as MockPage
    const requesters = (requirements.items as { requester: string }[]).map((item) => item.requester)
    expect(new Set(requesters).size).toBeGreaterThanOrEqual(4)
    expect(requesters).toEqual(expect.arrayContaining(['陈晓', 'alice', 'bob', '王工']))

    const overdue = await api.request('get', '/approvals', { sla: 'OVERDUE' }) as MockPage
    expect((overdue.items[0] as { slaStatus: string; status: string }).slaStatus).toBe('OVERDUE')
    expect((overdue.items[0] as { status: string }).status).toBe('PENDING')

    const dueSoon = await api.request('get', '/approvals', { sla: 'DUE_SOON' }) as MockPage
    expect((dueSoon.items[0] as { slaStatus: string }).slaStatus).toBe('DUE_SOON')
  })

  it('finds explainable overlapping data requirements and retains each requester after consolidation', async () => {
    const api = createPortalMockApi()

    const requirements = await api.request('get', '/requirements') as MockPage
    expect(requirements.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'req-002',
        title: '高分辨率光学影像目标特性提取',
        dataProfile: expect.objectContaining({
          businessDomain: '遥感目标识别',
          dataObject: '高分辨率光学卫星影像',
          useCase: '港区目标特性提取',
        }),
      }),
    ]))

    const candidates = await api.request('get', '/requirements/req-002/overlap-candidates') as MockOverlapCandidate[]
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'req-006',
          score: expect.any(Number),
          reasons: expect.arrayContaining([expect.any(String)]),
        }),
      ]),
    )

    const conflictingPurpose = await api.request('post', '/requirements', {}, {
      requirementType: 'DATA',
      title: '东海光学影像海域巡查需求',
      dataProfile: {
        businessDomain: '遥感目标识别',
        dataObject: '高分辨率光学卫星影像',
        scope: '东海重点海域',
        granularity: '0.5 米空间分辨率',
        fields: ['scene_id', 'acquisition_time', 'orbit_id'],
        useCase: '海域巡查审计',
        sensitivity: 'INTERNAL',
      },
    }) as MockRequirement
    const candidatesWithConflict = await api.request('get', '/requirements/req-002/overlap-candidates') as MockOverlapCandidate[]
    expect(candidatesWithConflict.map((candidate) => candidate.code)).not.toContain(conflictingPurpose.code)

    await expect(api.request(
      'post',
      '/requirements/req-006/consolidate',
      {},
      { primaryCode: 'req-002', reason: '影像类型、覆盖海域和空间分辨率一致，统一组织交付。' },
    )).rejects.toMatchObject({ response: { status: 409, data: { code: 'STATE_CONFLICT' } } })

    await api.request('post', '/requirements/req-002/analyze', {}, {
      analysis: { conclusion: '可由高分辨率光学影像满足港区目标特性提取需求。', feasibility: 'FEASIBLE', priority: 'MEDIUM' },
    })
    await api.request('post', '/requirements/req-006/analyze', {}, {
      analysis: { conclusion: '可与相同范围需求共享交付。', feasibility: 'FEASIBLE', priority: 'MEDIUM' },
    })

    const consolidated = await api.request(
      'post',
      '/requirements/req-006/consolidate',
      {},
      { primaryCode: 'req-002', reason: '影像类型、覆盖海域和空间分辨率一致，统一组织交付。' },
    ) as MockRequirement
    expect(consolidated.requester).toBe('bob')
    expect(consolidated.consolidation).toMatchObject({
      primaryCode: 'req-002',
      role: 'RELATED',
      reason: '影像类型、覆盖海域和空间分辨率一致，统一组织交付。',
    })

    const primary = await api.request('get', '/requirements/req-002') as MockRequirement
    expect(primary.consolidation).toMatchObject({ primaryCode: 'req-002', role: 'PRIMARY' })
  })

  it('records analysis, delivery plan, and progress as requirement facts', async () => {
    const api = createPortalMockApi()

    const analyzed = await api.request('post', '/requirements/req-002/analyze', {}, {
      analysis: { conclusion: '可由高分辨率光学影像满足港区目标特性提取需求。', feasibility: 'FEASIBLE', priority: 'HIGH', risks: '影像时相与云量阈值需确认。' },
    }) as Record<string, unknown>
    expect(analyzed).toMatchObject({
      status: 'ANALYZING',
      analysis: expect.objectContaining({ conclusion: '可由高分辨率光学影像满足港区目标特性提取需求。', priority: 'HIGH', analyzedBy: '陈晓' }),
    })

    const assigned = await api.request('post', '/requirements/req-002/assign', {}, {
      assigneeSystem: 'data-platform',
      assigneeRef: 'ds-east-sea-optical',
      plan: { owner: '王工', deliverable: '东海重点海域光学影像服务', targetDate: '2026-09-30', milestones: '影像时相确认后发布' },
    }) as Record<string, unknown>
    expect(assigned).toMatchObject({
      status: 'ASSIGNED',
      assigneeSystem: 'data-platform',
      plan: expect.objectContaining({ owner: '王工', targetDate: '2026-09-30' }),
    })

    const progressed = await api.request('post', '/requirements/req-002/progress', {}, {
      percent: 40,
      note: '已完成影像时相与云量阈值确认。',
    }) as Record<string, unknown>
    expect(progressed).toMatchObject({
      status: 'IN_PROGRESS',
      progressEntries: [expect.objectContaining({ percent: 40, note: '已完成影像时相与云量阈值确认。', recordedBy: '陈晓' })],
    })
  })

  it('nudges a pending approval into the notification inbox', async () => {
    const api = createPortalMockApi()
    const before = await api.request('get', '/personal/notifications') as MockPage
    const result = await api.request('post', '/admin/approvals/apr-overdue-003/nudge') as { ok: boolean; code: string }
    expect(result).toEqual({ ok: true, code: 'apr-overdue-003' })
    const after = await api.request('get', '/personal/notifications') as MockPage
    expect(after.items.length).toBe(before.items.length + 1)
    expect((after.items[0] as { type: string; resourceRef: string }).type).toBe('APPROVAL_NUDGE')
  })

  it('serves IAM user seeds and ABAC policy snapshots', async () => {
    const api = createPortalMockApi()
    const users = await api.request('get', '/admin/iam/users') as { items: { name: string }[] }
    expect(users.items.map((item) => item.name)).toEqual(expect.arrayContaining(['陈晓', 'alice', 'bob', '王工', '李工']))
    const policies = await api.request('get', '/admin/abac-policies') as { items: { id: string }[] }
    expect(policies.items.length).toBeGreaterThan(0)
  })

  it('rejects a duplicate decision with the same 409-shaped error used by real integration', async () => {
    const api = createPortalMockApi()
    const pending = await api.request('get', '/approvals', { status: 'PENDING' }) as MockPage
    const code = (pending.items[0] as MockApproval).code

    await api.request('post', `/approvals/${code}/decision`, {}, { decision: 'REJECTED' })

    await expect(api.request('post', `/approvals/${code}/decision`, {}, { decision: 'APPROVED' })).rejects.toMatchObject({
      response: { status: 409, data: { code: 'STATE_CONFLICT' } },
    })
  })
})
