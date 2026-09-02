import { describe, expect, it } from 'vitest'

import { routeAssistantIntent } from './assistantMockApi'

describe('assistantMockApi 意图路由', () => {
  it('数据/服务/订阅/找数 → data-service 卡片 + citations', () => {
    const result = routeAssistantIntent('帮我找数据服务订阅')
    expect(result.text).toContain('数据服务')
    expect(result.cards?.every((card) => card.type === 'data-service')).toBe(true)
    expect(result.cards?.length).toBe(3)
    expect(result.citations?.[0]?.source).toBe('data-platform')
  })

  it('算法/跑/分析 → algorithm 卡片；含提交则带确认卡', () => {
    const listed = routeAssistantIntent('匹配质量分析算法')
    expect(listed.cards?.every((card) => card.type === 'algorithm')).toBe(true)
    expect(listed.confirm).toBeUndefined()

    const run = routeAssistantIntent('跑一遍客户质量分析并提交')
    expect(run.confirm?.tool).toBe('recombine.submit_workflow')
    expect(run.approvalCode).toBe('apr-r4-sample')
  })

  it('待办/任务/审批/通知 → task-summary + 深链', () => {
    const result = routeAssistantIntent('我有哪些待办审批')
    expect(result.cards?.[0]?.type).toBe('task-summary')
    expect(result.actions?.some((action) => action.target === '/personal/approvals')).toBe(true)
  })

  it('申请/权限/开通 → guide', () => {
    const result = routeAssistantIntent('申请开通设备遥测权限')
    expect(result.cards?.[0]?.type).toBe('guide')
    if (result.cards?.[0]?.type === 'guide') {
      expect(result.cards[0].payload.target).toContain('/data-workbench/')
    }
  })

  it('未命中走兜底建议', () => {
    const result = routeAssistantIntent('今天天气怎么样')
    expect(result.cards).toBeUndefined()
    expect(result.text).toContain('找数据')
    expect(result.actions?.length).toBeGreaterThan(0)
  })
})
