/**
 * 统计看板数据工具（D3）：确定性伪随机序列（同一 seed 恒定），
 * 真实模式契约为 GET /api/v1/operations/statistics/series（对齐 operations-center 扩展）。
 */

export interface DailyPoint {
  date: string
  value: number
}

/** 伪随机序列（LCG）：保证演示数据稳定可复现。 */
function createRandom(seed: number): () => number {
  let state = seed % 233280
  return () => {
    state = (state * 9301 + 49297) % 233280
    return state / 233280
  }
}

/** 生成最近 days 天的日值序列（含今天，按时间升序）。 */
export function dailySeries(days: number, base: number, variance: number, seed: number): DailyPoint[] {
  const random = createRandom(seed)
  const points: DailyPoint[] = []
  const today = new Date()
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - offset)
    // 周末业务量衰减，制造可读的趋势形态
    const weekendFactor = date.getDay() === 0 || date.getDay() === 6 ? 0.55 : 1
    const value = Math.max(0, Math.round(base + (random() - 0.5) * variance * weekendFactor))
    points.push({ date: date.toISOString().slice(0, 10), value })
  }
  return points
}

/** 折线图 SVG points（等宽分布，y 按最大值归一）。 */
export function toLinePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return ''
  const max = Math.max(...values, 1)
  const stepX = width / (values.length - 1 || 1)
  return values
    .map((value, index) => `${(index * stepX).toFixed(1)},${(height - (value / max) * height).toFixed(1)}`)
    .join(' ')
}
