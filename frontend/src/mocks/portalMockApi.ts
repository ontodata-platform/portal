/**
 * 门户的浏览器内本地模拟。
 *
 * 这里模拟门户自己的聚合视图和受控操作，不模拟数据库、集群、对象存储或其他基础设施。
 * 数据仅存在于当前浏览器会话；刷新即还原。路由、字段和状态机与真实 /api/v1 契约保持一致，
 * 以便后续联调只替换 transport adapter，而不改写页面业务逻辑。
 */

import { demoIdentity, seedDataServices } from './seed'

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

const timestamp = '2026-08-31T09:30:00.000Z'

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
  const domain = stringValue(params.domain)?.toLowerCase()
  const filtered = items.filter((item) => {
    if (status && item.status !== status) return false
    if (type && item.taskType !== type && item.approvalType !== type && item.requirementType !== type) return false
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

export function createPortalMockApi(): PortalMockApi {
  const approvals: RecordValue[] = [
    {
      code: 'apr-data-001', approvalType: 'DATA_GRANT', sourceSystem: 'data-platform', sourceCode: 'ds-customer-monthly',
      title: '客户主数据服务使用申请', requester: '张晓明', status: 'PENDING', slaStatus: 'ON_TIME',
      detail: { serviceCode: 'ds-customer-monthly', grantedColumns: ['customer_id', 'segment'] }, createdAt: timestamp, updatedAt: timestamp,
    },
    {
      code: 'apr-r4-sample', approvalType: 'R4_TOOL_CALL', sourceSystem: 'mcp-gateway', sourceCode: 'cfm-sample',
      title: '调用工具 workflow.submit_execution 需要审批', requester: '当前用户', status: 'PENDING', slaStatus: 'ON_TIME',
      detail: { tool: 'workflow.submit_execution', riskLevel: 'R4' }, createdAt: timestamp, updatedAt: timestamp,
    },
    {
      code: 'apr-delivery-002', approvalType: 'DATA_GRANT', sourceSystem: 'data-platform', sourceCode: 'ds-device-daily',
      title: '设备遥测服务订阅', requester: '当前用户', status: 'APPROVED', slaStatus: 'MET',
      detail: { serviceCode: 'ds-device-daily', deliveryStatus: 'FAILED', deliveryError: '等待管理平台重新投递' },
      createdAt: timestamp, updatedAt: timestamp,
    },
  ]
  const tasks: RecordValue[] = [
    {
      taskId: 'tsk-run-001', taskType: 'WORKFLOW_EXECUTION', sourceSystem: 'algorithm-recombine', status: 'RUNNING', stage: '执行节点 2/3', progress: 62,
      resourceRefs: ['tpl-risk-flow@2', 'cap-risk-score@3'], resultRefs: [], traceId: 'mock-trace-run-001', createdAt: timestamp, updatedAt: timestamp,
    },
    {
      taskId: 'tsk-import-002', taskType: 'DATA_IMPORT', sourceSystem: 'data-platform', status: 'SUCCESS', stage: '质量校验完成', progress: 100,
      resourceRefs: ['dataset-order@12'], resultRefs: ['result-quality-002'], traceId: 'mock-trace-import-002', createdAt: timestamp, updatedAt: timestamp,
    },
  ]
  const requirements: RecordValue[] = [
    {
      code: 'req-001', requirementType: 'COMPREHENSIVE', title: '供应链风险分析场景', description: '整合订单数据、风险算法和本体规则。', requester: '当前用户',
      status: 'IN_PROGRESS', assigneeSystem: 'algorithm-recombine', assigneeRef: 'tpl-risk-flow', createdAt: timestamp, updatedAt: timestamp,
    },
    {
      code: 'req-002', requirementType: 'DATA', title: '补充区域仓储数据', description: '申请区域仓储日快照。', requester: '当前用户',
      status: 'OPEN', createdAt: timestamp, updatedAt: timestamp,
    },
  ]
  const notices: RecordValue[] = [
    { code: 'ntc-001', title: '本周质量分析批次已开放', content: '客户质量分析-周批已对制造业数据团队开放，可在算法工作台提交。', section: '公告', status: 'PUBLISHED', publishedAt: timestamp, createdAt: timestamp, updatedAt: timestamp },
    { code: 'ntc-002', title: '数据服务目录更新', content: '新增设备遥测-日增量，支持申请后审批投递。', section: '服务动态', status: 'PUBLISHED', publishedAt: timestamp, createdAt: timestamp, updatedAt: timestamp },
  ]
  const notifications: RecordValue[] = [
    { id: 'ntf-001', type: 'APPROVAL_DECIDED', title: '有一项数据服务申请待审批', body: '请在审批中心处理客户主数据服务申请。', resourceRef: 'apr-data-001', createdAt: timestamp },
    { id: 'ntf-002', type: 'TASK_COMPLETED', title: '数据导入任务已完成', body: '订单数据质量校验已通过。', resourceRef: 'tsk-import-002', readAt: timestamp, createdAt: timestamp },
  ]
  const services: RecordValue[] = seedDataServices.map((item) => ({
    code: item.code,
    name: item.name,
    status: 'ONLINE',
    currentVersion: item.version,
    classification: item.classification,
    subscribed: item.subscribed,
    description:
      item.code === 'ds-customer-monthly'
        ? '制造业客户主数据月度快照，供分析与订阅投递。'
        : item.code === 'ds-device-daily'
          ? '产线设备遥测日增量，含密级字段需审批后开通。'
          : '供应商信用季度评估，支持按服务申请订阅。',
  }))
  const capabilities: RecordValue[] = [
    { code: 'cap-risk-score', name: '风险评分算法能力', status: 'ADMITTED', currentVersion: 3, description: '已准入的风险评分算法。' },
    { code: 'cap-order-check', name: '订单校验算法能力', status: 'ADMITTED', currentVersion: 1, description: '已准入的订单校验算法。' },
  ]
  const templates: RecordValue[] = [
    { code: 'tpl-risk-flow', name: '供应链风险研判流程', status: 'PUBLISHED', currentVersion: 2, description: '订单输入、风险评分和规则解释。' },
    { code: 'tpl-order-check', name: '订单质量校验流程', status: 'PUBLISHED', currentVersion: 1, description: '订单数据规范性校验。' },
  ]
  const results: RecordValue[] = [
    { resultId: 'result-quality-002', sourceSystem: 'data-platform', resultType: 'QUALITY_REPORT', resourceRefs: ['dataset-order@12'], metadata: { qualityScore: 98 }, sourceTaskId: 'tsk-import-002', traceId: 'mock-trace-import-002', createdAt: timestamp, updatedAt: timestamp },
  ]
  const feedbacks: RecordValue[] = []
  const scenarios: RecordValue[] = [
    {
      code: 'scn-risk-001', version: '1.0.0', name: '供应链风险分析', description: '已发布的风险分析场景。', status: 'PUBLISHED', tenantId: 'default', createdBy: '当前用户',
      ontologyRefs: [{ packageCode: 'pkg-supply-chain', version: '1.0.0' }],
      bindings: [{ type: 'WORKFLOW_TEMPLATE', ref: 'tpl-risk-flow', version: '2.0.0', alias: 'riskFlow', sourceSystem: 'ALGORITHM_RECOMBINE' }],
      createdAt: timestamp, updatedAt: timestamp,
    },
  ]
  let sequence = 3

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
      const approval = { code: nextCode('apr'), approvalType: body.approvalType ?? 'R4_TOOL_CALL', sourceSystem: body.sourceSystem ?? 'portal', sourceCode: body.sourceCode, title, requester: '当前用户', status: 'PENDING', slaStatus: 'NONE', detail: body.detail, createdAt: timestamp, updatedAt: timestamp }
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
        else succeeded.push(clone(update(item, { status: decision, decisionBy: '当前用户', decisionNote: body.decisionNote, decisionAt: timestamp, slaStatus: 'MET' })))
      })
      return { decision, succeeded, failed }
    }
    const decisionMatch = path.match(/^\/approvals\/([^/]+)\/decision$/)
    if (normalizedMethod === 'post' && decisionMatch) {
      const item = find(approvals, 'code', decisionMatch[1], path)
      if (item.status !== 'PENDING') throw error(409, 'STATE_CONFLICT', '审批单已处理，不能重复决策', path)
      const decision = body.decision === 'REJECTED' ? 'REJECTED' : 'APPROVED'
      return clone(update(item, { status: decision, decisionBy: '当前用户', decisionNote: body.decisionNote, decisionAt: timestamp, slaStatus: 'MET' }))
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
    if (normalizedMethod === 'get' && path.startsWith('/requirements/')) return clone(find(requirements, 'code', path.slice('/requirements/'.length), path))
    if (normalizedMethod === 'post' && path === '/requirements') {
      const title = stringValue(body.title)
      if (!title) throw error(422, 'VALIDATION_FAILED', '需求标题不能为空', path, { title: '请输入需求标题' })
      const requirement = { code: nextCode('req'), requirementType: body.requirementType ?? 'COMPREHENSIVE', title, description: body.description, requester: body.requester ?? '当前用户', status: 'OPEN', createdAt: timestamp, updatedAt: timestamp }
      requirements.unshift(requirement)
      return clone(requirement)
    }
    const requirementAction = path.match(/^\/requirements\/([^/]+)\/(analyze|assign|progress|complete|cancel)$/)
    if (normalizedMethod === 'post' && requirementAction) {
      const item = find(requirements, 'code', requirementAction[1], path)
      const action = requirementAction[2]
      const nextStatus: Record<string, string> = { analyze: 'ANALYZING', assign: 'ASSIGNED', progress: 'IN_PROGRESS', complete: 'COMPLETED', cancel: 'CANCELED' }
      if (item.status === 'COMPLETED' || item.status === 'CANCELED') throw error(409, 'STATE_CONFLICT', '终态需求不能继续流转', path)
      return clone(update(item, { status: nextStatus[action], ...(action === 'assign' ? { assigneeSystem: body.assigneeSystem, assigneeRef: body.assigneeRef, plan: body.plan } : {}), ...(action === 'complete' || action === 'cancel' ? { closedNote: body.closedNote } : {}) }))
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

    if (normalizedMethod === 'get' && path === '/marketplace/data-services') return aggregate('data-platform', page(services, params).items)
    const serviceMatch = path.match(/^\/marketplace\/data-services\/([^/]+)(?:\/apply)?$/)
    if (serviceMatch && normalizedMethod === 'get') return { sourceSystem: 'data-platform', available: true, item: clone(find(services, 'code', serviceMatch[1], path)), body: clone(find(services, 'code', serviceMatch[1], path)) }
    if (serviceMatch && normalizedMethod === 'post' && path.endsWith('/apply')) {
      const service = find(services, 'code', serviceMatch[1], path)
      const approval = { code: nextCode('apr'), approvalType: 'DATA_GRANT', sourceSystem: 'data-platform', sourceCode: service.code, title: `申请使用 ${service.name}`, requester: '当前用户', status: 'PENDING', slaStatus: 'ON_TIME', detail: { serviceCode: service.code, grantedColumns: body.grantedColumns }, createdAt: timestamp, updatedAt: timestamp }
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

    if (normalizedMethod === 'get' && path === '/scenarios') return page(scenarios, params)
    if (normalizedMethod === 'post' && path === '/scenarios') {
      const name = stringValue(body.name)
      const bindings = Array.isArray(body.bindings) ? body.bindings : []
      if (!name || bindings.length === 0) throw error(422, 'VALIDATION_FAILED', '场景名称和至少一个装配绑定不能为空', path, { name: '请输入场景名称', bindings: '至少添加一个装配绑定' })
      const scenario = { code: nextCode('scn'), version: '1.0.0', name, description: body.description, projectId: body.projectId, status: 'DRAFT', ontologyRefs: body.ontologyRefs ?? [], bindings, presentation: body.presentation, tenantId: 'default', createdBy: body.createdBy ?? '当前用户', createdAt: timestamp, updatedAt: timestamp }
      scenarios.unshift(scenario)
      return clone(scenario)
    }
    const scenarioVersionMatch = path.match(/^\/scenarios\/([^/]+)\/versions\/([^/]+)\/(publish|deprecate)$/)
    if (normalizedMethod === 'post' && scenarioVersionMatch) {
      const scenario = scenarios.find((item) => item.code === scenarioVersionMatch[1] && item.version === scenarioVersionMatch[2])
      if (!scenario) throw error(404, 'NOT_FOUND', '未找到场景版本', path)
      return clone(update(scenario, { status: scenarioVersionMatch[3] === 'publish' ? 'PUBLISHED' : 'DEPRECATED' }))
    }
    const scenarioDraftMatch = path.match(/^\/scenarios\/([^/]+)\/drafts$/)
    if (normalizedMethod === 'post' && scenarioDraftMatch) {
      const base = find(scenarios, 'code', scenarioDraftMatch[1], path)
      const draft = { ...clone(base), version: `1.0.${sequence++}`, status: 'DRAFT', createdAt: timestamp, updatedAt: timestamp }
      scenarios.unshift(draft)
      return clone(draft)
    }
    const scenarioUpdateMatch = path.match(/^\/scenarios\/([^/]+)\/versions\/([^/]+)$/)
    if (normalizedMethod === 'put' && scenarioUpdateMatch) {
      const scenario = scenarios.find((item) => item.code === scenarioUpdateMatch[1] && item.version === scenarioUpdateMatch[2])
      if (!scenario) throw error(404, 'NOT_FOUND', '未找到场景版本', path)
      if (scenario.status !== 'DRAFT') throw error(409, 'STATE_CONFLICT', '仅草稿场景可以编辑', path)
      return clone(update(scenario, body))
    }
    if (normalizedMethod === 'get' && path.startsWith('/scenarios/')) return clone(find(scenarios, 'code', path.slice('/scenarios/'.length), path))

    if (normalizedMethod === 'get' && path === '/personal/me') return { ...demoIdentity }
    if (normalizedMethod === 'get' && path === '/personal/requirements') return page(requirements.filter((item) => item.requester === '当前用户'), params)
    if (normalizedMethod === 'get' && path === '/personal/approvals') return page(approvals.filter((item) => item.requester === '当前用户'), params)
    if (normalizedMethod === 'get' && path === '/personal/todos') return {
      pendingApprovalCount: approvals.filter((item) => item.status === 'PENDING').length,
      myOpenRequirementCount: requirements.filter((item) => item.requester === '当前用户' && !['COMPLETED', 'CANCELED'].includes(String(item.status))).length,
      myRequirementCount: requirements.filter((item) => item.requester === '当前用户').length,
      myApprovalCount: approvals.filter((item) => item.requester === '当前用户').length,
    }
    if (normalizedMethod === 'get' && path === '/personal/notifications') return page(notifications, params)
    if (normalizedMethod === 'get' && path === '/personal/notifications/unread-count') return { unread: notifications.filter((item) => !item.readAt).length }
    const notificationMatch = path.match(/^\/personal\/notifications\/([^/]+)\/read$/)
    if (normalizedMethod === 'post' && notificationMatch) return clone(update(find(notifications, 'id', notificationMatch[1], path), { readAt: timestamp }))
    if (normalizedMethod === 'post' && path === '/personal/notifications/read-all') {
      notifications.forEach((item) => update(item, { readAt: timestamp }))
      return { unread: 0 }
    }

    if (normalizedMethod === 'post' && path === '/projections/rebuild') {
      return { consumerGroup: 'portal.task-projection-rebuild-mock', polled: 0, applied: 0, duplicate: 0, stale: 0, unknown: 0, tasks: tasks.length, elapsedMillis: 12 }
    }
    if (normalizedMethod === 'get' && path === '/retention/status') {
      return { retentionDays: 180, cutoffAt: new Date(Date.now() - 180 * 86400e3).toISOString(), tasks: 0, approvals: 0, requirements: 0, feedbacks: 0, notices: 0 }
    }
    if (normalizedMethod === 'post' && path === '/retention/cleanup') {
      return { dryRun: params.dryRun !== 'false' && params.dryRun !== false, tasks: 0, approvals: 0, requirements: 0, feedbacks: 0, notices: 0 }
    }

    console.warn(`[mock] uncovered route ${normalizedMethod.toUpperCase()} ${path}`)
    throw error(404, 'NOT_FOUND', '未找到对应资源', path)
  }

  return { request }
}
