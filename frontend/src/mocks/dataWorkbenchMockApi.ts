/**
 * 数据工作台——数据集本地模拟（v5 §14.3，底座依赖 D-4）。
 * 数据集详情的呈现结构由数据中台以描述符提供，门户仅承载渲染。
 */
import type { ServiceDescriptor } from '@/types/descriptor'

export interface DataWorkbenchMockApi {
  request: (method: string, path: string, params?: Record<string, unknown>) => Promise<unknown>
}

export interface DatasetSummary {
  code: string
  name: string
  domain: string
  classification: string
  version: string
  snapshotDate: string
  qualityPassRate: string
  status: 'ONLINE' | 'OFFLINE'
  description: string
}

interface DatasetRecord {
  summary: DatasetSummary
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

function datasetDescriptor(code: string, name: string, description: string, passRate: string): ServiceDescriptor {
  return {
    schemaVersion: '1.0',
    serviceType: 'data-service',
    provider: 'data-platform',
    code,
    name,
    summary: { version: 'v2026.08', status: 'ONLINE', badges: ['密级：内部', '快照：月度'] },
    sections: [
      { type: 'summary', title: '基本信息', fields: [
        { label: '数据集编码', value: code },
        { label: '当前版本', value: 'v2026.08' },
        { label: '快照日期', value: '2026-08-31' },
        { label: '提供方', value: '数据中台' },
      ] },
      { type: 'richtext', title: '口径说明', text: description },
      { type: 'fields', title: '字段与口径', fields: [
        { label: 'customer_id', value: '客户唯一标识（主键）' },
        { label: 'customer_name', value: '客户名称' },
        { label: 'segment', value: '客户分层（A/B/C）' },
        { label: 'region', value: '所属大区' },
      ] },
      { type: 'sample', title: '数据样例（前 5 行）', sample: {
        columns: ['customer_id', 'customer_name', 'segment', 'region'],
        rows: [
          ['C-100001', '华信电子', 'A', '华东'],
          ['C-100002', '恒力机械', 'B', '华北'],
          ['C-100003', '三江食品', 'B', '华南'],
          ['C-100004', '蓝海化工', 'C', '华北'],
          ['C-100005', '天成纺织', 'A', '华东'],
        ],
        note: '样例仅展示字段形态，脱敏数据。',
      } },
      { type: 'quality', title: '质量摘要', metrics: [
        { label: '最近质检合格率', value: passRate, state: 'success' },
        { label: '最近质检时间', value: '2026-09-01', state: 'success' },
      ] },
      { type: 'versions', title: '版本历史', versions: [
        { version: 'v2026.08', releasedAt: '2026-08-31', note: '月度快照', current: true },
        { version: 'v2026.07', releasedAt: '2026-07-31', note: '月度快照' },
      ] },
    ],
    actions: [
      { id: 'apply', label: '申请使用', kind: 'flow', flow: 'apply' },
    ],
  }
}

const datasets: DatasetRecord[] = [
  { summary: { code: 'dset-customer-monthly', name: '客户主数据-月度快照', domain: '客户域', classification: '内部', version: 'v2026.08', snapshotDate: '2026-08-31', qualityPassRate: '99.2%', status: 'ONLINE', description: '制造业客户主数据月度快照，供分析与订阅投递。' }, descriptor: datasetDescriptor('dset-customer-monthly', '客户主数据-月度快照', '整合 CRM 与订单系统的客户主数据，按月固化快照，字段口径经数据标准校验。', '99.2%') },
  { summary: { code: 'dset-device-daily', name: '设备遥测-日增量', domain: '设备域', classification: '机密', version: 'v2026.09.01', snapshotDate: '2026-09-01', qualityPassRate: '97.8%', status: 'ONLINE', description: '产线设备遥测日增量数据，含温度、振动、转速字段。' }, descriptor: datasetDescriptor('dset-device-daily', '设备遥测-日增量', '产线设备遥测日增量：温度、振动、转速三类测点，经异常值清洗。', '97.8%') },
  { summary: { code: 'dset-supplier-credit', name: '供应商信用-季度版', domain: '供应域', classification: '内部', version: 'v3.0.1', snapshotDate: '2026-09-30', qualityPassRate: '98.6%', status: 'ONLINE', description: '供应商信用评级季度版，含评级、额度与风险标签。' }, descriptor: datasetDescriptor('dset-supplier-credit', '供应商信用-季度版', '供应商信用评级季度固化数据，支持按评级与风险标签检索。', '98.6%') },
  { summary: { code: 'dset-order-monthly', name: '订单明细-月度快照', domain: '交易域', classification: '内部', version: 'v2026.08', snapshotDate: '2026-08-31', qualityPassRate: '99.5%', status: 'ONLINE', description: '订单明细月度快照，含金额、数量、履约状态。' }, descriptor: datasetDescriptor('dset-order-monthly', '订单明细-月度快照', '订单明细月度快照：金额、数量、履约状态，经对账校验。', '99.5%') },
  { summary: { code: 'dset-complaint-log', name: '客户投诉-月度', domain: '客户域', classification: '机密', version: 'v2026.08', snapshotDate: '2026-08-31', qualityPassRate: '96.4%', status: 'ONLINE', description: '客户投诉工单月度归集，含文本与紧急度。' }, descriptor: datasetDescriptor('dset-complaint-log', '客户投诉-月度', '客户投诉工单月度归集：投诉文本、主题、紧急度评级。', '96.4%') },
]

export function createDataWorkbenchMockApi(): DataWorkbenchMockApi {
  async function request(method: string, path: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const normalizedMethod = method.toUpperCase()
    await Promise.resolve()

    if (normalizedMethod === 'GET' && path === '/datasets') {
      const keyword = String(params.keyword ?? '').toLowerCase()
      const domain = String(params.domain ?? '')
      const filtered = datasets
        .map((item) => item.summary)
        .filter((item) => (domain ? item.domain === domain : true))
        .filter((item) => (keyword ? `${item.name}${item.code}${item.description}`.toLowerCase().includes(keyword) : true))
      const current = Math.max(1, Number(params.page ?? 1))
      const size = Math.max(1, Number(params.size ?? 20))
      return {
        total: filtered.length,
        items: filtered.slice((current - 1) * size, current * size).map(clone),
      }
    }

    if (normalizedMethod === 'GET' && path === '/dataset-domains') {
      return { items: [...new Set(datasets.map((item) => item.summary.domain))] }
    }

    const detailMatch = path.match(/^\/datasets\/([^/]+)$/)
    if (normalizedMethod === 'GET' && detailMatch) {
      const code = decodeURIComponent(detailMatch[1])
      const found = datasets.find((item) => item.summary.code === code)
      if (!found) throw error(404, 'NOT_FOUND', '未找到该数据集', path)
      return { ...clone(found.summary), descriptor: clone(found.descriptor) }
    }

    throw error(404, 'MOCK_ROUTE_NOT_FOUND', '请求的演示功能暂未覆盖', path)
  }

  return { request }
}

export const localDataWorkbenchMockApi = createDataWorkbenchMockApi()
