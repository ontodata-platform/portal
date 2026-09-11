/**
 * 门户的浏览器内本地模拟。
 *
 * 这里模拟门户自己的聚合视图和受控操作，不模拟数据库、集群、对象存储或其他基础设施。
 * 数据仅存在于当前浏览器会话；刷新即还原。路由、字段和状态机与真实 /api/v1 契约保持一致，
 * 以便后续联调只替换 transport adapter，而不改写页面业务逻辑。
 */

import { loadContentEntries } from './contentConfig'
import { loadRoles, persistRoles, type RoleDef } from './roleConfig'
import { demoIdentity, relativeIso, seedDataServices } from './seed'
import { productDescriptorOf } from './seed.products'
import {
  createSeedApprovals,
  createSeedRequirements,
  createSeedTasks,
  hydrateFeedbacks,
  hydrateNotices,
  hydrateNotifications,
  hydrateResults,
  hydrateUsers,
} from './seed.volume'

type RecordValue = Record<string, unknown>

export interface PortalMockRequest {
  method: string
  path: string
  params?: RecordValue
  body?: unknown
}

export interface PortalMockApi {
  request: (method: string, path: string, params?: RecordValue, body?: unknown) => Promise<unknown>
}

/** 所有演示时间相对当前会话生成，避免过期的固定日期混入界面。 */
const timestamp = relativeIso(1)

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function error(status: number, code: string, message: string, path: string, fieldErrors?: Record<string, string>) {
  return {
    response: {
      status,
      data: { status, code, message, path, traceId: `mock-${code.toLowerCase()}`, fieldErrors },
    },
  }
}

function bodyAsRecord(value: unknown): RecordValue {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as RecordValue
  return {}
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function page<T extends RecordValue>(items: T[], params: RecordValue = {}) {
  const keyword = stringValue(params.keyword)?.toLowerCase()
  const status = stringValue(params.status)
  const type = stringValue(params.type)
  const sla = stringValue(params.sla)
  const domain = stringValue(params.domain)?.toLowerCase()
  const filtered = items.filter((item) => {
    if (status && item.status !== status) return false
    if (type && item.taskType !== type && item.approvalType !== type && item.requirementType !== type) return false
    if (sla && item.slaStatus !== sla) return false
    if (domain && !String(item.sourceSystem ?? '').toLowerCase().includes(domain)) return false
    if (!keyword) return true
    return Object.values(item).some((value) => String(value).toLowerCase().includes(keyword))
  })
  const current = Math.max(1, Number(params.page ?? 1))
  const size = Math.max(1, Number(params.size ?? 20))
  return { total: filtered.length, items: filtered.slice((current - 1) * size, current * size).map(clone) }
}

function aggregate(sourceSystem: string, items: RecordValue[], message?: string) {
  return { sourceSystem, available: true, message, body: { total: items.length, items: items.map(clone) } }
}

const TERMINAL_REQUIREMENT_STATUSES = new Set(['COMPLETED', 'CANCELED'])

function normalized(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase()
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(normalized).filter(Boolean) : []
}

function overlapFor(source: RecordValue, candidate: RecordValue): RecordValue | null {
  if (
    source.code === candidate.code
    || source.requirementType !== 'DATA'
    || candidate.requirementType !== 'DATA'
    || TERMINAL_REQUIREMENT_STATUSES.has(String(source.status))
    || TERMINAL_REQUIREMENT_STATUSES.has(String(candidate.status))
    || candidate.consolidation
  ) return null

  const sourceProfile = bodyAsRecord(source.dataProfile)
  const candidateProfile = bodyAsRecord(candidate.dataProfile)
  if (!Object.keys(sourceProfile).length || !Object.keys(candidateProfile).length) return null
  if (normalized(sourceProfile.sensitivity) !== normalized(candidateProfile.sensitivity)) return null
  if (normalized(sourceProfile.useCase) !== normalized(candidateProfile.useCase)) return null

  const reasons: string[] = []
  let score = 0
  if (normalized(sourceProfile.dataObject) === normalized(candidateProfile.dataObject)) {
    score += 45
    reasons.push('数据对象一致')
  }
  if (normalized(sourceProfile.scope) === normalized(candidateProfile.scope)) {
    score += 20
    reasons.push('使用范围一致')
  }
  if (normalized(sourceProfile.granularity) === normalized(candidateProfile.granularity)) {
    score += 15
    reasons.push('数据粒度一致')
  }
  score += 10
  reasons.push('使用场景一致')
  const sourceFields = new Set(stringArray(sourceProfile.fields))
  const sharedFields = stringArray(candidateProfile.fields).filter((field) => sourceFields.has(field))
  if (sharedFields.length > 0) {
    score += 10
    reasons.push(`包含 ${sharedFields.length} 个相同字段`)
  }
  if (score < 45) return null
  return {
    code: candidate.code,
    title: candidate.title,
    requester: candidate.requester,
    status: candidate.status,
    score,
    reasons,
  }
}

export function createPortalMockApi(): PortalMockApi {
  const approvals: RecordValue[] = createSeedApprovals()
  const tasks: RecordValue[] = createSeedTasks()
  const requirements: RecordValue[] = createSeedRequirements()
  const iamUsers: RecordValue[] = hydrateUsers()
  const iamRoles: RecordValue[] = [
    {
      code: 'user',
      description: '使用门户、个人工作台以及已授权的数据和算法服务。',
      permissions: ['PORTAL.ACCESS', 'PERSONAL.VIEW', 'DATA.APPLY', 'ALGORITHM.RUN'],
    },
    {
      code: 'data-manager',
      description: '维护数据服务供给，承接数据需求并组织交付。',
      permissions: ['DATA.MANAGE', 'DATA.DELIVER', 'REQUIREMENT.HANDLE'],
    },
    {
      code: 'algorithm-operator',
      description: '维护算法服务与工作流，承接算法需求并组织运行。',
      permissions: ['ALGORITHM.MANAGE', 'WORKFLOW.MANAGE', 'ALGORITHM.RUN'],
    },
    {
      code: 'operator',
      description: '统筹需求、审批监管和门户内容运营。',
      permissions: ['REQUIREMENT.HANDLE', 'APPROVAL.SUPERVISE', 'NOTICE.MANAGE'],
    },
    {
      code: 'approval-approver',
      description: '在授权范围内处理数据授权和高风险操作审批。',
      permissions: ['APPROVAL.DECIDE', 'APPROVAL.VIEW'],
    },
    {
      code: 'portal-admin',
      description: '管理门户用户状态、角色分配和访问策略全景。',
      permissions: ['IAM.MANAGE_USERS', 'IAM.MANAGE_ROLES', 'IAM.VIEW_POLICIES'],
    },
  ]
  const iamAuditLogs: RecordValue[] = []
  const abacPolicies: RecordValue[] = [
    { id: 'p-workbench', name: '工作台访问', resource: '/assistant|/data-workbench|/algorithm-workbench|/personal', action: 'access', effect: 'PERMIT', roles: ['user', 'operator', 'admin'] },
    { id: 'p-admin', name: '管理端访问', resource: '/admin/**', action: 'access', effect: 'PERMIT', roles: ['portal-operator', 'portal-admin', 'operator', 'admin'] },
    { id: 'p-approval', name: '审批决策', resource: '/approvals/*/decision', action: 'decide', effect: 'PERMIT', roles: ['named-approver'] },
  ]
  const notices: RecordValue[] = hydrateNotices()
  const notifications: RecordValue[] = hydrateNotifications()
  const services: RecordValue[] = seedDataServices.map((item, index) => ({
    code: item.code,
    name: item.name,
    status: 'ONLINE',
    currentVersion: item.version,
    classification: item.classification,
    subscribed: item.subscribed,
    description: `${item.name}，东海示范区遥感海洋业务目录产品。`,
    descriptor: productDescriptorOf(item, index),
  }))
  const capabilities: RecordValue[] = [
    { code: 'cap-maritime-target-feature', name: '海上目标特性提取能力', status: 'ADMITTED', currentVersion: 3, description: '已准入的海上目标特性提取算法能力。' },
    { code: 'cap-infrared-weak-target', name: '红外弱小目标检测能力', status: 'ADMITTED', currentVersion: 1, description: '已准入的红外弱小目标检测算法能力。' },
  ]
  const templates: RecordValue[] = [
    { code: 'tpl-maritime-target-flow', name: '海上目标态势研判流程', status: 'PUBLISHED', currentVersion: 2, description: '光学影像输入、目标特性提取和本体规则研判。' },
    { code: 'tpl-payload-quality', name: '卫星载荷遥测质量校验流程', status: 'PUBLISHED', currentVersion: 1, description: '载荷遥测轨次数据质量校验。' },
  ]
  const results: RecordValue[] = hydrateResults()
  const feedbacks: RecordValue[] = hydrateFeedbacks()
  let sequence = 20

  const find = (items: RecordValue[], key: string, value: string, path: string) => {
    const item = items.find((candidate) => String(candidate[key]) === value)
    if (!item) throw error(404, 'NOT_FOUND', '未找到对应资源', path)
    return item
  }
  const nextCode = (prefix: string) => `${prefix}-${String(sequence++).padStart(3, '0')}`
  const update = (item: RecordValue, patch: RecordValue) => Object.assign(item, patch, { updatedAt: timestamp })

  async function request(method: string, path: string, params: RecordValue = {}, input?: unknown): Promise<unknown> {
    const normalizedMethod = method.toLowerCase()
    const body = bodyAsRecord(input)

    if (normalizedMethod === 'get' && path === '/tasks') return page(tasks, params)
    if (normalizedMethod === 'get' && path.startsWith('/tasks/')) return clone(find(tasks, 'taskId', path.slice('/tasks/'.length), path))

    if (normalizedMethod === 'get' && path === '/approvals') return page(approvals, params)
    if (normalizedMethod === 'get' && path.startsWith('/approvals/') && !path.includes('/decision')) return clone(find(approvals, 'code', path.slice('/approvals/'.length), path))
    if (normalizedMethod === 'post' && path === '/approvals') {
      const title = stringValue(body.title)
      if (!title) throw error(422, 'VALIDATION_FAILED', '审批标题不能为空', path, { title: '请输入审批标题' })
      const approval = { code: nextCode('apr'), approvalType: body.approvalType ?? 'R4_TOOL_CALL', sourceSystem: body.sourceSystem ?? 'portal', sourceCode: body.sourceCode, title, requester: demoIdentity.name, status: 'PENDING', slaStatus: 'NONE', detail: body.detail, createdAt: timestamp, updatedAt: timestamp }
      approvals.unshift(approval)
      return clone(approval)
    }
    if (normalizedMethod === 'post' && path === '/approvals/batch-decision') {
      const codes = Array.isArray(body.codes) ? body.codes.map(String) : []
      const decision = body.decision === 'REJECTED' ? 'REJECTED' : 'APPROVED'
      const succeeded: RecordValue[] = []
      const failed: RecordValue[] = []
      codes.forEach((code) => {
        const item = approvals.find((candidate) => candidate.code === code)
        if (!item || item.status !== 'PENDING') failed.push({ code, message: '审批单不存在或已处理' })
        else succeeded.push(clone(update(item, { status: decision, decisionBy: demoIdentity.name, decisionNote: body.decisionNote, decisionAt: timestamp, slaStatus: 'MET' })))
      })
      return { decision, succeeded, failed }
    }
    const nudgeMatch = path.match(/^\/admin\/approvals\/([^/]+)\/nudge$/)
    if (normalizedMethod === 'post' && nudgeMatch) {
      const item = find(approvals, 'code', nudgeMatch[1], path)
      if (item.status !== 'PENDING') throw error(409, 'STATE_CONFLICT', '仅待审批单可以催办', path)
      const notification = {
        id: nextCode('ntf'),
        type: 'APPROVAL_NUDGE',
        title: `催办：${item.title}`,
        body: `审批单 ${item.code} 待处理，请尽快办理。`,
        resourceRef: item.code,
        createdAt: timestamp,
      }
      notifications.unshift(notification)
      return { ok: true, code: item.code }
    }
    if (normalizedMethod === 'post' && path === '/admin/iam/users') {
      const user = { id: `usr-${Date.now().toString(36)}`, name: body.name, username: body.username, tenantId: body.tenantId ?? 'default', roles: body.roles ?? [], status: 'ACTIVE', createdAt: timestamp }
      iamUsers.unshift(user)
      return clone(user)
    }
    if (normalizedMethod === 'get' && path === '/admin/iam/users') {
      const role = stringValue(params.role)
      const scopedUsers = role
        ? iamUsers.filter((user) => Array.isArray(user.roles) && user.roles.includes(role))
        : iamUsers
      return page(scopedUsers, params)
    }
    // D5 角色存储：角色绑定权限（页面访问 + 操作）；删除前校验绑定成员
    if (normalizedMethod === 'get' && path === '/admin/iam/roles') return { items: loadRoles().map((role) => ({ ...role, id: role.code })) }
    if (normalizedMethod === 'post' && path === '/admin/iam/roles') {
      const roleCode = String(body.code ?? '')
      if (loadRoles().some((item) => item.code === roleCode)) throw error(409, 'ROLE_EXISTS', '角色编码已存在', path)
      const role: RoleDef = { code: roleCode, name: String(body.name ?? roleCode), description: String(body.description ?? ''), permissions: (body.permissions as string[]) ?? [], builtin: false }
      const roles = loadRoles()
      roles.push(role)
      persistRoles(roles)
      return clone(role)
    }
    const roleCodeMatch = path.match(/^\/admin\/iam\/roles\/([^/]+)$/)
    if (roleCodeMatch) {
      const roleCode = decodeURIComponent(roleCodeMatch[1])
      const roles = loadRoles()
      const role = roles.find((item) => item.code === roleCode)
      if (!role) throw error(404, 'NOT_FOUND', '未找到角色', path)
      if (normalizedMethod === 'put') {
        role.name = String(body.name ?? role.name)
        role.description = String(body.description ?? role.description)
        role.permissions = (body.permissions as string[]) ?? role.permissions
        persistRoles(roles)
        return clone(role)
      }
      if (normalizedMethod === 'delete') {
        const members = iamUsers.filter((user) => Array.isArray(user.roles) && user.roles.includes(roleCode))
        if (members.length > 0) throw error(409, 'ROLE_IN_USE', `仍有 ${members.length} 名用户绑定该角色`, path)
        persistRoles(roles.filter((item) => item.code !== roleCode))
        return { ok: true }
      }
    }
    if (normalizedMethod === 'get' && path === '/admin/iam/audit-logs') return { items: iamAuditLogs.map(clone) }

    const userRolesMatch = path.match(/^\/admin\/iam\/users\/([^/]+)\/roles$/)
    if (normalizedMethod === 'put' && userRolesMatch) {
      const user = find(iamUsers, 'id', userRolesMatch[1], path)
      const roles = stringArray(body.roles)
      if (roles.length === 0) throw error(422, 'VALIDATION_FAILED', '至少为用户分配一个角色', path, { roles: '请选择至少一个角色' })
      const unknownRoles = roles.filter((code) => !iamRoles.some((role) => role.code === code))
      if (unknownRoles.length > 0) throw error(422, 'VALIDATION_FAILED', '包含未知角色', path, { roles: `未知角色：${unknownRoles.join('、')}` })
      update(user, { roles })
      iamAuditLogs.unshift({
        id: nextCode('iam-audit'),
        action: 'IAM_UPDATE_USER_ROLES',
        targetId: user.id,
        targetName: user.name,
        detail: `角色调整为：${roles.join('、')}`,
        operator: demoIdentity.name,
        createdAt: timestamp,
      })
      return clone(user)
    }

    const userStatusMatch = path.match(/^\/admin\/iam\/users\/([^/]+)\/status$/)
    if (normalizedMethod === 'put' && userStatusMatch) {
      const user = find(iamUsers, 'id', userStatusMatch[1], path)
      const status = stringValue(body.status)
      if (status !== 'ACTIVE' && status !== 'DISABLED') {
        throw error(422, 'VALIDATION_FAILED', '用户状态无效', path, { status: '状态只能是 ACTIVE 或 DISABLED' })
      }
      if (status === 'DISABLED' && Array.isArray(user.roles) && user.roles.includes('portal-admin')) {
        const otherActiveAdmin = iamUsers.some((candidate) => candidate.id !== user.id && candidate.status === 'ACTIVE' && Array.isArray(candidate.roles) && candidate.roles.includes('portal-admin'))
        if (!otherActiveAdmin) throw error(409, 'STATE_CONFLICT', '不能停用最后一个启用的门户管理员', path)
      }
      update(user, { status })
      iamAuditLogs.unshift({
        id: nextCode('iam-audit'),
        action: 'IAM_UPDATE_USER_STATUS',
        targetId: user.id,
        targetName: user.name,
        detail: status === 'ACTIVE' ? '已启用用户' : '已停用用户',
        operator: demoIdentity.name,
        createdAt: timestamp,
      })
      return clone(user)
    }
    if (normalizedMethod === 'get' && path === '/admin/abac-policies') return { items: abacPolicies.map(clone) }

    const decisionMatch = path.match(/^\/approvals\/([^/]+)\/decision$/)
    if (normalizedMethod === 'post' && decisionMatch) {
      const item = find(approvals, 'code', decisionMatch[1], path)
      if (item.status !== 'PENDING') throw error(409, 'STATE_CONFLICT', '审批单已处理，不能重复决策', path)
      const decision = body.decision === 'REJECTED' ? 'REJECTED' : 'APPROVED'
      return clone(update(item, { status: decision, decisionBy: demoIdentity.name, decisionNote: body.decisionNote, decisionAt: timestamp, slaStatus: 'MET' }))
    }

    if (normalizedMethod === 'get' && path === '/results') return page(results, params)
    const resultMatch = path.match(/^\/results\/([^/]+)\/([^/]+)$/)
    if (resultMatch && normalizedMethod === 'get') return clone(find(results, 'resultId', resultMatch[2], path))
    if (resultMatch && normalizedMethod === 'put') {
      const existing = results.find((item) => item.resultId === resultMatch[2] && item.sourceSystem === resultMatch[1])
      const registered = existing ?? { resultId: resultMatch[2], sourceSystem: resultMatch[1], createdAt: timestamp }
      if (!existing) results.unshift(registered)
      return clone(update(registered, { ...body, updatedAt: timestamp }))
    }

    if (normalizedMethod === 'get' && path === '/requirements') return page(requirements, params)
    const overlapMatch = path.match(/^\/requirements\/([^/]+)\/overlap-candidates$/)
    if (normalizedMethod === 'get' && overlapMatch) {
      const source = find(requirements, 'code', overlapMatch[1], path)
      return requirements
        .map((candidate) => overlapFor(source, candidate))
        .filter((candidate): candidate is RecordValue => candidate !== null)
        .sort((left, right) => Number(right.score) - Number(left.score))
        .map(clone)
    }
    const consolidateMatch = path.match(/^\/requirements\/([^/]+)\/consolidate$/)
    if (normalizedMethod === 'post' && consolidateMatch) {
      const related = find(requirements, 'code', consolidateMatch[1], path)
      const primaryCode = stringValue(body.primaryCode)
      const reason = stringValue(body.reason)
      if (!primaryCode || !reason) throw error(422, 'VALIDATION_FAILED', '请选择主需求并填写整合说明', path)
      const primary = find(requirements, 'code', primaryCode, path)
      if (related.code === primary.code) throw error(409, 'STATE_CONFLICT', '不能将需求整合到自身', path)
      if (TERMINAL_REQUIREMENT_STATUSES.has(String(related.status)) || TERMINAL_REQUIREMENT_STATUSES.has(String(primary.status))) {
        throw error(409, 'STATE_CONFLICT', '已结束的需求不能参与整合', path)
      }
      if (related.status !== 'ANALYZING' || primary.status !== 'ANALYZING') {
        throw error(409, 'STATE_CONFLICT', '请先完成两个需求的分析，再决定是否整合', path)
      }
      if (!overlapFor(related, primary)) {
        throw error(409, 'STATE_CONFLICT', '仅可整合到同类、同敏感等级且存在明确重叠的数据需求', path)
      }
      if (related.consolidation) throw error(409, 'STATE_CONFLICT', '该需求已关联到其他主需求', path)
      if (!primary.consolidation) {
        update(primary, {
          consolidation: {
            primaryCode: primary.code, role: 'PRIMARY', reason, consolidatedBy: demoIdentity.name, consolidatedAt: timestamp, relatedCodes: [related.code],
          },
        })
      } else {
        const consolidation = bodyAsRecord(primary.consolidation)
        update(primary, {
          consolidation: { ...consolidation, relatedCodes: [...stringArray(consolidation.relatedCodes), String(related.code)] },
        })
      }
      return clone(update(related, {
        consolidation: { primaryCode: primary.code, role: 'RELATED', reason, consolidatedBy: demoIdentity.name, consolidatedAt: timestamp },
      }))
    }
    if (normalizedMethod === 'get' && path.startsWith('/requirements/')) return clone(find(requirements, 'code', path.slice('/requirements/'.length), path))
    if (normalizedMethod === 'post' && path === '/requirements') {
      const title = stringValue(body.title)
      if (!title) throw error(422, 'VALIDATION_FAILED', '需求标题不能为空', path, { title: '请输入需求标题' })
      const requirement = {
        code: nextCode('req'), requirementType: body.requirementType ?? 'COMPREHENSIVE', title, description: body.description,
        dataProfile: body.dataProfile, requester: body.requester ?? demoIdentity.name, status: 'OPEN', createdAt: timestamp, updatedAt: timestamp,
      }
      requirements.unshift(requirement)
      return clone(requirement)
    }
    const requirementAction = path.match(/^\/requirements\/([^/]+)\/(analyze|assign|progress|complete|cancel)$/)
    if (normalizedMethod === 'post' && requirementAction) {
      const item = find(requirements, 'code', requirementAction[1], path)
      const action = requirementAction[2]
      const status = String(item.status)
      if (TERMINAL_REQUIREMENT_STATUSES.has(status)) throw error(409, 'STATE_CONFLICT', '终态需求不能继续流转', path)
      if (action === 'analyze') {
        if (status !== 'OPEN') throw error(409, 'STATE_CONFLICT', '仅待分析需求可以开展分析', path)
        const analysis = bodyAsRecord(body.analysis)
        const conclusion = stringValue(analysis.conclusion)
        const feasibility = stringValue(analysis.feasibility)
        const priority = stringValue(analysis.priority)
        if (!conclusion || !feasibility || !priority) {
          throw error(422, 'VALIDATION_FAILED', '请填写分析结论、可行性和优先级', path, { analysis: '分析结论、可行性和优先级均为必填项' })
        }
        return clone(update(item, {
          status: 'ANALYZING',
          analysis: { ...analysis, conclusion, feasibility, priority, risks: stringValue(analysis.risks), analyzedBy: demoIdentity.name, analyzedAt: timestamp },
        }))
      }
      if (action === 'assign') {
        if (status !== 'ANALYZING') throw error(409, 'STATE_CONFLICT', '仅已分析需求可以分派', path)
        const assigneeSystem = stringValue(body.assigneeSystem)
        const plan = bodyAsRecord(body.plan)
        if (!assigneeSystem || !stringValue(plan.owner) || !stringValue(plan.deliverable) || !stringValue(plan.targetDate)) {
          throw error(422, 'VALIDATION_FAILED', '请补全承接系统、负责人、交付物和目标日期', path)
        }
        return clone(update(item, { status: 'ASSIGNED', assigneeSystem, assigneeRef: stringValue(body.assigneeRef), plan }))
      }
      if (action === 'progress') {
        if (status !== 'ASSIGNED' && status !== 'IN_PROGRESS') throw error(409, 'STATE_CONFLICT', '仅已分派或进行中的需求可以登记进度', path)
        const percent = Number(body.percent)
        const note = stringValue(body.note)
        if (!Number.isFinite(percent) || percent < 0 || percent > 100 || !note) {
          throw error(422, 'VALIDATION_FAILED', '请填写 0 到 100 的进度和进度说明', path)
        }
        const progressEntries = Array.isArray(item.progressEntries) ? item.progressEntries : []
        return clone(update(item, {
          status: 'IN_PROGRESS',
          progressEntries: [...progressEntries, { percent, note, recordedBy: demoIdentity.name, recordedAt: timestamp }],
        }))
      }
      if (action === 'complete') {
        if (status !== 'IN_PROGRESS') throw error(409, 'STATE_CONFLICT', '仅进行中的需求可以完成', path)
        const closedNote = stringValue(body.closedNote)
        if (!closedNote) throw error(422, 'VALIDATION_FAILED', '完成需求必须填写结项说明', path)
        return clone(update(item, { status: 'COMPLETED', closedNote }))
      }
      if (status !== 'OPEN' && status !== 'ANALYZING') throw error(409, 'STATE_CONFLICT', '当前状态不能取消需求', path)
      return clone(update(item, { status: 'CANCELED', closedNote: stringValue(body.closedNote) }))
    }

    if (normalizedMethod === 'get' && path === '/operations/notices') return page(notices, params)
    if (normalizedMethod === 'post' && path === '/operations/notices') {
      const title = stringValue(body.title)
      if (!title) throw error(422, 'VALIDATION_FAILED', '公告标题不能为空', path, { title: '请输入公告标题' })
      const notice = { code: nextCode('ntc'), title, content: body.content ?? '', section: body.section ?? '公告', status: 'DRAFT', createdAt: timestamp, updatedAt: timestamp }
      notices.unshift(notice)
      return clone(notice)
    }
    const noticeAction = path.match(/^\/operations\/notices\/([^/]+)\/(publish|archive)$/)
    if (normalizedMethod === 'post' && noticeAction) {
      const notice = find(notices, 'code', noticeAction[1], path)
      return clone(update(notice, noticeAction[2] === 'publish' ? { status: 'PUBLISHED', publishedAt: timestamp } : { status: 'ARCHIVED' }))
    }
    if (normalizedMethod === 'get' && path === '/operations/feedbacks') return page(feedbacks, params)
    if (normalizedMethod === 'post' && path === '/operations/feedbacks') {
      const feedback = { code: nextCode('fb'), title: body.title ?? '未命名反馈', content: body.content ?? '', contact: body.contact, status: 'PENDING', createdAt: timestamp, updatedAt: timestamp }
      feedbacks.unshift(feedback)
      return clone(feedback)
    }
    const feedbackAction = path.match(/^\/operations\/feedbacks\/([^/]+)\/handle$/)
    if (normalizedMethod === 'post' && feedbackAction) return clone(update(find(feedbacks, 'code', feedbackAction[1], path), { status: 'HANDLED', handleNote: body.handleNote, handledAt: timestamp }))
    if (normalizedMethod === 'get' && path === '/operations/statistics') return { noticeTotal: notices.length, publishedNotices: notices.filter((item) => item.status === 'PUBLISHED').length, pendingFeedbacks: feedbacks.filter((item) => item.status === 'PENDING').length }

    // C2 待办中心聚合：审批待办 + 异常任务（补正/催办后续域接入）
    if (normalizedMethod === 'get' && path === '/todos/aggregate') {
      const items = [
        ...approvals
          .filter((item) => item.status === 'PENDING')
          .map((item) => ({
            kind: 'APPROVAL',
            code: String(item.code),
            title: String(item.title),
            deadline: item.slaDeadline ? String(item.slaDeadline) : null,
            slaStatus: String(item.slaStatus ?? 'ON_TIME'),
            route: `/matter/approval/${item.code}`,
          })),
        ...tasks
          .filter((item) => item.status === 'FAILED')
          .map((item) => ({
            kind: 'ANOMALY',
            code: String(item.taskId),
            title: `任务异常：${String(item.stage ?? item.taskId)}`,
            deadline: null,
            slaStatus: null,
            route: `/matter/task/${item.taskId}`,
          })),
      ]
      return { items }
    }

    // C1 统一事项详情：按单号聚合审批/需求/任务/结果，输出统一时间轴。
    const matterMatch = path.match(/^\/matter\/(approval|requirement|task|result)\/([^/]+)$/)
    if (normalizedMethod === 'get' && matterMatch) {
      const kind = matterMatch[1]
      const code = decodeURIComponent(matterMatch[2])
      const source =
        kind === 'approval'
          ? approvals.find((item) => item.code === code)
          : kind === 'requirement'
            ? requirements.find((item) => item.code === code)
            : kind === 'task'
              ? tasks.find((item) => item.taskId === code)
              : results.find((item) => item.code === code)
      if (!source) throw error(404, 'NOT_FOUND', '未找到对应单据', path)
      const title = String(source.title ?? source.taskId ?? code)
      const status = String(source.status)
      const base = { code: String(source.code ?? source.taskId ?? code), title, status, kind }
      const timeline: Array<{ time: string; title: string; state: string }> = [
        { time: String(source.createdAt ?? ''), title: '登记/受理', state: 'done' },
      ]
      if (source.updatedAt) timeline.push({ time: String(source.updatedAt), title: kind === 'approval' ? '最近审批动作' : '最近进展', state: status === 'PENDING' || status === 'RUNNING' ? 'current' : 'done' })
      if (source.decisionAt) timeline.push({ time: String(source.decisionAt), title: `审批决定（${String(source.decisionBy ?? '—')}）`, state: 'done' })
      if (['APPROVED', 'SUCCESS', 'COMPLETED', 'DELIVERED'].includes(status)) timeline.push({ time: String(source.updatedAt ?? ''), title: '已办结', state: 'done' })
      if (['REJECTED', 'FAILED', 'CANCELED', 'CANCELLED'].includes(status)) timeline.push({ time: String(source.updatedAt ?? ''), title: '已终止', state: 'blocked' })
      const mattersActions = status === 'PENDING' ? ['办理', '催办'] : status === 'RUNNING' ? ['取消'] : []
      return {
        ...base,
        slaStatus: source.slaStatus ?? null,
        requester: source.requester ?? source.operator ?? null,
        detail: source.detail ?? null,
        timeline,
        actions: mattersActions,
      }
    }

    // B1 首页聚合：已发布公告 + 跨域待办摘要 + 推荐入口位。
    // 推荐位当前为内置配置，D4 内容运营上线后改由 cms/entry 配置数据驱动。
    if (normalizedMethod === 'get' && path === '/content/home') {
      return {
        greetingName: demoIdentity.name,
        notices: notices
          .filter((item) => item.status === 'PUBLISHED')
          .slice(0, 6)
          .map((item) => clone({ code: item.code, title: item.title, content: item.content, section: item.section, publishedAt: item.publishedAt ? String(item.publishedAt) : String(item.updatedAt) })),
        entries: loadContentEntries()
          .filter((entry) => entry.enabled)
          .map(({ code, title, description, route, icon }) => ({ code, title, description, route, icon })),
        todo: {
          pendingApprovals: approvals.filter((item) => item.status === 'PENDING').length,
          runningTasks: tasks.filter((item) => item.status === 'RUNNING').length,
          openRequirements: requirements.filter((item) => ['OPEN', 'ANALYZING', 'ASSIGNED', 'IN_PROGRESS'].includes(String(item.status))).length,
          unread: notifications.filter((item) => !item.readAt).length,
        },
      }
    }


    if (normalizedMethod === 'get' && path === '/marketplace/data-services') return aggregate('data-platform', page(services, params).items)
    const serviceMatch = path.match(/^\/marketplace\/data-services\/([^/]+)(?:\/apply)?$/)
    if (serviceMatch && normalizedMethod === 'get') return { sourceSystem: 'data-platform', available: true, item: clone(find(services, 'code', serviceMatch[1], path)), body: clone(find(services, 'code', serviceMatch[1], path)) }
    if (serviceMatch && normalizedMethod === 'post' && path.endsWith('/apply')) {
      const service = find(services, 'code', serviceMatch[1], path)
      const approval = { code: nextCode('apr'), approvalType: 'DATA_GRANT', sourceSystem: 'data-platform', sourceCode: service.code, title: `申请使用 ${service.name}`, requester: demoIdentity.name, status: 'PENDING', slaStatus: 'ON_TIME', detail: { serviceCode: service.code, grantedColumns: body.grantedColumns }, createdAt: timestamp, updatedAt: timestamp }
      approvals.unshift(approval)
      return { approvalCode: approval.code, status: approval.status }
    }
    const retryMatch = path.match(/^\/marketplace\/applications\/([^/]+)\/retry-delivery$/)
    if (normalizedMethod === 'post' && retryMatch) {
      const approval = find(approvals, 'code', retryMatch[1], path)
      if (approval.status !== 'APPROVED') throw error(409, 'STATE_CONFLICT', '仅已通过的申请可以重试投递', path)
      const detail = bodyAsRecord(approval.detail)
      return clone(update(approval, { detail: { ...detail, deliveryStatus: 'SUCCEEDED', deliveryError: undefined } }))
    }

    if (normalizedMethod === 'get' && path === '/workbench/capabilities') return aggregate('algorithm-transform', page(capabilities, params).items)
    const capabilityMatch = path.match(/^\/workbench\/capabilities\/([^/]+)$/)
    if (normalizedMethod === 'get' && capabilityMatch) return { sourceSystem: 'algorithm-transform', available: true, item: clone(find(capabilities, 'code', capabilityMatch[1], path)), body: clone(find(capabilities, 'code', capabilityMatch[1], path)) }
    if (normalizedMethod === 'get' && path === '/workbench/workflow-templates') return aggregate('algorithm-recombine', page(templates, params).items)
    const templateMatch = path.match(/^\/workbench\/workflow-templates\/([^/]+)$/)
    if (normalizedMethod === 'get' && templateMatch) return { sourceSystem: 'algorithm-recombine', available: true, item: clone(find(templates, 'code', templateMatch[1], path)), body: clone(find(templates, 'code', templateMatch[1], path)) }
    const runMatch = path.match(/^\/workbench\/workflow-templates\/([^/]+)\/runs$/)
    if (normalizedMethod === 'post' && runMatch) {
      const template = find(templates, 'code', runMatch[1], path)
      if (Number(body.templateVersion) !== Number(template.currentVersion)) throw error(409, 'VERSION_CONFLICT', '模板版本已变化，请刷新后重试', path)
      const task = { taskId: nextCode('tsk-run'), taskType: 'WORKFLOW_EXECUTION', sourceSystem: 'algorithm-recombine', status: 'RUNNING', stage: '已提交到重组工具', progress: 0, resourceRefs: [String(template.code)], resultRefs: [], traceId: `mock-trace-${sequence}`, createdAt: timestamp, updatedAt: timestamp }
      tasks.unshift(task)
      return { taskId: task.taskId, status: task.status, started: true }
    }

    if (normalizedMethod === 'get' && path === '/personal/me') return { ...demoIdentity }
    if (normalizedMethod === 'get' && path === '/personal/requirements') {
      return page(requirements.filter((item) => item.requester === demoIdentity.name), params)
    }
    if (normalizedMethod === 'get' && path === '/personal/approvals') return page(approvals.filter((item) => item.requester === demoIdentity.name), params)
    if (normalizedMethod === 'get' && path === '/personal/todos') return {
      pendingApprovalCount: approvals.filter((item) => item.status === 'PENDING').length,
      myOpenRequirementCount: requirements.filter((item) => item.requester === demoIdentity.name && !['COMPLETED', 'CANCELED'].includes(String(item.status))).length,
      myRequirementCount: requirements.filter((item) => item.requester === demoIdentity.name).length,
      myApprovalCount: approvals.filter((item) => item.requester === demoIdentity.name).length,
    }
    if (normalizedMethod === 'get' && path === '/personal/notifications') return page(notifications, params)
    if (normalizedMethod === 'get' && path === '/personal/notifications/unread-count') return { unread: notifications.filter((item) => !item.readAt).length }
    const notificationMatch = path.match(/^\/personal\/notifications\/([^/]+)\/read$/)
    if (normalizedMethod === 'post' && notificationMatch) return clone(update(find(notifications, 'id', notificationMatch[1], path), { readAt: timestamp }))
    if (normalizedMethod === 'post' && path === '/personal/notifications/read-all') {
      notifications.forEach((item) => update(item, { readAt: timestamp }))
      return { unread: 0 }
    }

    console.warn(`[mock] uncovered route ${normalizedMethod.toUpperCase()} ${path}`)
    throw error(404, 'NOT_FOUND', '未找到对应资源', path)
  }

  return { request }
}
