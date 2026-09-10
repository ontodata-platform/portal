import type { AssistantAction, AssistantTurnResult } from '@/types/assistant'

import { createTemplateContext } from './context'
import type { AssistantSearchHit, AssistantReply, AssistantTemplate, TemplateContext } from './types'
import { templates } from './templates'

/** 单号识别：apr-/req-/tsk- 前缀（apr-0207、tsk-run-003 等）。 */
const MATTER_CODE_RE = /\b(apr|req|tsk)-[a-z0-9-]+\b/i
/** 代词式追问：依赖上一轮命中实体（一轮上下文）。 */
const FOLLOWUP_RE = /^(第一个|第二个|第三个|它|这个|那个)/

let lastHits: AssistantSearchHit[] = []

/** 重置一轮上下文（测试与开启新会话时使用）。 */
export function resetAssistantContext(): void {
  lastHits = []
}

function templateScore(template: AssistantTemplate, question: string): number {
  let score = 0
  for (const keyword of template.match.keywords) {
    if (question.includes(keyword)) score += 2
  }
  for (const pattern of template.match.patterns ?? []) {
    if (pattern.test(question)) score += 3
  }
  return score
}

function hitFromCards(reply: AssistantReply): AssistantSearchHit[] {
  const hits: AssistantSearchHit[] = []
  for (const card of reply.cards ?? []) {
    if (card.type === 'data-service') hits.push({ code: card.payload.code, name: card.payload.name, kind: 'service' })
    else if (card.type === 'algorithm') hits.push({ code: card.payload.code, name: card.payload.name, kind: 'algorithm' })
  }
  return hits
}

function withQuickReplies(reply: AssistantReply): AssistantTurnResult {
  const quickActions: AssistantAction[] = (reply.quickReplies ?? []).map((label) => ({
    label,
    kind: 'navigate',
    target: `/assistant?q=${encodeURIComponent(label)}`,
  }))
  return {
    text: reply.text,
    cards: reply.cards,
    citations: reply.citations,
    actions: [...(reply.actions ?? []), ...quickActions],
    confirm: reply.confirm,
    approvalCode: reply.approvalCode,
  }
}

function lookupReply(ctx: TemplateContext, code: string): AssistantReply | null {
  const matter = ctx.lookupMatter(code)
  if (!matter) return null
  // C1：直达统一事项详情
  const target = `/matter/${matter.kind}/${matter.code}`
  return {
    text: `单据 ${matter.code} 当前状态「${matter.status}」：《${matter.title}》。可进入事项详情查看时间轴与办理入口。`,
    actions: [
      { label: '去查看', kind: 'navigate', target },
      { label: '看今日待办', kind: 'navigate', target: '/personal/approvals' },
    ],
  }
}

function followupReply(ctx: TemplateContext): AssistantReply | null {
  const hit = ctx.lastHits[0]
  if (!hit) return null
  const isService = hit.kind === 'service'
  return {
    text: `关于「${hit.name}」：${isService ? '点"填写申请"完成用途、范围、时间与交付四项后提交审批' : '在工作台配置输入后即可提交运行，需要我带你过去吗？'}`,
    cards: [
      {
        type: 'guide',
        payload: {
          title: `办理「${hit.name}」`,
          steps: isService
            ? ['查看申请条件与字段样例', '完成申请向导四要素', '跟踪审批并在交付后领取']
            : ['确认输入数据要求', '完成三步运行向导', '在结果签页下载制品'],
          target: isService ? `/data-workbench/${hit.code}` : `/algorithm-workbench/${hit.code}`,
        },
      },
    ],
    actions: [
      { label: isService ? '去申请' : '去运行', kind: 'navigate', target: isService ? `/data-workbench/${hit.code}` : `/algorithm-workbench/${hit.code}` },
    ],
    quickReplies: ['看今日待办', '换个目标再找'],
  }
}

/**
 * 模板匹配引擎（A7-2）：
 * ① 单号直查 → ② 代词追问（一轮上下文）→ ③ 模板打分（关键词×2 + 正则×3，同分按注册顺序）→ ④ 兜底。
 * 命中实体写入 lastHits，供下一轮追问使用。
 */
export function runAssistantTemplates(question: string, sessionId = 'local'): AssistantTurnResult {
  const q = question.trim()
  const ctx = createTemplateContext(q, lastHits, sessionId)

  let reply: AssistantReply | null = null

  const codeHit = q.match(MATTER_CODE_RE)
  if (codeHit) {
    reply = lookupReply(ctx, codeHit[0])
  } else if (FOLLOWUP_RE.test(q) && ctx.lastHits.length > 0) {
    reply = followupReply(ctx)
  }

  if (!reply) {
    let best: AssistantTemplate | null = null
    let bestScore = 0
    for (const template of templates) {
      const score = templateScore(template, q)
      if (score > bestScore) {
        best = template
        bestScore = score
      }
    }
    reply = best ? best.compose(ctx) : templates[templates.length - 1].compose(ctx)
  }

  const hits = hitFromCards(reply)
  if (hits.length > 0) lastHits = hits

  return withQuickReplies(reply)
}
