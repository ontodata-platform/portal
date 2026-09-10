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
})
