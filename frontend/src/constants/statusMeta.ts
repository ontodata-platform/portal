/**
 * 统一状态字典（C1-3）：审批/需求/任务的徽章颜色与文案键的唯一来源。
 * 颜色为 antd Tag 色系（processing/success/error/cyan/geekblue/default）；
 * 标签经传入的 t 翻译，未知状态回退原始值（后端新增状态不炸界面）。
 * SLA 五态同表管理。颜色语义变更只改这里，全站徽章同步。
 */

export type StatusKind = 'approval' | 'requirement' | 'task'

type Translate = (key: string) => string

const STATUS_COLORS: Record<StatusKind, Record<string, string>> = {
  approval: {
    PENDING: 'processing',
    APPROVED: 'success',
    REJECTED: 'error',
    WITHDRAWN: 'default',
  },
  requirement: {
    OPEN: 'cyan',
    ANALYZING: 'processing',
    ASSIGNED: 'geekblue',
    IN_PROGRESS: 'processing',
    COMPLETED: 'success',
    CANCELED: 'default',
  },
  task: {
    QUEUED: 'default',
    PENDING: 'default',
    RUNNING: 'processing',
    SUCCESS: 'success',
    FAILED: 'error',
    CANCELED: 'default',
    CANCELLED: 'default',
  },
}

const STATUS_LABEL_KEYS: Partial<Record<StatusKind, Record<string, string>>> = {
  approval: {
    PENDING: 'approvals.pendingApproval',
    APPROVED: 'approvals.approved',
    REJECTED: 'approvals.rejected',
    WITHDRAWN: 'approvals.withdrawn',
  },
  requirement: {
    OPEN: 'requirements.open',
    ANALYZING: 'requirements.analyzing',
    ASSIGNED: 'requirements.assigned',
    IN_PROGRESS: 'requirements.inProgress',
    COMPLETED: 'requirements.completed',
    CANCELED: 'requirements.canceled',
  },
}

const SLA_COLORS: Record<string, string> = {
  ON_TIME: 'default',
  DUE_SOON: 'warning',
  OVERDUE: 'error',
  MET: 'success',
  MISSED: 'error',
}

const SLA_LABEL_KEYS: Record<string, string> = {
  ON_TIME: 'approvals.slaOnTime',
  DUE_SOON: 'approvals.slaDueSoon',
  OVERDUE: 'approvals.slaOverdue',
  MET: 'approvals.slaMet',
  MISSED: 'approvals.slaMissed',
}

export function statusColorOf(kind: StatusKind, status: string): string {
  return STATUS_COLORS[kind]?.[status] ?? 'default'
}

export function statusLabelOf(kind: StatusKind, status: string, t: Translate): string {
  const key = STATUS_LABEL_KEYS[kind]?.[status]
  return key ? t(key) : status
}

export function slaColorOf(sla: string | null | undefined): string {
  return sla ? (SLA_COLORS[sla] ?? 'default') : 'default'
}

export function slaTextOf(sla: string | null | undefined, t: Translate): string {
  if (!sla) return t('approvals.slaNone')
  return SLA_LABEL_KEYS[sla] ? t(SLA_LABEL_KEYS[sla]) : sla
}

/** 供 computed 映射表使用：把某类状态全量展开成 { 状态: 颜色/文案 }。 */
export function statusColorMap(kind: StatusKind): Record<string, string> {
  return Object.fromEntries(Object.keys(STATUS_COLORS[kind]).map((status) => [status, statusColorOf(kind, status)]))
}

export function statusLabelMap(kind: StatusKind, t: Translate): Record<string, string> {
  return Object.fromEntries(
    Object.keys(STATUS_LABEL_KEYS[kind] ?? {}).map((status) => [status, statusLabelOf(kind, status, t)]),
  )
}
