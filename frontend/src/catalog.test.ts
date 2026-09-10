import { describe, expect, it } from 'vitest'

import { catalogItem, catalogItems, catalogTotal, pinCatalogVersion } from './catalog'

describe('catalog', () => {
  it('详情 body 是单条目录对象时能取出条目', () => {
    const item = catalogItem({
      sourceSystem: 'data-platform',
      available: true,
      body: { code: 'dsv-a', name: '高分光学影像服务', status: 'ACTIVE', currentVersion: 1 },
    })
    expect(item?.name).toBe('高分光学影像服务')
    expect(catalogTotal({
      sourceSystem: 'data-platform',
      available: true,
      body: { code: 'dsv-a', name: '高分光学影像服务', status: 'ACTIVE', currentVersion: 1 },
    })).toBe(1)
  })

  it('列表 body.items 原样透传', () => {
    const items = catalogItems({
      sourceSystem: 'algorithm-recombine',
      available: true,
      body: {
        total: 2,
        items: [
          { code: 'wf-a', name: 'A', status: 'PUBLISHED', currentVersion: 2 },
          { code: 'wf-b', name: 'B', status: 'PUBLISHED', currentVersion: 1 },
        ],
      },
    })
    expect(items.map((item) => item.code)).toEqual(['wf-a', 'wf-b'])
    expect(catalogTotal({
      sourceSystem: 'algorithm-recombine',
      available: true,
      body: { total: 2, items },
    })).toBe(2)
  })

  it('兼容 item 字段，不可用时为空', () => {
    expect(
      catalogItem({
        sourceSystem: 'data-platform',
        available: true,
        item: { code: 'dsv-x', name: 'X', status: 'ACTIVE', currentVersion: 1 },
      })?.code,
    ).toBe('dsv-x')
    expect(catalogItems({ sourceSystem: 'data-platform', available: false, message: '挂了' })).toEqual([])
  })

  it('把整数/x.y 版本钉成场景契约的 x.y.z', () => {
    expect(pinCatalogVersion(2)).toBe('2.0.0')
    expect(pinCatalogVersion('1.2')).toBe('1.2.0')
    expect(pinCatalogVersion('1.0.0')).toBe('1.0.0')
  })
})
