import type { AssistantTemplate } from '../types'

/** 数据服务咨询/申请：应答从 seed 现查现组，首条命中生成申请确认卡（C5-2 意图带入的地基）。 */
export const dataServiceTemplate: AssistantTemplate = {
  id: 'ds-find',
  match: {
    keywords: ['找数据', '数据服务', '申请数据', '申请影像', '申请开通', '订阅', '影像', '数据'],
    patterns: [/想(要|找|申请).*(数据|影像|服务)/],
  },
  samples: ['我想申请东海海域的高分光学影像数据', '找数据服务', '申请开通SAR海面目标检测数据'],
  compose: (ctx) => {
    const hits = ctx.searchServices(ctx.question).slice(0, 3)
    const primary = hits[0]
    return {
      text: hits.length
        ? `为你找到 ${hits.length} 个相关数据服务，已按匹配度排列，点击卡片可查看详情或发起申请：`
        : '没有直接匹配的数据服务。可以换个说法再找，或把需求登记给数据管理部做定制。',
      cards: hits.map((service) => ({ type: 'data-service' as const, payload: service })),
      citations: [{ source: 'data-platform', version: 'catalog-v1' }],
      actions: [
        { label: '去数据工作台', kind: 'navigate', target: '/data-workbench' },
        { label: '登记数据需求', kind: 'navigate', target: '/personal/requirements' },
      ],
      confirm: primary
        ? {
            confirmToken: `cft-assistant-apply-${primary.code}`,
            tool: 'marketplace.apply',
            riskLevel: 'R2',
            summary: {
              code: primary.code,
              plan: `发起「${primary.name}」使用申请`,
              impact: '将打开申请向导并预填产品信息，提交后进入审批',
            },
            argumentsSummary: JSON.stringify({ serviceCode: primary.code, source: 'SERVICE' }),
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
          }
        : undefined,
      quickReplies: hits.length ? ['第一个怎么申请？', '看它们的应用条件', '换个关键词再找'] : ['报一条定制需求', '看今日待办'],
    }
  },
}
