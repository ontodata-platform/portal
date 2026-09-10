import { beforeEach, describe, expect, it } from 'vitest'

import { assistantDemoCases } from './fixtures'
import { resetAssistantContext, runAssistantTemplates } from './engine'

describe('助手模板引擎（A7 演示剧本）', () => {
  beforeEach(() => {
    resetAssistantContext()
  })

  for (const demo of assistantDemoCases) {
    it(`剧本 ${demo.id}：${demo.question}`, () => {
      if (demo.precondition) {
        runAssistantTemplates(demo.precondition, 'sess-test')
      }
      const result = runAssistantTemplates(demo.question, 'sess-test')

      if (demo.expect.textIncludes) {
        for (const fragment of demo.expect.textIncludes) {
          expect(result.text).toContain(fragment)
        }
      }
      if (demo.expect.cardType) {
        expect(result.cards?.length ?? 0).toBeGreaterThan(0)
        expect(result.cards?.every((card) => card.type === demo.expect.cardType)).toBe(true)
      }
      if (demo.expect.minCards !== undefined) {
        expect(result.cards?.length ?? 0).toBeGreaterThanOrEqual(demo.expect.minCards)
      }
      if (demo.expect.hasConfirm !== undefined) {
        expect(Boolean(result.confirm)).toBe(demo.expect.hasConfirm)
      }
    })
  }

  it('申请剧本的首个服务卡与确认卡指向同一产品', () => {
    const result = runAssistantTemplates('我想申请东海海域的高分光学影像数据，怎么办理？')
    const firstCard = result.cards?.[0]
    expect(firstCard?.type).toBe('data-service')
    if (firstCard?.type === 'data-service' && result.confirm) {
      expect(result.confirm.summary.code).toBe(firstCard.payload.code)
    }
  })

  it('确认卡遵循既有确认协议（tool 与审批联动字段齐全）', () => {
    const result = runAssistantTemplates('跑一遍港区目标特性提取')
    expect(result.confirm?.tool).toBe('recombine.submit_workflow')
    expect(result.confirm?.confirmToken).toMatch(/^cft-assistant-/)
    expect(result.confirm?.expiresAt).toBeTruthy()
  })

  it('一轮上下文：追问"第一个怎么申请"落在上一轮命中实体上', () => {
    const first = runAssistantTemplates('找数据服务')
    expect(first.cards?.length).toBeGreaterThan(0)

    const followup = runAssistantTemplates('第一个怎么申请')
    expect(followup.text).toContain('关于')
    expect(followup.actions?.some((action) => action.label === '去申请')).toBe(true)
  })

  it('单号直查优先于模板匹配', () => {
    const result = runAssistantTemplates('apr-0201 现在什么状态')
    expect(result.text).toContain('apr-0201')
    expect(result.text).toContain('海表温度场')
  })

  it('快捷追问被转成 navigate actions', () => {
    const result = runAssistantTemplates('找数据服务')
    const quick = result.actions?.find((action) => action.label === '第一个怎么申请？')
    expect(quick?.kind).toBe('navigate')
    expect(quick?.target).toContain('/assistant?q=')
  })
})
