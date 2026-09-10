/** 助手演示问句清单（A7-3）：8 条标准剧本，e2e 与本目录测试共用。precondition 为剧本前置问句。 */
export interface AssistantDemoCase {
  id: string
  question: string
  /** 剧本前置问句（如一轮上下文剧本需要先命中实体） */
  precondition?: string
  /** 预期应答形态的关键断言点 */
  expect: {
    textIncludes?: string[]
    cardType?: 'data-service' | 'algorithm' | 'task-summary' | 'guide'
    minCards?: number
    hasConfirm?: boolean
  }
}

export const assistantDemoCases: AssistantDemoCase[] = [
  {
    id: 'apply-ds',
    question: '我想申请东海海域的高分光学影像数据，怎么办理？',
    expect: { textIncludes: ['数据服务'], cardType: 'data-service', minCards: 3, hasConfirm: true },
  },
  {
    id: 'recommend-algo',
    question: '帮我推荐一个做海表温度分析的算法',
    expect: { textIncludes: ['算法'], cardType: 'algorithm', minCards: 1, hasConfirm: false },
  },
  {
    id: 'todos',
    question: '看看今天有什么待办',
    expect: { textIncludes: ['待我审批'], cardType: 'task-summary', hasConfirm: false },
  },
  {
    id: 'notifications',
    question: '查通知',
    expect: { textIncludes: ['未读'], hasConfirm: false },
  },
  {
    id: 'process',
    question: '怎么申请权限开通？',
    expect: { textIncludes: ['分三步'], cardType: 'guide', hasConfirm: false },
  },
  {
    id: 'matter-code',
    question: 'apr-0207 到哪一步了',
    expect: { textIncludes: ['apr-0207'], hasConfirm: false },
  },
  {
    id: 'followup',
    question: '第一个怎么申请',
    precondition: '找数据服务',
    expect: { textIncludes: ['关于'], cardType: 'guide', hasConfirm: false },
  },
  {
    id: 'capability',
    question: '你们能干什么',
    expect: { textIncludes: ['找数据'], hasConfirm: false },
  },
]
