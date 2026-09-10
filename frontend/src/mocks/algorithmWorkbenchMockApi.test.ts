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
    const res = (await api.request('POST', '/algorithm-services/tpl-quality-weekly/preflight', {}, { inputs: { inputDataset: 'dset-ontology-instance@v2026.09' } })) as {
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
    const res = (await api.request('GET', '/my/deliveries')) as { items: Array<{ serviceCode: string; serviceName: string; version: string }> }
    expect(res.items.length).toBeGreaterThan(0)
    expect(res.items[0].version).toBeTruthy()
    expect(res.items.some((item) => item.serviceName.includes('客户'))).toBe(false)
  })

  it('服务摘要携带算法分类，且分类清单可查询', async () => {
    const list = (await api.request('GET', '/algorithm-services')) as { items: Array<{ category: string }> }
    expect(list.items.every((item) => item.category.length > 0)).toBe(true)
    const cats = (await api.request('GET', '/algorithm-categories')) as { items: string[] }
    expect(cats.items.length).toBeGreaterThanOrEqual(3)
  })

  it('目录支持按分类过滤', async () => {
    const res = (await api.request('GET', '/algorithm-services', { category: '时序预测' })) as {
      items: Array<{ category: string }>
    }
    expect(res.items.length).toBeGreaterThan(0)
    expect(res.items.every((item) => item.category === '时序预测')).toBe(true)
  })

  it('测试数据上传：CSV 返回临时引用，其他类型拒绝', async () => {
    const ok = (await api.request('POST', '/test-data', {}, { fileName: 'sample.csv' })) as { ref: string }
    expect(ok.ref).toMatch(/^test:/)
    await expect(
      api.request('POST', '/test-data', {}, { fileName: 'sample.txt' }),
    ).rejects.toMatchObject({ response: { status: 422 } })
  })

  it('运行详情包含算法容器状态', async () => {
    const run = (await api.request('GET', '/my/algorithm-runs/task-b2c3d4e5')) as {
      container?: { containerId: string; image: string; logTail: string[] }
    }
    expect(run.container?.containerId).toBeTruthy()
    expect(run.container?.image).toContain('anomaly-detect')
    expect(run.container?.logTail.length).toBeGreaterThan(0)
  })

  it('结果物下载返回 CSV 行，生成中的结果物不可下', async () => {
    const file = (await api.request(
      'GET',
      `/my/algorithm-runs/task-d4e5f6g7/artifacts/${encodeURIComponent('海表温度预测.csv')}/download`,
    )) as { filename: string; rows: Array<Record<string, unknown>> }
    expect(file.filename).toBe('海表温度预测.csv')
    expect(file.rows.length).toBeGreaterThanOrEqual(20)

    await expect(
      api.request(
        'GET',
        `/my/algorithm-runs/task-m3n4o5p6/artifacts/${encodeURIComponent('目标特性报告生成中.csv')}/download`,
      ),
    ).rejects.toMatchObject({ response: { status: 409, data: { code: 'FILE_NOT_READY' } } })
  })
})
