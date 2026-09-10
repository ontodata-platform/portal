import { seedIntents } from '../../seed'
import type { AssistantTemplate } from '../types'

/** 兜底：不说"我不懂"，给能力菜单 + 快捷问法（seedIntents 驱动）。 */
export const fallbackTemplate: AssistantTemplate = {
  id: 'fallback',
  match: { keywords: [] },
  samples: ['你们能干什么', '嗨'],
  compose: () => ({
    text: '我可以帮你找数据、推荐算法、看待办、查通知，也能讲清楚各类事项的办理流程。下面是一些可以继续的问法：',
    actions: seedIntents.slice(0, 3).map((item) => ({
      label: item.title,
      kind: 'navigate' as const,
      target: `/assistant?q=${encodeURIComponent(item.example)}`,
    })),
    quickReplies: ['找数据服务', '跑目标特性提取', '看今日待办', '怎么申请数据使用权？'],
  }),
}
