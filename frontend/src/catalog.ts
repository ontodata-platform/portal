import type { CatalogEntry, UpstreamAggregation } from '@/types/portal'

/**
 * 解析聚合目录响应：列表 body 为 { items, total }；详情 body 就是单条目录对象。
 * 兼容测试/过渡期的 item 字段。
 */
export function catalogItems(aggregation: UpstreamAggregation | null | undefined): CatalogEntry[] {
  if (!aggregation?.available) {
    return []
  }
  if (aggregation.item?.code) {
    return [aggregation.item]
  }
  const body = aggregation.body
  if (!body) {
    return []
  }
  if (Array.isArray(body.items)) {
    return body.items.filter((item): item is CatalogEntry => Boolean(item?.code))
  }
  if (typeof body.code === 'string' && body.code.length > 0) {
    return [body as CatalogEntry]
  }
  return []
}

export function catalogTotal(aggregation: UpstreamAggregation | null | undefined): number {
  if (!aggregation?.available) {
    return 0
  }
  if (typeof aggregation.body?.total === 'number') {
    return aggregation.body.total
  }
  return catalogItems(aggregation).length
}

export function catalogItem(
  aggregation: UpstreamAggregation | null | undefined,
  code?: string,
): CatalogEntry | null {
  const items = catalogItems(aggregation)
  if (code) {
    return items.find((item) => item.code === code) ?? null
  }
  return items[0] ?? null
}

/** 场景钉扎要 x.y.z；重组模板 currentVersion 是整数，major 位对应该整数。 */
export function pinCatalogVersion(value: number | string | undefined): string {
  if (value === undefined || value === null || value === '') {
    return '1.0.0'
  }
  const text = String(value).trim()
  if (/^\d+\.\d+\.\d+$/.test(text)) {
    return text
  }
  if (/^\d+\.\d+$/.test(text)) {
    return `${text}.0`
  }
  if (/^\d+$/.test(text)) {
    return `${text}.0.0`
  }
  return '1.0.0'
}
