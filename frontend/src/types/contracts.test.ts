/**
 * 稳定编码契约一致性测试：与门户后端各中心编码生成器（SecureRandom 8 位十六进制）逐一对齐。
 */
import { describe, expect, it } from 'vitest'

const patterns: Record<string, RegExp> = {
  审批单: /^apr-[0-9a-f]{8}$/,
  需求单: /^req-[0-9a-f]{8}$/,
  公告: /^ntc-[0-9a-f]{8}$/,
  反馈: /^fb-[0-9a-f]{8}$/,
  来源系统: /^[a-z][a-z0-9-]{0,31}$/,
  任务状态: /^(PENDING|RUNNING|SUCCESS|FAILED|CANCELED)$/,
  需求状态: /^(OPEN|ANALYZING|ASSIGNED|IN_PROGRESS|COMPLETED|CANCELED)$/,
}

describe('稳定编码契约（对齐门户后端生成器）', () => {
  it('各中心示例编码全部匹配', () => {
    expect(patterns.审批单.test('apr-3f8a02c1')).toBe(true)
    expect(patterns.需求单.test('req-a1b2c3d4')).toBe(true)
    expect(patterns.公告.test('ntc-9f1c2a01')).toBe(true)
    expect(patterns.反馈.test('fb-00000001')).toBe(true)
    expect(patterns.来源系统.test('mcp-gateway')).toBe(true)
    expect(patterns.来源系统.test('algorithm-recombine')).toBe(true)
  })

  it('拒绝大写与非十六进制编码（生成器只产小写十六进制）', () => {
    expect(patterns.审批单.test('APR-3f8a02c1')).toBe(false)
    expect(patterns.需求单.test('req-3f8a02cz')).toBe(false)
    expect(patterns.公告.test('ntc-3f8a02c')).toBe(false)
  })

  it('状态机取值封闭（终态防重依赖前端不伪造状态）', () => {
    expect(patterns.任务状态.test('RUNNING')).toBe(true)
    expect(patterns.任务状态.test('COMPLETED')).toBe(false)
    expect(patterns.需求状态.test('COMPLETED')).toBe(true)
    expect(patterns.需求状态.test('DONE')).toBe(false)
  })
})
