import type { AssistantTemplate } from '../types'

/** 通知查询：未读摘要卡。 */
export const notificationsTemplate: AssistantTemplate = {
  id: 'notifications',
  match: {
    keywords: ['通知', '消息', '未读', '提醒'],
    patterns: [/查(看)?(未读)?通知/, /有什么(消息|通知)/],
  },
  samples: ['查通知', '看看未读通知', '有什么消息'],
  compose: (ctx) => {
    const unread = ctx.unreadNotifications().slice(0, 5)
    return {
      text: unread.length
        ? `你有 ${unread.length} 条未读消息，摘要如下，可到通知中心查看全部：`
        : '当前没有未读消息。新审批决定和任务完成都会在这里提醒你。',
      cards: unread.map((item) => ({
        type: 'guide' as const,
        payload: {
          title: item.title,
          steps: item.body ? [item.body] : [],
          target: '/personal/notifications',
        },
      })),
      actions: [{ label: '去通知中心', kind: 'navigate', target: '/personal/notifications' }],
      quickReplies: ['看今日待办', '找数据服务'],
    }
  },
}
