/**
 * 算法工作台 API（v4 §7）：mock/真实双模式。
 * 真实链路对应 §8 接口清单 P0 项（D-1/D-3 算法侧/A-1/A-2/A-3），底座就绪后此处切换，页面组件无感。
 */
import { client } from '@/api/client'
import { useLocalMock } from '@/mocks/localMode'
import { localAlgorithmWorkbenchMockApi } from '@/mocks/algorithmWorkbenchMockApi'
import type { AlgorithmRun, AlgorithmServiceSummary, MyDelivery, ServiceDescriptor } from '@/types/descriptor'

export interface AlgorithmServiceDetail extends AlgorithmServiceSummary {
  descriptor: ServiceDescriptor
}

export interface PreflightCheck {
  label: string
  state: 'pass' | 'fail'
  hint: string
}

export interface PreflightResult {
  ok: boolean
  checks: PreflightCheck[]
}

export interface RunReceipt {
  started: boolean
  taskId: string
}

export interface PageResult<T> {
  total: number
  items: T[]
}

function viaMock<T>(mockCall: () => Promise<T>, realCall: () => Promise<T>): Promise<T> {
  return useLocalMock ? mockCall() : realCall()
}

export const algorithmWorkbenchApi = {
  listServices: (params: { page: number; size: number } = { page: 1, size: 20 }): Promise<PageResult<AlgorithmServiceSummary>> =>
    viaMock(
      () => localAlgorithmWorkbenchMockApi.request('GET', '/algorithm-services', { ...params }) as Promise<PageResult<AlgorithmServiceSummary>>,
      () => client.get('/algorithm-services', { params }).then((r) => r.data),
    ),

  findService: (code: string): Promise<AlgorithmServiceDetail> =>
    viaMock(
      () => localAlgorithmWorkbenchMockApi.request('GET', `/algorithm-services/${encodeURIComponent(code)}`) as Promise<AlgorithmServiceDetail>,
      () => client.get(`/algorithm-services/${encodeURIComponent(code)}`).then((r) => r.data),
    ),

  preflight: (code: string, inputs: Record<string, string>): Promise<PreflightResult> =>
    viaMock(
      () => localAlgorithmWorkbenchMockApi.request('POST', `/algorithm-services/${encodeURIComponent(code)}/preflight`, {}, { inputs }) as Promise<PreflightResult>,
      () => client.post(`/algorithm-services/${encodeURIComponent(code)}/preflight`, { inputs }).then((r) => r.data),
    ),

  submitRun: (code: string, payload: { inputs: Record<string, string>; tier: 'standard' | 'long' }): Promise<RunReceipt> =>
    viaMock(
      () => localAlgorithmWorkbenchMockApi.request('POST', `/algorithm-services/${encodeURIComponent(code)}/runs`, {}, payload) as Promise<RunReceipt>,
      () => client.post(`/algorithm-services/${encodeURIComponent(code)}/runs`, payload).then((r) => r.data),
    ),

  listMyRuns: (params: { page: number; size: number } = { page: 1, size: 20 }): Promise<PageResult<AlgorithmRun>> =>
    viaMock(
      () => localAlgorithmWorkbenchMockApi.request('GET', '/my/algorithm-runs', { ...params }) as Promise<PageResult<AlgorithmRun>>,
      () => client.get('/my/algorithm-runs', { params }).then((r) => r.data),
    ),

  findRun: (taskId: string): Promise<AlgorithmRun> =>
    viaMock(
      () => localAlgorithmWorkbenchMockApi.request('GET', `/my/algorithm-runs/${encodeURIComponent(taskId)}`) as Promise<AlgorithmRun>,
      () => client.get(`/my/algorithm-runs/${encodeURIComponent(taskId)}`).then((r) => r.data),
    ),

  rerun: (taskId: string): Promise<AlgorithmRun> =>
    viaMock(
      () => localAlgorithmWorkbenchMockApi.request('POST', `/my/algorithm-runs/${encodeURIComponent(taskId)}/rerun`) as Promise<AlgorithmRun>,
      () => client.post(`/my/algorithm-runs/${encodeURIComponent(taskId)}/rerun`).then((r) => r.data),
    ),

  cancel: (taskId: string): Promise<AlgorithmRun> =>
    viaMock(
      () => localAlgorithmWorkbenchMockApi.request('POST', `/my/algorithm-runs/${encodeURIComponent(taskId)}/cancel`) as Promise<AlgorithmRun>,
      () => client.post(`/my/algorithm-runs/${encodeURIComponent(taskId)}/cancel`).then((r) => r.data),
    ),

  /** 运行向导 dataset-ref 选项来源（L2 由 D-1 聚合接口提供） */
  listMyDeliveries: (): Promise<MyDelivery[]> =>
    viaMock(
      () => localAlgorithmWorkbenchMockApi.request('GET', '/my/deliveries').then((res) => (res as { items: MyDelivery[] }).items),
      () => client.get('/my/data-subscriptions').then((r) => r.data.items),
    ),
}
