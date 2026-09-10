import type { AssistantTemplate } from '../types'

interface FlowGuide {
  test: RegExp
  title: string
  steps: string[]
  target: string
}

const FLOWS: FlowGuide[] = [
  {
    test: /数据|影像|订阅/,
    title: '申请数据服务使用授权',
    steps: [
      '在数据工作台目录中选定产品，查看字段、样例与申请条件',
      '点"填写申请"完成向导：使用目的、数据范围、时间范围、交付要求',
      '提交后在"我的申请"跟踪进度，审批通过后到"我的订阅与交付"领取',
    ],
    target: '/data-workbench',
  },
  {
    test: /算法|运行|分析|预测/,
    title: '运行一个已发布算法',
    steps: [
      '在算法工作台选定算法，查看输入项与参数说明',
      '运行向导三步：配置输入（可选订阅数据或测试数据）→ 确认预检 → 提交运行',
      '运行结束后在"结果"签页查看日志、结果摘要并下载制品',
    ],
    target: '/algorithm-workbench',
  },
  {
    test: /权限|开通/,
    title: '申请系统权限开通',
    steps: ['在个人中心发起系统权限申请', '审批通过后由门户运营完成开通', '开通结果在通知中心提醒'],
    target: '/personal',
  },
]

/** 办理流程咨询："怎么申请/怎么办理/办理流程"类问句的标准答案 + 去办理入口。 */
export const processTemplate: AssistantTemplate = {
  id: 'process-guide',
  match: {
    keywords: ['办理流程', '申请流程'],
    patterns: [/怎么(申请|办理|跑|提交|开通)/, /如何(申请|办理|开通)/],
  },
  samples: ['怎么申请数据使用权？', '怎么办理数据申请？', '怎么跑一个算法？'],
  compose: (ctx) => {
    const flow = FLOWS.find((item) => item.test.test(ctx.question)) ?? FLOWS[0]
    return {
      text: `${flow.title}分三步：`,
      cards: [{ type: 'guide' as const, payload: { title: flow.title, steps: flow.steps, target: flow.target } }],
      actions: [{ label: '现在就去办理', kind: 'navigate', target: flow.target }],
      quickReplies: ['看今日待办', '报一条定制需求'],
    }
  },
}
