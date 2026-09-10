import { describe, expect, it } from 'vitest'

import { createAlgorithmWorkbenchMockApi } from './algorithmWorkbenchMockApi'
import { createDataWorkbenchMockApi } from './dataWorkbenchMockApi'
import { seedAlgorithms, seedDataServices, seedDatasets } from './seed'

/** 设计 §A1 验收：mocks 不得再混入制造业词料。 */
const FORBIDDEN = /客户主数据|总账|员工档案|供应商信用|库存|订单明细|客户投诉|制造业|流失预测|销量预测|产线/

const DOMAIN = /卫星|遥感|海洋|影像|SAR|海表|舰船|海冰|光学|红外|载荷|遥测|轨迹|光谱|夜间|测高|植被|目标特性/

describe('演示数据世界观（卫星/遥感/海洋）', () => {
  it('数据服务与算法种子名称同属遥感海洋域', () => {
    expect(seedDataServices.length).toBeGreaterThan(0)
    expect(seedAlgorithms.length).toBeGreaterThan(0)
    expect(seedDataServices.every((item) => DOMAIN.test(item.name))).toBe(true)
    expect(seedAlgorithms.every((item) => DOMAIN.test(item.name))).toBe(true)
    expect(JSON.stringify({ seedDataServices, seedAlgorithms })).not.toMatch(FORBIDDEN)
  })

  it('数据集种子与列表接口不含制造业词料', async () => {
    expect(seedDatasets.length).toBeGreaterThan(0)
    expect(seedDatasets.every((item) => DOMAIN.test(item.name))).toBe(true)

    const api = createDataWorkbenchMockApi()
    const listed = (await api.request('GET', '/datasets')) as {
      items: Array<{ name: string; domain: string; description: string }>
    }
    const applications = await api.request('GET', '/my/applications')
    const subscriptions = await api.request('GET', '/my/subscriptions')
    const blob = JSON.stringify({ listed, applications, subscriptions, seedDatasets })
    expect(blob).not.toMatch(FORBIDDEN)
    expect(listed.items.every((item) => DOMAIN.test(item.name))).toBe(true)
  })

  it('算法工作台目录与制品名称同属遥感海洋域', async () => {
    const api = createAlgorithmWorkbenchMockApi()
    const listed = (await api.request('GET', '/algorithm-services')) as {
      items: Array<{ name: string; description: string }>
    }
    const runs = await api.request('GET', '/my/algorithm-runs')
    const deliveries = await api.request('GET', '/my/deliveries')
    const blob = JSON.stringify({ listed, runs, deliveries })
    expect(blob).not.toMatch(FORBIDDEN)
    expect(listed.items.every((item) => DOMAIN.test(`${item.name}${item.description}`))).toBe(true)
  })
})
