import type { AssistantMatterRef, AssistantSearchHit, TemplateContext } from './types'

import { createSeedApprovals, createSeedRequirements, createSeedTasks, seedNotifications } from '../seed.volume'
import { seedAlgorithms, seedDataServices } from '../seed'

/** 中文问句分词：按非中文字符切不开，这里按标点/空白切并丢弃单字碎片。 */
function tokens(q: string): string[] {
  return q
    .split(/[\s，,。.？?！!、;；:：/]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
}

/** 名称与问句的匹配分：token 命中 + 名称 2-gram 落在问句中（"海表温度"能召回"…海表温度分析的算法"）。 */
function nameScore(name: string, question: string, qTokens: string[]): number {
  let score = qTokens.filter((token) => name.includes(token)).length
  for (let i = 0; i + 1 < name.length; i += 1) {
    const gram = name.slice(i, i + 2)
    if (/[\u4e00-\u9fa5A-Za-z]/.test(gram[0]) && question.includes(gram)) score += 1
  }
  return score
}

function searchNamed<T extends { code: string; name: string }>(items: T[], question: string): T[] {
  const qTokens = tokens(question)
  return items
    .map((item) => ({ item, score: nameScore(`${item.name} ${item.code}`, question, qTokens) }))
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.item)
}

interface SeedApprovalLike {
  code: string
  title: string
  status: string
  slaStatus?: string
}

interface SeedRequirementLike {
  code: string
  title: string
  status: string
}

const OPEN_REQUIREMENT_STATUS = new Set(['OPEN', 'ANALYZING', 'ASSIGNED', 'IN_PROGRESS'])

// 单测里每个用例可能改动单据状态，摘要按调用时快照计算，不做模块级缓存。
// seed.volume 的工厂返回 Record<string, unknown>（跨域通用），这里收窄为本模块使用的字段。
function approvalsSnapshot(): SeedApprovalLike[] {
  return createSeedApprovals() as unknown as SeedApprovalLike[]
}

function requirementsSnapshot(): SeedRequirementLike[] {
  return createSeedRequirements() as unknown as SeedRequirementLike[]
}

export function createTemplateContext(question: string, lastHits: AssistantSearchHit[], sessionId: string): TemplateContext {
  return {
    question,
    sessionId,
    lastHits,
    searchServices: (q) => searchNamed(seedDataServices, q),
    searchAlgorithms: (q) => searchNamed(seedAlgorithms, q),
    todoSummary: () => ({
      pendingApprovals: approvalsSnapshot().filter((item) => item.status === 'PENDING').length,
      runningTasks: createSeedTasks().filter((item) => item.status === 'RUNNING').length,
      openRequirements: requirementsSnapshot().filter((item) => OPEN_REQUIREMENT_STATUS.has(item.status)).length,
      unread: seedNotifications.filter((item) => item.readHoursAgo === undefined).length,
    }),
    pendingApprovals: () =>
      approvalsSnapshot()
        .filter((item) => item.status === 'PENDING')
        .map((item) => ({ code: item.code, title: item.title, slaStatus: item.slaStatus ?? 'ON_TIME' })),
    unreadNotifications: () =>
      seedNotifications
        .filter((item) => item.readHoursAgo === undefined)
        .map((item) => ({ id: item.id, title: item.title, body: item.body })),
    lookupMatter: (code): AssistantMatterRef | null => {
      const normalized = code.trim()
      const approval = approvalsSnapshot().find((item) => item.code === normalized)
      if (approval) return { code: approval.code, title: approval.title, status: approval.status, kind: 'approval' }
      const requirement = requirementsSnapshot().find((item) => item.code === normalized)
      if (requirement) return { code: requirement.code, title: requirement.title, status: requirement.status, kind: 'requirement' }
      const task = createSeedTasks().find((item) => String(item.taskId) === normalized)
      if (task) {
        const taskId = String(task.taskId)
        const stage = String(task.stage ?? '')
        return { code: taskId, title: `任务 ${taskId}（${stage || String(task.status)}）`, status: String(task.status), kind: 'task' }
      }
      return null
    },
  }
}
