/**
 * 全局唯一时间/数字格式化出口（UX-1 §10.1）。
 * 视图层禁止直接 toISOString / toLocaleString，一律经此模块。
 */

const pad = (value: number) => String(value).padStart(2, '0')

function sameYear(date: Date, now: Date): boolean {
  return date.getFullYear() === now.getFullYear()
}

/** 2026-09-03T02:09:39Z → "09-03 02:09"；跨年显示 "2026-09-03 02:09" */
export function formatDateTime(iso: string | Date | undefined | null): string {
  if (!iso) return '—'
  const date = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso)
  const now = new Date()
  const base = `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  return sameYear(date, now) ? base : `${date.getFullYear()}-${base}`
}

/** 2026-08-31 → "2026-08-31"（纯日期，用于快照/发布日期） */
export function formatDate(iso: string | Date | undefined | null): string {
  if (!iso) return '—'
  const date = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 相对时间：刚刚 / N 分钟前 / 今天 HH:mm / 昨天 HH:mm / M-D */
export function formatRelative(iso: string | Date | undefined | null): string {
  if (!iso) return '—'
  const date = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (date >= startOfToday) return `今天 ${time}`
  if (date >= startOfYesterday) return `昨天 ${time}`
  return formatDateTime(date)
}

/** 表格排序用的原始时间戳（保持 ISO 传给控件） */
export function toTimeValue(iso: string | Date | undefined | null): number {
  if (!iso) return 0
  const date = iso instanceof Date ? iso : new Date(iso)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}
