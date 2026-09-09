import type { AssistantTurnResult, IntentSuggestion } from '@/types/assistant'

import { seedAlgorithms, seedDataServices, seedIntents } from './seed'

const DATA_RE = /数据|服务|订阅|找数/
const ALGO_RE = /算法|跑|分析|预测|质量/
const RUN_RE = /提交|跑一遍/
const TODO_RE = /待办|任务|审批|通知/
const GRANT_RE = /申请|权限|开通/

export function listIntentSuggestions(): IntentSuggestion[] {
  return seedIntents.map((item) => ({ ...item }))
}

export function routeAssistantIntent(text: string): AssistantTurnResult {
  const q = text.trim()
  if (DATA_RE.test(q)) {
    return {
      text: `为你找到 ${seedDataServices.length} 个数据服务，可直接查看详情或申请订阅。`,
      cards: seedDataServices.map((payload) => ({ type: 'data-service' as const, payload })),
      citations: [{ source: 'data-platform', version: 'catalog-v1' }],
      actions: [{ label: '去数据工作台', kind: 'navigate', target: '/data-workbench' }],
    }
  }
  if (ALGO_RE.test(q)) {
    const cards = seedAlgorithms.slice(0, 2).map((payload) => ({ type: 'algorithm' as const, payload }))
    const result: AssistantTurnResult = {
      text: '匹配到可运行的分析流程。确认后可提交到算法工作台。',
      cards,
      actions: [{ label: '去算法工作台', kind: 'navigate', target: '/workbench' }],
    }
    if (RUN_RE.test(q)) {
      result.confirm = {
        confirmToken: `cft-assistant-${Date.now()}`,
        tool: 'recombine.submit_workflow',
        riskLevel: 'R4',
        summary: { code: 'tpl-quality-weekly', plan: '提交港区目标特性提取-周批', impact: '将创建运行任务并可能升级审批' },
        argumentsSummary: '{"template":"tpl-quality-weekly"}',
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      }
      result.approvalCode = 'apr-r4-sample'
    }
    return result
  }
  if (TODO_RE.test(q)) {
    return {
      text: '这是你当前的事项汇总，可从卡片进入对应签页办理。',
      cards: [
        {
          type: 'task-summary',
          payload: { pendingApprovals: 2, runningTasks: 1, openRequirements: 1, unread: 3 },
        },
      ],
      actions: [
        { label: '去审批', kind: 'navigate', target: '/personal/approvals' },
        { label: '去任务', kind: 'navigate', target: '/personal/tasks' },
        { label: '去通知', kind: 'navigate', target: '/personal/notifications' },
      ],
    }
  }
  if (GRANT_RE.test(q)) {
    return {
      text: '开通数据服务可以按下面步骤办理。',
      cards: [
        {
          type: 'guide',
          payload: {
            title: '申请数据服务授权',
            steps: ['在商城打开目标服务', '提交授权申请', '等待审批通过后查看投递结果'],
            target: '/data-workbench/ds-sar-maritime',
          },
        },
      ],
    }
  }
  return {
    text: '我可以帮你找数据、跑分析、看待办或申请开通。下面是一些可以继续的问法。',
    actions: listIntentSuggestions().slice(0, 3).map((item) => ({
      label: item.title,
      kind: 'navigate' as const,
      target: `/assistant?q=${encodeURIComponent(item.example)}`,
    })),
  }
}

export async function streamAssistantText(
  text: string,
  onToken: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (import.meta.env.VITEST) {
    onToken(text)
    return
  }
  for (const ch of text) {
    if (signal?.aborted) return
    onToken(ch)
    await new Promise((resolve) => setTimeout(resolve, 35))
  }
}
