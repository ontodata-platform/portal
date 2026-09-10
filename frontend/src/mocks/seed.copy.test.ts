import { describe, expect, it } from 'vitest'

import { createLocalAgentMockApi } from './agentMockApi'
import { createPortalMockApi } from './portalMockApi'
import { seedResults } from './seed'

const STABLE_CODES = ['req-002', 'req-006', 'apr-r4-sample', 'apr-overdue-003'] as const

const FORBIDDEN_COPY = /调用工作流提交工具需要审批|临期工具调用审批|本地样板|exe-sample|fixture|\btest\b/i

describe('演示话术业务化（§A4-2）', () => {
  it('对照表标题已改写，稳定编码仍保留', async () => {
    const portal = createPortalMockApi()
    const approvals = (await portal.request('get', '/approvals')) as {
      items: Array<{ code: string; title: string }>
    }
    const byCode = Object.fromEntries(approvals.items.map((item) => [item.code, item.title]))

    expect(byCode['apr-r4-sample']).toBe('航线规划工具服务开通申请')
    expect(byCode['apr-overdue-003']).toBe('SAR 影像订阅申请（超期催办示例）')
    expect(byCode['apr-due-004']).toBe('测高波形数据使用申请（今日到期待办）')

    const quality = seedResults.find((item) => item.resultId === 'result-quality-002')
    expect(quality?.metadata.title).toBe('质量分析报告-2026W37')

    const requirements = (await portal.request('get', '/requirements')) as { items: Array<{ code: string }> }
    const codes = new Set([
      ...approvals.items.map((item) => item.code),
      ...requirements.items.map((item) => item.code),
    ])
    for (const code of STABLE_CODES) {
      expect(codes.has(code), code).toBe(true)
    }
  })

  it('列表标题与助手回复不再出现测试话术', async () => {
    const portal = createPortalMockApi()
    const approvals = (await portal.request('get', '/approvals')) as { items: Array<{ title: string }> }
    const requirements = (await portal.request('get', '/requirements')) as { items: Array<{ title: string }> }
    const titles = [...approvals.items, ...requirements.items].map((item) => item.title).join('\n')
    expect(titles).not.toMatch(FORBIDDEN_COPY)

    const agent = createLocalAgentMockApi()
    const session = await agent.createSession({ agentId: 'agent-quality-assistant', agentVersion: 1 })
    await agent.createRun(session.id, { graph: 'quality', input: { question: '分析高分光学影像' } })
    await agent.resumeAfterApproval(session.id, 'apr-r4-sample')
    const history = await agent.listMessages(session.id)
    const spoken = history.map((item) => item.content).join('\n')
    expect(spoken).not.toMatch(FORBIDDEN_COPY)
  })
})
