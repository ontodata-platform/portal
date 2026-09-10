export interface ApplyTarget {
  code: string
  name: string
  source: 'SERVICE' | 'DATASET'
  fields?: string[]
  applyRequirements?: string[]
}

export interface ApplicationSummary {
  code: string
  status: string
  serviceCode: string
  serviceName: string
}

/** 申请四要素（B3-1，技术要求 §19）：审批人据以决策的最小信息集。 */
export interface ApplicationUseIntent {
  /** 使用目的（必填，≤200 字） */
  purpose: string
  /** 数据范围：区域 + 字段（字段继承步骤一） */
  regions: string[]
  timeFrom: string
  timeTo: string
  /** 交付要求 */
  deliveryFormats: string[]
  deliveryFrequency: 'ONCE' | 'PERIODIC'
  deliveryNote?: string
}

/** 区域字典（演示域：东海示范区业务范围）。 */
export const APPLICATION_REGIONS = ['东海', '黄海', '南海', '渤海', '全球海域'] as const

/** 交付格式字典。 */
export const DELIVERY_FORMATS = ['CSV', 'GeoTIFF', 'JSON', 'Shapefile'] as const

/** 四要素校验：返回各字段错误信息（键为字段/字段组名），空对象=通过。 */
export function validateUseIntent(intent: ApplicationUseIntent): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!intent.purpose.trim()) errors.purpose = '请填写使用目的'
  else if (intent.purpose.length > 200) errors.purpose = '使用目的不超过 200 字'
  if (intent.regions.length === 0) errors.regions = '请至少选择一个区域'
  if (!intent.timeFrom || !intent.timeTo) errors.timeRange = '请选择时间范围'
  else if (intent.timeFrom > intent.timeTo) errors.timeRange = '开始时间不能晚于结束时间'
  if (intent.deliveryFormats.length === 0) errors.deliveryFormats = '请至少选择一种交付格式'
  return errors
}
