/**
 * 算法工作台本地模拟（v4 §7/§10）：服务描述符、我的运行、制品、预检、我的交付。
 * L2 切换：apiMode==='remote' 时由 api/algorithm-workbench.ts 走真实聚合接口（§8 P0：D-1/D-3/A-1/A-2/A-3）。
 */
import type {
  AlgorithmRun,
  AlgorithmServiceSummary,
  MyDelivery,
  ServiceDescriptor,
} from '@/types/descriptor'
import { relativeIso } from '@/mocks/seed'

export interface AlgorithmWorkbenchMockApi {
  request: (method: string, path: string, params?: Record<string, unknown>, body?: unknown) => Promise<unknown>
}

interface ServiceRecord {
  summary: AlgorithmServiceSummary
  descriptor: ServiceDescriptor
}

function error(status: number, code: string, message: string, path: string) {
  return {
    response: {
      status,
      data: { status, code, message, path, traceId: `mock-${code.toLowerCase()}` },
    },
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function page<T>(items: T[], params: Record<string, unknown> = {}) {
  const current = Math.max(1, Number(params.page ?? 1))
  const size = Math.max(1, Number(params.size ?? 20))
  return { total: items.length, items: items.slice((current - 1) * size, current * size).map(clone) }
}

const deliveries: MyDelivery[] = [
  { serviceCode: 'ds-customer-monthly', serviceName: '客户主数据-月度快照', version: 'v2026.08', snapshotDate: '2026-08-31', expiresAt: '2026-12-31', state: 'ACTIVE' },
  { serviceCode: 'ds-customer-monthly', serviceName: '客户主数据-月度快照', version: 'v2026.07', snapshotDate: '2026-07-31', expiresAt: '2026-11-30', state: 'ACTIVE' },
  { serviceCode: 'ds-device-daily', serviceName: '设备遥测-日增量', version: 'v2026.09.01', snapshotDate: '2026-09-01', expiresAt: '2026-09-15', state: 'EXPIRING' },
]

function serviceDescriptor(code: string, name: string, description: string): ServiceDescriptor {
  return {
    schemaVersion: '1.0',
    serviceType: 'algorithm-service',
    provider: 'algorithm-recombine',
    code,
    name,
    summary: { version: '1.2.0', status: 'PUBLISHED', badges: ['准入：APPROVED', '语义依赖：客户主题'] },
    sections: [
      { type: 'summary', title: '基本信息', fields: [
        { label: '服务编码', value: code },
        { label: '当前版本', value: '1.2.0' },
        { label: '提供方', value: '算法重组平台' },
        { label: '能力准入', value: 'APPROVED' },
      ] },
      { type: 'richtext', title: '服务说明', text: description },
      { type: 'inputs', title: '输入要求', inputs: [
        { key: 'customerData', label: '客户主数据', kind: 'dataset-ref', required: true, hint: '从我的订阅与交付中选择版本' },
        { key: 'qualityThreshold', label: '质量合格阈值', kind: 'number', defaultValue: '0.8', hint: '0~1 之间的小数' },
      ] },
      { type: 'outputs', title: '输出说明', items: [
        { label: '质量分析报告', value: '字段级合格率与问题明细（XLSX）' },
        { label: '证据归档', value: '运行快照与校验记录' },
      ] },
      { type: 'semantic-deps', title: '语义依赖', items: [
        { label: '客户主题本体', value: '已发布版本（运行时自动校验兼容性）' },
      ] },
      { type: 'history', title: '运行历史', stats: [
        { label: '累计运行', value: '128 次' },
        { label: '近 30 天成功率', value: '98.4%' },
        { label: '典型耗时', value: '6~9 分钟' },
      ] },
    ],
    actions: [
      { id: 'run', label: '立即运行', kind: 'flow', flow: 'run' },
    ],
  }
}

const services: ServiceRecord[] = [
  { summary: { code: 'tpl-quality-weekly', name: '客户质量分析-周批', category: '质量分析', description: '按客户主题口径对客户主数据做字段级质量核查并输出报告。', inputHint: '需要：客户主数据', typicalDuration: '6~9 分钟', runCount: 128, status: 'PUBLISHED', badges: ['准入：APPROVED'] }, descriptor: serviceDescriptor('tpl-quality-weekly', '客户质量分析-周批', '按客户主题口径对客户主数据做字段级质量核查：完整性、唯一性、格式合规，输出报告与证据归档。') },
  { summary: { code: 'cap-anomaly-detect', name: '设备异常检测', category: '异常检测', description: '基于设备遥测数据的时序异常检测，标记疑似异常时段。', inputHint: '需要：设备遥测', typicalDuration: '3~5 分钟', runCount: 86, status: 'PUBLISHED', badges: ['准入：APPROVED'] }, descriptor: serviceDescriptor('cap-anomaly-detect', '设备异常检测', '基于设备遥测时序数据检测异常波动，输出疑似异常时段与置信度，供人工复核。') },
  { summary: { code: 'tpl-churn-train', name: '流失预测-训练', category: '预测', description: '以客户主数据与历史行为训练流失预测模型。', inputHint: '需要：客户主数据', typicalDuration: '20~40 分钟', runCount: 12, status: 'PUBLISHED', badges: ['准入：APPROVED'] }, descriptor: serviceDescriptor('tpl-churn-train', '流失预测-训练', '训练客户流失预测模型；训练完成生成模型版本与评估报告，推理服务另行订阅。') },
  { summary: { code: 'cap-sales-forecast', name: '销量预测-月度', category: '预测', description: '按月度销量序列生成下月预测区间。', inputHint: '需要：销量历史', typicalDuration: '4~6 分钟', runCount: 34, status: 'PUBLISHED', badges: ['准入：APPROVED'] }, descriptor: serviceDescriptor('cap-sales-forecast', '销量预测-月度', '按历史月度销量生成下月预测区间，输出预测表与置信区间图。') },
  { summary: { code: 'cap-complaint-classify', name: '文本投诉分类', category: '文本处理', description: '对投诉文本做主题分类与紧急度评级。', inputHint: '需要：投诉记录', typicalDuration: '2~4 分钟', runCount: 57, status: 'PUBLISHED', badges: ['准入：APPROVED'] }, descriptor: serviceDescriptor('cap-complaint-classify', '文本投诉分类', '对投诉文本做主题分类与紧急度评级，输出分类明细表。') },
]

const categories = [...new Set(services.map((item) => item.summary.category))]

const runs: AlgorithmRun[] = [
  { taskId: 'task-a1b2c3d4', serviceCode: 'tpl-quality-weekly', serviceName: '客户质量分析-周批', status: 'SUCCEEDED', stage: '已完成', startedAt: relativeIso(20), duration: '7 分 12 秒', nodes: [
    { name: '数据准备', state: 'SUCCEEDED', startedAt: relativeIso(20), finishedAt: relativeIso(19.6) },
    { name: '质量核查', state: 'SUCCEEDED', startedAt: relativeIso(19.6), finishedAt: relativeIso(19.1) },
    { name: '报告生成', state: 'SUCCEEDED', startedAt: relativeIso(19.1), finishedAt: relativeIso(18.8) },
  ], artifacts: [ { name: '客户质量分析报告.xlsx', kind: 'BUSINESS_DATA', size: '842 KB' }, { name: '运行证据包.zip', kind: 'EVIDENCE', size: '96 KB' } ],
  container: { containerId: 'ctr-7f2a91', image: 'registry/quality-weekly:1.2.0', node: 'algo-node-02', state: 'EXITED', cpu: '已释放', mem: '已释放', logTail: ['[12:04] 字段核查完成：128 项', '[12:05] 报告写入对象存储', '[12:05] 容器正常退出 (code=0)'] },
  outputSpec: { name: '客户质量分析报告-周批', description: '字段级合格率与问题明细', archiveTier: 'standard' } },
  { taskId: 'task-b2c3d4e5', serviceCode: 'cap-anomaly-detect', serviceName: '设备异常检测', status: 'RUNNING', stage: '异常检测中（2/3 节点）', startedAt: relativeIso(0.5), duration: '已运行 3 分钟', nodes: [
    { name: '数据准备', state: 'SUCCEEDED', startedAt: relativeIso(0.5), finishedAt: relativeIso(0.3) },
    { name: '异常检测', state: 'RUNNING', startedAt: relativeIso(0.3) },
    { name: '结果汇聚', state: 'PENDING' },
  ], artifacts: [],
  container: { containerId: 'ctr-c41d02', image: 'registry/anomaly-detect:2.0.0', node: 'algo-node-01', state: 'RUNNING', cpu: '1.6 核', mem: '2.4 GB', logTail: ['[14:41] 加载遥测分片 3/7', '[14:42] 滑动窗口推理中…'] } },
  { taskId: 'task-c3d4e5f6', serviceCode: 'tpl-quality-weekly', serviceName: '客户质量分析-周批', status: 'FAILED', stage: '预检未通过', startedAt: relativeIso(30), duration: '—', humanReason: '输入数据“客户主数据-月度快照”的订阅已过期，无法读取该版本。', fixHint: '到数据工作台续订该服务后重新发起运行。', nodes: [
    { name: '预检', state: 'FAILED', startedAt: relativeIso(30), finishedAt: relativeIso(30), humanReason: '订阅过期', fixHint: '续订后重试' },
  ], artifacts: [],
  container: { containerId: 'ctr-90aa13', image: 'registry/quality-weekly:1.2.0', node: 'algo-node-02', state: 'FAILED', cpu: '已释放', mem: '已释放', logTail: ['[09:12] 预检失败：订阅过期 (code=SUBSCRIPTION_EXPIRED)', '[09:12] 容器异常退出 (code=1)'] } },
  { taskId: 'task-d4e5f6g7', serviceCode: 'cap-sales-forecast', serviceName: '销量预测-月度', status: 'SUCCEEDED', stage: '已完成', startedAt: relativeIso(74), duration: '5 分 02 秒', nodes: [
    { name: '数据准备', state: 'SUCCEEDED', startedAt: relativeIso(74), finishedAt: relativeIso(73.6) },
    { name: '预测计算', state: 'SUCCEEDED', startedAt: relativeIso(73.6), finishedAt: relativeIso(73.2) },
  ], artifacts: [ { name: '下月销量预测.csv', kind: 'BUSINESS_DATA', size: '38 KB' } ],
  container: { containerId: 'ctr-55be70', image: 'registry/sales-forecast:1.0.3', node: 'algo-node-03', state: 'EXITED', cpu: '已释放', mem: '已释放', logTail: ['[08:30] 预测区间生成', '[08:30] 容器正常退出 (code=0)'] } },
  { taskId: 'task-e5f6g7h8', serviceCode: 'cap-complaint-classify', serviceName: '文本投诉分类', status: 'CANCELLED', stage: '已取消', startedAt: relativeIso(96), duration: '1 分 10 秒', nodes: [
    { name: '数据准备', state: 'SUCCEEDED', startedAt: relativeIso(96), finishedAt: relativeIso(95.7) },
    { name: '文本分类', state: 'CANCELLED', startedAt: relativeIso(95.7) },
  ], artifacts: [] },
]

const testDataUploads: Array<{ ref: string; fileName: string; note: string }> = []

export function createAlgorithmWorkbenchMockApi(): AlgorithmWorkbenchMockApi {
  let sequence = 0

  async function request(method: string, path: string, params: Record<string, unknown> = {}, body?: unknown): Promise<unknown> {
    const normalizedMethod = method.toUpperCase()
    await Promise.resolve()

    if (normalizedMethod === 'GET' && path === '/algorithm-services') {
      const keyword = String(params.keyword ?? '').toLowerCase()
      const category = String(params.category ?? '')
      const filtered = services
        .map((item) => item.summary)
        .filter((item) => (category ? item.category === category : true))
        .filter((item) => (keyword ? `${item.name}${item.description}`.toLowerCase().includes(keyword) : true))
      return page(filtered, params)
    }

    if (normalizedMethod === 'GET' && path === '/algorithm-categories') return { items: clone(categories) }

    const testDataMatch = path.match(/^\/test-data$/)
    if (normalizedMethod === 'POST' && testDataMatch) {
      const bodyRecord = (body ?? {}) as { fileName?: string }
      const fileName = bodyRecord.fileName ?? 'test-data.csv'
      if (!/\.(csv|json)$/i.test(fileName)) {
        throw error(422, 'VALIDATION_FAILED', '测试数据仅支持 CSV / JSON 文件', path)
      }
      sequence += 1
      const receipt = { ref: `test:td-${String(sequence).padStart(3, '0')}`, fileName, note: '仅本次运行有效，随证据归档' }
      testDataUploads.push(receipt)
      return clone(receipt)
    }

    const serviceMatch = path.match(/^\/algorithm-services/)
    if (normalizedMethod === 'GET' && serviceMatch) {
      const code = decodeURIComponent(path.replace('/algorithm-services/', ''))
      const found = services.find((item) => item.summary.code === code)
      if (!found) throw error(404, 'NOT_FOUND', '未找到该算法服务', path)
      return { ...clone(found.summary), descriptor: clone(found.descriptor) }
    }

    if (normalizedMethod === 'GET' && path === '/my/deliveries') return { total: deliveries.length, items: deliveries.map(clone) }

    const preflightMatch = path.match(/^\/algorithm-services\/([^/]+)\/preflight$/)
    if (normalizedMethod === 'POST' && preflightMatch) {
      const inputs = (body as { inputs?: Record<string, string> } | undefined)?.inputs ?? {}
      const checks = [
        { label: '语义依赖', state: 'pass', hint: '客户主题本体已发布且兼容' },
        { label: '数据就绪', state: Object.keys(inputs).length > 0 ? 'pass' : 'fail', hint: Object.keys(inputs).length > 0 ? '输入版本就绪且订阅有效' : '请选择输入数据版本' },
        { label: '能力可用', state: 'pass', hint: '能力版本已准入且未撤回' },
      ]
      return { ok: checks.every((item) => item.state === 'pass'), checks }
    }

    const runMatch = path.match(/^\/algorithm-services\/([^/]+)\/runs$/)
    if (normalizedMethod === 'POST' && runMatch) {
      sequence += 1
      const code = decodeURIComponent(runMatch[1])
      const service = services.find((item) => item.summary.code === code)
      const bodyRecord = (body ?? {}) as { outputs?: AlgorithmRun['outputSpec']; testDataRefs?: string[] }
      const run: AlgorithmRun = {
        taskId: `task-run${String(sequence).padStart(3, '0')}`,
        serviceCode: code,
        serviceName: service?.summary.name ?? code,
        status: 'RUNNING',
        stage: '排队中',
        startedAt: relativeIso(0),
        duration: '刚刚启动',
        nodes: [ { name: '排队', state: 'RUNNING', startedAt: relativeIso(0) } ],
        artifacts: [],
        outputSpec: bodyRecord.outputs,
        testDataRefs: bodyRecord.testDataRefs,
        container: { containerId: `ctr-run${String(sequence).padStart(3, '0')}`, image: `registry/${code}:latest`, node: 'algo-node-01', state: 'CREATED', cpu: '0.2 核', mem: '256 MB', logTail: ['[now] 容器已创建，等待调度'] },
      }
      runs.unshift(run)
      return { started: true, taskId: run.taskId }
    }

    if (normalizedMethod === 'GET' && path === '/my/algorithm-runs') return page(runs, params)

    const runDetailMatch = path.match(/^\/my\/algorithm-runs\/([^/]+)$/)
    if (normalizedMethod === 'GET' && runDetailMatch) {
      const found = runs.find((item) => item.taskId === runDetailMatch[1])
      if (!found) throw error(404, 'NOT_FOUND', '未找到该运行记录', path)
      return clone(found)
    }

    const runActionMatch = path.match(/^\/my\/algorithm-runs\/([^/]+)\/(rerun|cancel)$/)
    if (normalizedMethod === 'POST' && runActionMatch) {
      const found = runs.find((item) => item.taskId === runActionMatch[1])
      if (!found) throw error(404, 'NOT_FOUND', '未找到该运行记录', path)
      if (runActionMatch[2] === 'cancel') {
        found.status = 'CANCELLED'
        found.stage = '已取消'
      } else {
        found.status = 'RUNNING'
        found.stage = '排队中（复跑）'
      }
      return clone(found)
    }

    throw error(404, 'MOCK_ROUTE_NOT_FOUND', '请求的演示功能暂未覆盖', path)
  }

  return { request }
}

export const localAlgorithmWorkbenchMockApi = createAlgorithmWorkbenchMockApi()
