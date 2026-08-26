/**
 * agent-runtime 智能体运行时 API（M2 批次 A5）：会话/智能体 REST + SSE 事件流订阅。
 *
 * - REST 走 agentClient（baseURL /agent，dev 由 vite proxy 转发 18086）；
 * - SSE 不能用原生 EventSource（无法携带 Authorization 头），改用 fetch + ReadableStream
 *   手动解析事件流，认证/租户头与 axios 拦截器同一约定；调用方以 AbortController 控制断开。
 */
import { agentClient, ApiError } from './client'

import { iamEnabled } from '@/auth/oidc'
import { ensureAccessToken } from '@/auth/session'
import { tenantState } from '@/tenant'
import type {
  AgentDef,
  AgentDetail,
  AgentMessage,
  AgentSession,
  ConfirmRequiredEvent,
  ConfirmResolvedEvent,
  ConfirmResult,
  StreamDoneEvent,
} from '@/types/agent'

/** 会话/智能体 REST（全部走 IAM，租户由令牌 claim 决定；开发模式同既有 X-Tenant-Id 约定）。 */
export const agentApi = {
  listDefs: () => agentClient.get<AgentDef[]>('/defs').then((r) => r.data),
  findDef: (agentId: string) => agentClient.get<AgentDetail>(`/defs/${agentId}`).then((r) => r.data),
  createSession: (body: { agentId: string; agentVersion: number }) =>
    agentClient.post<AgentSession>('/sessions', body).then((r) => r.data),
  findSession: (sessionId: string) => agentClient.get<AgentSession>(`/sessions/${sessionId}`).then((r) => r.data),
  listMessages: (sessionId: string) =>
    agentClient.get<AgentMessage[]>(`/sessions/${sessionId}/messages`).then((r) => r.data),
  postMessage: (sessionId: string, content: string) =>
    agentClient
      .post<{ sessionId: string; turnNo: number; status: string }>(`/sessions/${sessionId}/messages`, { content })
      .then((r) => r.data),
  confirm: (sessionId: string, body: { confirmToken: string; decision: 'approve' | 'reject' }) =>
    agentClient.post<ConfirmResult>(`/sessions/${sessionId}/confirm`, body).then((r) => r.data),
}

/** 一条解析完成的 SSE 事件（event 缺省为 message；data 为多行 data: 拼接）。 */
export interface SseEvent {
  event: string
  data: string
}

/**
 * SSE 文本增量解析器：跨块缓存半行；空行派发事件；`:` 开头为保活注释（: ping），跳过。
 * 与后端 format_sse 输出（event:/data: 逐行 + 空行分隔）对应。
 */
export class SseParser {
  private buffer = ''
  private event = 'message'
  private dataLines: string[] = []

  feed(chunk: string): SseEvent[] {
    this.buffer += chunk
    const events: SseEvent[] = []
    let index = this.buffer.indexOf('\n')
    while (index >= 0) {
      let line = this.buffer.slice(0, index)
      this.buffer = this.buffer.slice(index + 1)
      if (line.endsWith('\r')) {
        line = line.slice(0, -1)
      }
      if (line === '') {
        if (this.dataLines.length > 0) {
          events.push({ event: this.event, data: this.dataLines.join('\n') })
        }
        this.event = 'message'
        this.dataLines = []
      } else if (line.startsWith(':')) {
        // 保活注释，忽略
      } else if (line.startsWith('event:')) {
        this.event = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        this.dataLines.push(line.slice(5).replace(/^ /, ''))
      }
      index = this.buffer.indexOf('\n')
    }
    return events
  }
}

export interface AgentStreamHandlers {
  onToken?: (text: string) => void
  onNode?: (node: string, status: string) => void
  onConfirmRequired?: (payload: ConfirmRequiredEvent) => void
  onConfirmResolved?: (payload: ConfirmResolvedEvent) => void
  onDone?: (payload: StreamDoneEvent) => void
  onError?: (message: string) => void
}

function dispatchEvent(event: SseEvent, handlers: AgentStreamHandlers): void {
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(event.data) as Record<string, unknown>
  } catch {
    return
  }
  switch (event.event) {
    case 'token':
      handlers.onToken?.(typeof payload.text === 'string' ? payload.text : '')
      break
    case 'node':
      handlers.onNode?.(String(payload.node ?? ''), String(payload.status ?? ''))
      break
    case 'confirm_required':
      handlers.onConfirmRequired?.(payload as unknown as ConfirmRequiredEvent)
      break
    case 'confirm_resolved':
      handlers.onConfirmResolved?.(payload as unknown as ConfirmResolvedEvent)
      break
    case 'done':
      handlers.onDone?.(payload as unknown as StreamDoneEvent)
      break
    case 'error':
      handlers.onError?.(typeof payload.message === 'string' ? payload.message : '未知错误')
      break
  }
}

/**
 * 订阅会话事件流（GET /agent/sessions/{id}/stream）：逐事件回调，流结束或 signal 中止时返回。
 * 中止产生的 AbortError 由调用方按 signal.aborted 判断忽略。
 */
export async function streamSession(
  sessionId: string,
  handlers: AgentStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  const headers: Record<string, string> = { Accept: 'text/event-stream' }
  if (!iamEnabled()) {
    headers['X-Tenant-Id'] = tenantState.tenantId
  }
  const token = await ensureAccessToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const response = await fetch(`/agent/sessions/${sessionId}/stream`, { headers, signal })
  if (!response.ok || !response.body) {
    throw new ApiError(response.status, 'STREAM_FAILED', `会话事件流连接失败（${response.status}）`)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const parser = new SseParser()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      for (const event of parser.feed(decoder.decode(value, { stream: true }))) {
        dispatchEvent(event, handlers)
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}
