import { describe, expect, it } from 'vitest'

import { globalSearch, routeOfMatter } from './search'

describe('searchApi.globalSearch（B4 全局搜索）', () => {
  it('按名称命中数据服务并给出详情路由', async () => {
    const result = await globalSearch('高分')
    expect(result.services.some((hit) => hit.code === 'ds-gaofen-optical')).toBe(true)
    expect(result.services[0].route).toBe('/data-workbench/ds-gaofen-optical')
  })

  it('单号前缀命中事项并映射到对应工作台', async () => {
    const result = await globalSearch('apr-0201')
    expect(result.matters).toHaveLength(1)
    expect(result.matters[0].route).toBe('/personal/approvals')
  })

  it('算法按名称命中并直达工作台', async () => {
    const result = await globalSearch('异常检测')
    expect(result.algorithms.length).toBeGreaterThan(0)
    expect(result.algorithms[0].route).toContain('/algorithm-workbench/')
  })

  it('空关键词返回空分组', async () => {
    const result = await globalSearch('  ')
    expect(result.services).toEqual([])
    expect(result.algorithms).toEqual([])
    expect(result.matters).toEqual([])
  })

  it('routeOfMatter 按前缀映射三类单据', () => {
    expect(routeOfMatter('req-0102')).toBe('/personal/requirements')
    expect(routeOfMatter('tsk-run-003')).toBe('/personal/tasks')
    expect(routeOfMatter('apr-0207')).toBe('/personal/approvals')
  })
})
