import type { AssistantTemplate } from '../types'

/** 待办查询：事项汇总卡 + 临期待办明细（数据来自 seed 快照）。 */
export const todosTemplate: AssistantTemplate = {
  id: 'todos-summary',
  match: {
    keywords: ['待办', '看待办', '今日待办', '我的事项', '待我审批', '审批'],
    patterns: [/有哪些.*(待办|审批|任务)/],
  },
  samples: ['看看今天有什么待办', '我有哪些待办审批'],
  compose: (ctx) => {
    const summary = ctx.todoSummary()
    const pending = ctx.pendingApprovals()
    const dueSoon = pending.filter((item) => item.slaStatus === 'DUE_SOON' || item.slaStatus === 'OVERDUE').slice(0, 3)
    const lines = dueSoon.map((item) => `· ${item.title}（${item.slaStatus === 'OVERDUE' ? '已超期' : '今日临期'}）`)
    return {
      text: [
        `待我审批 ${summary.pendingApprovals} 件、进行中任务 ${summary.runningTasks} 个、进行中需求 ${summary.openRequirements} 条、未读通知 ${summary.unread} 条。`,
        lines.length ? '需要注意时限的：' : '暂无临期事项。',
        ...lines,
      ].join('\n'),
      cards: [{ type: 'task-summary' as const, payload: summary }],
      actions: [
        { label: '去审批', kind: 'navigate', target: '/personal/approvals' },
        { label: '去任务', kind: 'navigate', target: '/personal/tasks' },
        { label: '去通知', kind: 'navigate', target: '/personal/notifications' },
      ],
      quickReplies: ['查通知', '怎么办理数据申请？'],
    }
  },
}
