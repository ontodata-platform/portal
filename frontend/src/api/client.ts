/**
 * axios 客户端与统一错误协议解析。
 *
 * 后端（common 模块 GlobalExceptionHandler）错误结构：{ status, code, message, path, traceId, fieldErrors }；
 * 网络层失败（超时/断连）归一为中文 ApiError，traceId 用于后端日志对账。
 */
import axios, { type AxiosError } from 'axios'

import type { ApiErrorBody } from '@/types/portal'
import { tenantState } from '@/tenant'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly path?: string
  readonly traceId?: string
  readonly fieldErrors?: Record<string, string>

  constructor(status: number, code: string, message: string, path?: string, traceId?: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.path = path
    this.traceId = traceId
    this.fieldErrors = fieldErrors
  }

  /** 从后端错误响应体构建（body 缺失时降级为通用文案）。 */
  static fromBody(body: ApiErrorBody | null | undefined, fallbackStatus: number): ApiError {
    if (body && typeof body.message === 'string' && body.message.length > 0) {
      return new ApiError(body.status, body.code, body.message, body.path, body.traceId, body.fieldErrors)
    }
    return new ApiError(fallbackStatus, 'REQUEST_FAILED', '请求失败，请稍后重试')
  }

  /** 从 axios 错误构建：区分后端错误体与网络层失败。 */
  static from(error: unknown): ApiError {
    const axiosError = error as AxiosError<ApiErrorBody>
    if (axiosError?.response?.data) {
      return ApiError.fromBody(axiosError.response.data, axiosError.response.status)
    }
    if (axiosError?.code === 'ECONNABORTED') {
      return new ApiError(0, 'TIMEOUT', '请求超时，请稍后重试')
    }
    return new ApiError(0, 'NETWORK_ERROR', '无法连接服务，请检查网络或后端是否启动')
  }

  /** 表单字段错误合并为单行文案（fieldErrors 由后端 VALIDATION_FAILED 提供）。 */
  get detail(): string {
    if (this.fieldErrors) {
      const details = Object.values(this.fieldErrors).filter((value) => value)
      if (details.length > 0) {
        return `${this.message}：${details.join('；')}`
      }
    }
    return this.message
  }
}

export const client = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
})

// M5 多租户：每个请求携带 X-Tenant-Id（后端 TenantContextFilter 装载租户上下文）
client.interceptors.request.use((config) => {
  config.headers.set('X-Tenant-Id', tenantState.tenantId)
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(ApiError.from(error)),
)

/** 解析 textarea 中的 JSON，失败抛中文 ApiError（表单层捕获提示）。 */
export function parseJsonOrThrow(text: string, label: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError(400, 'INVALID_ARGUMENT', `${label}不是合法的 JSON`)
  }
}
