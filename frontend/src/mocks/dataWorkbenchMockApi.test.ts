import { describe, expect, it } from 'vitest'

import { createDataWorkbenchMockApi } from './dataWorkbenchMockApi'

const api = createDataWorkbenchMockApi()

describe('数据工作台 mock API（数据集）', () => {
  it('目录返回数据集摘要并支持分页', async () => {
    const res = (await api.request('GET', '/datasets', { page: 1, size: 2 })) as {
      total: number
      items: Array<{ code: string }>
    }
    expect(res.total).toBeGreaterThanOrEqual(5)
    expect(res.items).toHaveLength(2)
  })

  it('目录支持主题域与关键词过滤', async () => {
    const byDomain = (await api.request('GET', '/datasets', { domain: '光学影像' })) as {
      items: Array<{ domain: string }>
    }
    expect(byDomain.items.length).toBeGreaterThan(0)
    expect(byDomain.items.every((item) => item.domain === '光学影像')).toBe(true)

    const byKeyword = (await api.request('GET', '/datasets', { keyword: '遥测' })) as {
      items: Array<{ name: string }>
    }
    expect(byKeyword.items.some((item) => item.name.includes('遥测'))).toBe(true)
  })

  it('数据集详情包含描述符区块（口径/字段/样例/质量/版本）', async () => {
    const res = (await api.request('GET', '/datasets/dset-optical-snapshot')) as {
      descriptor: { sections: Array<{ type: string }> }
    }
    const types = res.descriptor.sections.map((section) => section.type)
    for (const expected of ['summary', 'richtext', 'fields', 'sample', 'quality', 'versions']) {
      expect(types).toContain(expected)
    }
  })

  it('数据集详情不存在时返回 404', async () => {
    await expect(api.request('GET', '/datasets/nope')).rejects.toMatchObject({
      response: { status: 404 },
    })
  })

  it('主题域清单可查询', async () => {
    const res = (await api.request('GET', '/dataset-domains')) as { items: string[] }
    expect(res.items).toContain('光学影像')
  })

  it('数据集申请写入我的申请列表', async () => {
    const created = (await api.request('POST', '/applications', {}, {
      source: 'DATASET',
      serviceCode: 'dset-optical-snapshot',
      serviceName: '高分光学影像快照',
      grantedColumns: ['scene_id'],
    })) as { code: string; status: string; serviceCode: string }

    expect(created.serviceCode).toBe('dset-optical-snapshot')
    expect(created.status).toBe('PENDING')
    expect(created.code).toMatch(/^app-2026-/)

    const listed = (await api.request('GET', '/my/applications')) as {
      items: Array<{ code: string; serviceCode: string }>
    }
    expect(listed.items[0].code).toBe(created.code)
    expect(listed.items.some((item) => item.serviceCode === 'dset-optical-snapshot')).toBe(true)
  })

  it('订阅交付下载返回 20~50 行样例，无文件时拒绝', async () => {
    const file = (await api.request('GET', '/subscriptions/sub-001/download')) as {
      filename: string
      rows: Array<Record<string, unknown>>
    }
    expect(file.filename).toMatch(/\.csv$/)
    expect(file.rows.length).toBeGreaterThanOrEqual(20)
    expect(file.rows.length).toBeLessThanOrEqual(50)

    await expect(api.request('GET', '/subscriptions/sub-003/download')).rejects.toMatchObject({
      response: { status: 409, data: { code: 'FILE_NOT_READY' } },
    })
  })
})
