import { describe, expect, it } from 'vitest'

import { createAlgorithmWorkbenchMockApi } from './algorithmWorkbenchMockApi'

const api = createAlgorithmWorkbenchMockApi()

describe('算法工作台 mock API', () => {
  it('目录返回服务摘要并支持分页', async () => {
    const res = (await api.request('GET', '/algorithm-services', { page: 1, size: 2 })) as {
      total: number
      items: Array<{ code: string }>
    }
    expect(res.total).toBeGreaterThanOrEqual(5)
    expect(res.items).toHaveLength(2)
  })

  it('服务详情包含描述符与输入声明', async () => {
    const res = (await api.request('GET', '/algorithm-services/tpl-quality-weekly')) as {
      descriptor: { sections: Array<{ type: string; inputs?: unknown[] }> }
    }
    const inputs = res.descriptor.sections.find((section) => section.type === 'inputs')
    expect(inputs?.inputs?.length).toBeGreaterThan(0)
  })

  it('详情不存在时返回 404', async () => {
    await expect(api.request('GET', '/algorithm-services/nope')).rejects.toMatchObject({
      response: { status: 404 },
    })
  })

  it('预检：缺输入时数据就绪项未通过', async () => {
    const res = (await api.request('POST', '/algorithm-services/tpl-quality-weekly/preflight', {}, { inputs: {} })) as {
      ok: boolean
      checks: Array<{ label: string; state: string }>
    }
    expect(res.ok).toBe(false)
    expect(res.checks.find((check) => check.label === '数据就绪')?.state).toBe('fail')
  })

  it('预检：带输入时全部通过', async () => {
    const res = (await api.request('POST', '/algorithm-services/tpl-quality-weekly/preflight', {}, { inputs: { customerData: 'ds-customer-monthly@v2026.08' } })) as {
      ok: boolean
    }
    expect(res.ok).toBe(true)
  })

  it('提交运行生成任务编号并进入我的运行', async () => {
    const receipt = (await api.request('POST', '/algorithm-services/tpl-quality-weekly/runs', {}, { inputs: {}, tier: 'standard' })) as {
      started: boolean
      taskId: string
    }
    expect(receipt.started).toBe(true)
    const runs = (await api.request('GET', '/my/algorithm-runs')) as { items: Array<{ taskId: string }> }
    expect(runs.items.some((run) => run.taskId === receipt.taskId)).toBe(true)
  })

  it('我的交付列表可供向导选择', async () => {
    const res = (await api.request('GET', '/my/deliveries')) as { items: Array<{ serviceCode: string; version: string }> }
    expect(res.items.length).toBeGreaterThan(0)
    expect(res.items[0].version).toBeTruthy()
  })
})
