import { describe, expect, it } from 'vitest'

import { ApiError, parseJsonOrThrow } from './client'

describe('ApiError', () => {
  it('解析后端错误体（含 traceId 与字段错误）', () => {
    const error = ApiError.fromBody(
      {
        status: 400,
        code: 'VALIDATION_FAILED',
        message: '请求参数校验失败',
        path: '/api/v1/approvals',
        traceId: 'trace-1',
        fieldErrors: { decisionBy: '审批人不能为空' },
      },
      400,
    )
    expect(error.code).toBe('VALIDATION_FAILED')
    expect(error.traceId).toBe('trace-1')
    expect(error.detail).toContain('审批人不能为空')
  })

  it('后端错误体缺失时降级为通用文案', () => {
    const error = ApiError.fromBody(null, 500)
    expect(error.code).toBe('REQUEST_FAILED')
    expect(error.message).toBe('请求失败，请稍后重试')
  })

  it('网络错误归一为中文提示', () => {
    const error = ApiError.from({ code: 'ECONNABORTED' })
    expect(error.code).toBe('TIMEOUT')
    expect(error.message).toContain('超时')

    const offline = ApiError.from({ message: 'Network Error' })
    expect(offline.code).toBe('NETWORK_ERROR')
    expect(offline.message).toContain('无法连接服务')
  })

  it('终态防重 409 保留后端原文（审批门提示用户先处理审批）', () => {
    const error = ApiError.fromBody(
      {
        status: 409,
        code: 'STATE_CONFLICT',
        message: '审批单已处于终态：APPROVED，不允许重复审批',
        path: '/api/v1/approvals/apr-x/decision',
      },
      409,
    )
    expect(error.status).toBe(409)
    expect(error.message).toContain('不允许重复审批')
  })
})

describe('parseJsonOrThrow', () => {
  it('解析合法 JSON', () => {
    expect(parseJsonOrThrow('{"a":1}', '参数')).toEqual({ a: 1 })
  })

  it('非法 JSON 抛中文 ApiError', () => {
    expect(() => parseJsonOrThrow('{bad', '字段白名单')).toThrowError('字段白名单不是合法的 JSON')
  })
})
