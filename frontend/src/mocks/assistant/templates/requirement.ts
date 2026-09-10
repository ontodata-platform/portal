import type { AssistantTemplate } from '../types'

/** 定制需求提报：现有产品/算法不满足时，引导登记需求并生成需求草稿确认卡。 */
export const requirementTemplate: AssistantTemplate = {
  id: 'req-create',
  match: {
    keywords: ['报需求', '提需求', '定制需求', '需求登记', '登记需求', '定制数据', '定制算法'],
    patterns: [/登记(一条|个)?.*需求/, /现有.*(不满足|没有)/],
  },
  samples: ['报一条定制需求', '现有产品不满足，想定制一批夜光影像'],
  compose: (ctx) => ({
    text: '可以把需求登记给管理端统一处理：登记后会先做需求分析，再分派责任单位给出处理方案。',
    cards: [
      {
        type: 'guide',
        payload: {
          title: '登记一条定制需求',
          steps: ['描述分析目标与数据范围', '补充期望交付与时间要求', '提交后在"我的需求"跟踪受理进度'],
          target: '/personal/requirements',
        },
      },
    ],
    actions: [{ label: '去登记需求', kind: 'navigate', target: '/personal/requirements' }],
    confirm: {
      confirmToken: `cft-assistant-req-${Date.now()}`,
      tool: 'portal.create_requirement',
      riskLevel: 'R2',
      summary: {
        code: 'requirement-draft',
        plan: '起草一条定制需求',
        impact: '将打开需求登记表单并预填摘要，提交后进入需求整理',
      },
      argumentsSummary: JSON.stringify({ title: ctx.question.slice(0, 30), source: 'ASSISTANT' }),
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    },
    quickReplies: ['需求登记后多久有反馈？', '看今日待办'],
  }),
}
