import { describe, expect, it } from 'vitest'

import {
  slaColorOf,
  slaTextOf,
  statusColorMap,
  statusColorOf,
  statusLabelMap,
  statusLabelOf,
} from './statusMeta'

const t = (key: string) => `#${key}`

describe('statusMeta 统一状态字典（C1-3）', () => {
  it('审批/需求/任务的颜色语义正确', () => {
    expect(statusColorOf('approval', 'PENDING')).toBe('processing')
    expect(statusColorOf('approval', 'APPROVED')).toBe('success')
    expect(statusColorOf('approval', 'REJECTED')).toBe('error')
    expect(statusColorOf('requirement', 'OPEN')).toBe('cyan')
    expect(statusColorOf('task', 'RUNNING')).toBe('processing')
    expect(statusColorOf('task', 'FAILED')).toBe('error')
  })

  it('未知状态回退 default 与原始值', () => {
    expect(statusColorOf('approval', 'FUTURE_STATUS')).toBe('default')
    expect(statusLabelOf('approval', 'FUTURE_STATUS', t)).toBe('FUTURE_STATUS')
  })

  it('标签经 t 翻译为 i18n 键', () => {
    expect(statusLabelOf('approval', 'PENDING', t)).toBe('#approvals.pendingApproval')
    expect(statusLabelOf('requirement', 'OPEN', t)).toBe('#requirements.open')
  })

  it('statusColorMap/statusLabelMap 展开全量映射', () => {
    const colors = statusColorMap('approval')
    expect(Object.keys(colors)).toEqual(['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'])
    const labels = statusLabelMap('requirement', t)
    expect(labels.COMPLETED).toBe('#requirements.completed')
  })

  it('SLA 五态颜色与文案', () => {
    expect(slaColorOf('OVERDUE')).toBe('error')
    expect(slaColorOf('MET')).toBe('success')
    expect(slaColorOf(null)).toBe('default')
    expect(slaTextOf('DUE_SOON', t)).toBe('#approvals.slaDueSoon')
    expect(slaTextOf(undefined, t)).toBe('#approvals.slaNone')
  })
})
