import { describe, expect, it } from 'vitest'

import { createPortalMockApi } from './portalMockApi'

type MockPage = { items: unknown[] }
type MockApproval = { code: string; status: string }
type MockTemplateList = { body: { items: unknown[] } }
type MockRun = { started: boolean; status: string }
type MockUnread = { unread: number }
type MockNotification = { id: string }

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
