/**
 * 数据工作台——数据集与订阅本地模拟（v5 §14.3，底座依赖 D-1/D-4）。
 * 数据集详情的呈现结构由数据中台以描述符提供，门户仅承载渲染。
 */
import type { ServiceDescriptor } from '@/types/descriptor'
import type { SeedDataset } from '@/types/seed'
import {
  relativeIso,
  seedDatasetApplications,
  seedDatasets,
  seedDatasetSubscriptions,
} from '@/mocks/seed'
import { expandDemoRows } from '@/utils/download'

const relativeDate = (hoursAgo: number) => relativeIso(hoursAgo).slice(0, 10)

export interface DataWorkbenchMockApi {
  request: (method: string, path: string, params?: Record<string, unknown>, body?: unknown) => Promise<unknown>
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

export interface DataApplication {
  code: string
  serviceCode: string
  serviceName: string
  status: 'SUBMITTED' | 'PENDING' | 'DELIVERED' | 'REJECTED'
  submittedAt: string
  deliveredAt?: string
  currentApprover?: string
  rejectReason?: string
  remark: string
}

export interface DataSubscription {
  code: string
  serviceCode: string
  serviceName: string
  version: string
  snapshotDate: string
  expiresAt: string
  isExpiringSoon: boolean
  deliveryType: string
  rowsCount: number
  previewUrl?: string
  hasFile: boolean
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

function datasetDescriptor(item: SeedDataset): ServiceDescriptor {
  return {
    schemaVersion: '1.0',
    serviceType: 'data-service',
    provider: 'data-platform',
    code: item.code,
    name: item.name,
    summary: { version: item.version, status: item.status, badges: [`密级：${item.classification}`, `主题：${item.domain}`] },
    sections: [
      {
        type: 'summary',
        title: '基本信息',
        fields: [
          { label: '数据集编码', value: item.code },
          { label: '当前版本', value: item.version },
          { label: '快照日期', value: relativeDate(item.snapshotHoursAgo) },
          { label: '提供方', value: '数据中台' },
        ],
      },
      { type: 'richtext', title: '口径说明', text: item.description },
      {
        type: 'fields',
        title: '字段与口径',
        fields: item.fieldSpecs.map((field) => ({ label: field.name, value: field.desc })),
      },
      {
        type: 'sample',
        title: '数据样例（前 5 行）',
        sample: {
          columns: item.sampleColumns,
          rows: item.sampleRows,
          note: '样例仅展示字段形态，脱敏数据。',
        },
      },
      {
        type: 'quality',
        title: '质量摘要',
        metrics: [
          { label: '最近质检合格率', value: item.qualityPassRate, state: 'success' },
          { label: '最近质检时间', value: relativeDate(8), state: 'success' },
        ],
      },
      {
        type: 'versions',
        title: '版本历史',
        versions: [
          { version: item.version, releasedAt: relativeDate(item.snapshotHoursAgo), note: '当前快照', current: true },
          { version: '上一版本', releasedAt: relativeDate(item.snapshotHoursAgo + 24 * 30), note: '历史快照' },
        ],
      },
    ],
    actions: [
      { id: 'apply', label: '申请使用', kind: 'flow', flow: 'apply' },
      { id: 'preview', label: '查看样例', kind: 'navigate' },
    ],
  }
}

function toDatasetRecord(item: SeedDataset): DatasetRecord {
  return {
    summary: {
      code: item.code,
      name: item.name,
      domain: item.domain,
      classification: item.classification,
      version: item.version,
      snapshotDate: relativeDate(item.snapshotHoursAgo),
      qualityPassRate: item.qualityPassRate,
      status: item.status,
      description: item.description,
    },
    descriptor: datasetDescriptor(item),
  }
}

const datasets: DatasetRecord[] = seedDatasets.map(toDatasetRecord)

function toApplication(item: (typeof seedDatasetApplications)[number]): DataApplication {
  return {
    code: item.code,
    serviceCode: item.serviceCode,
    serviceName: item.serviceName,
    status: item.status,
    submittedAt: relativeIso(item.submittedHoursAgo),
    deliveredAt: item.deliveredHoursAgo === undefined ? undefined : relativeIso(item.deliveredHoursAgo),
    currentApprover: item.currentApprover,
    rejectReason: item.rejectReason,
    remark: item.remark,
  }
}

export function createDataWorkbenchMockApi(): DataWorkbenchMockApi {
  const applications: DataApplication[] = seedDatasetApplications.map(toApplication)
  const subscriptions: DataSubscription[] = seedDatasetSubscriptions.map((item) => ({
    code: item.code,
    serviceCode: item.serviceCode,
    serviceName: item.serviceName,
    version: item.version,
    snapshotDate: relativeDate(item.snapshotHoursAgo),
    expiresAt: relativeDate(item.expiresHoursAgo),
    isExpiringSoon: item.isExpiringSoon,
    deliveryType: item.deliveryType,
    rowsCount: item.rowsCount,
    previewUrl: item.previewUrl,
    hasFile: item.hasFile !== false,
  }))
  let sequence = seedDatasetApplications.length

  async function request(method: string, path: string, params: Record<string, unknown> = {}, body?: unknown): Promise<unknown> {
    const normalizedMethod = method.toUpperCase()
    await Promise.resolve()

    if (normalizedMethod === 'POST' && path === '/applications') {
      const record = (body ?? {}) as {
        source?: string
        serviceCode?: string
        serviceName?: string
        grantedColumns?: string[]
        remark?: string
      }
      const serviceCode = String(record.serviceCode ?? '')
      const serviceName = String(record.serviceName ?? serviceCode)
      if (!serviceCode) throw error(422, 'VALIDATION_FAILED', '申请对象不能为空', path)
      sequence += 1
      const created: DataApplication = {
        code: `app-2026-${String(sequence).padStart(3, '0')}`,
        serviceCode,
        serviceName,
        status: 'PENDING',
        submittedAt: relativeIso(0),
        currentApprover: '王主管（数据管理部）',
        remark: record.remark ?? (record.source === 'DATASET' ? '自数据集详情申请使用' : '自数据目录申请使用'),
      }
      applications.unshift(created)
      return clone(created)
    }

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

    if (normalizedMethod === 'GET' && path === '/my/applications') {
      return {
        total: applications.length,
        items: clone(applications),
      }
    }

    if (normalizedMethod === 'GET' && path === '/my/subscriptions') {
      return {
        total: subscriptions.length,
        items: clone(subscriptions),
      }
    }

    const downloadMatch = path.match(/^\/subscriptions\/([^/]+)\/download$/)
    if (normalizedMethod === 'GET' && downloadMatch) {
      const code = decodeURIComponent(downloadMatch[1])
      const found = subscriptions.find((item) => item.code === code)
      if (!found) throw error(404, 'NOT_FOUND', '未找到该订阅交付', path)
      if (!found.hasFile) throw error(409, 'FILE_NOT_READY', '交付文件生成中', path)
      const datasetCode = found.previewUrl?.match(/dataset\/([^/?]+)/)?.[1]
      const dataset = seedDatasets.find((item) => item.code === datasetCode) ?? seedDatasets[0]
      return {
        filename: `${found.serviceName}.csv`,
        mime: 'text/csv;charset=utf-8',
        title: found.serviceName,
        rows: expandDemoRows(dataset.sampleColumns, dataset.sampleRows, 32),
      }
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
