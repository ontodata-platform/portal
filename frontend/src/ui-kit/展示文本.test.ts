import { describe, expect, it } from 'vitest'

import { 中文展示 } from './展示文本'

describe('中文展示', () => {
  it('将常见状态、来源系统和业务类型转换为中文', () => {
    expect(中文展示('PUBLISHED')).toBe('已发布')
    expect(中文展示('algorithm-recombine')).toBe('算法重组平台')
    expect(中文展示('WORKFLOW_EXECUTION')).toBe('工作流执行')
    expect(中文展示('default')).toBe('默认租户')
    expect(中文展示('proj-quality')).toBe('质量分析项目')
  })

  it('保留未知的后端新增值，避免掩盖联调问题', () => {
    expect(中文展示('FUTURE_STATUS')).toBe('FUTURE_STATUS')
  })
})
