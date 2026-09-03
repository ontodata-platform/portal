/**
 * 数据工作台——数据集 API（v5 §14.3，底座依赖 D-1/D-4）。
 * mock/真实双模式：底座就绪后切换，页面组件无感。
 */
import { client } from '@/api/client'
import {
  localDataWorkbenchMockApi,
  type DataApplication,
  type DataSubscription,
  type DatasetSummary,
} from '@/mocks/dataWorkbenchMockApi'
import { useLocalMock } from '@/mocks/localMode'
import type { ServiceDescriptor } from '@/types/descriptor'

export type { DataApplication, DataSubscription, DatasetSummary }

export interface DatasetDetail extends DatasetSummary {
  descriptor: ServiceDescriptor
}

export interface DatasetPage<T> {
  total: number
  items: T[]
}

function viaMock<T>(mockCall: () => Promise<T>, realCall: () => Promise<T>): Promise<T> {
  return useLocalMock ? mockCall() : realCall()
}

export const dataWorkbenchApi = {
  listDatasets: (params: { page: number; size: number; keyword?: string; domain?: string } = { page: 1, size: 20 }): Promise<DatasetPage<DatasetSummary>> =>
    viaMock(
      () => localDataWorkbenchMockApi.request('GET', '/datasets', { ...params }) as Promise<DatasetPage<DatasetSummary>>,
      () => client.get('/datasets', { params }).then((r) => r.data),
    ),

  listDomains: (): Promise<string[]> =>
    viaMock(
      () => localDataWorkbenchMockApi.request('GET', '/dataset-domains').then((res) => (res as { items: string[] }).items),
      () => client.get('/dataset-domains').then((r) => r.data.items),
    ),

  findDataset: (code: string): Promise<DatasetDetail> =>
    viaMock(
      () => localDataWorkbenchMockApi.request('GET', `/datasets/${encodeURIComponent(code)}`) as Promise<DatasetDetail>,
      () => client.get(`/datasets/${encodeURIComponent(code)}`).then((r) => r.data),
    ),

  listMyApplications: (): Promise<DatasetPage<DataApplication>> =>
    viaMock(
      () => localDataWorkbenchMockApi.request('GET', '/my/applications') as Promise<DatasetPage<DataApplication>>,
      () => client.get('/my/applications').then((r) => r.data),
    ),

  listMySubscriptions: (): Promise<DatasetPage<DataSubscription>> =>
    viaMock(
      () => localDataWorkbenchMockApi.request('GET', '/my/subscriptions') as Promise<DatasetPage<DataSubscription>>,
      () => client.get('/my/data-subscriptions').then((r) => r.data),
    ),
}
