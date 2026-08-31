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
