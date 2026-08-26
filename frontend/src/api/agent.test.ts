import { afterEach, describe, expect, it, vi } from 'vitest'

import { clearSession, saveSession } from '@/auth/session'
import { DEFAULT_TENANT } from '@/tenant'
import { SseParser, streamSession } from './agent'

describe('SseParser', () => {
  it('解析完整事件块（event + data + 空行分隔）', () => {
    const parser = new SseParser()
    const events = parser.feed('event: token\ndata: {"text":"你"}\n\nevent: token\ndata: {"text":"好"}\n\n')

    expect(events).toEqual([
      { event: 'token', data: '{"text":"你"}' },
      { event: 'token', data: '{"text":"好"}' },
    ])
  })

  it('跨块缓存半行：chunk 任意切分不影响解析结果', () => {
    const parser = new SseParser()
    const raw = 'event: confirm_required\ndata: {"confirmToken":"t-1","tool":"data.x"}\n\n'
    const events = [...raw.matchAll(/[\s\S]{1,7}/g)].flatMap((m) => parser.feed(m[0]))

    expect(events).toEqual([{ event: 'confirm_required', data: '{"confirmToken":"t-1","tool":"data.x"}' }])
  })

  it('保活注释（: ping）跳过；无 event 行时缺省 message；多行 data 拼接', () => {
    const parser = new SseParser()
    const events = parser.feed(': ping\n\ndata: a\ndata: b\n\n')

    expect(events).toEqual([{ event: 'message', data: 'a\nb' }])
  })
})

describe('streamSession', () => {
  afterEach(() => {
    clearSession()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  function sseStream(text: string): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text))
        controller.close()
      },
    })
  }

  it('逐 token 回调增量文本，done 事件回调最终载荷；开发模式携带 X-Tenant-Id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseStream(
        'event: token\ndata: {"text":"你"}\n\nevent: token\ndata: {"text":"好"}\n\n' +
          'event: done\ndata: {"sessionId":"s-1","turnNo":1,"answer":"你好","status":"completed","classification":"INTERNAL"}\n\n',
      ),
    })
    vi.stubGlobal('fetch', fetchMock)

    const tokens: string[] = []
    const dones: unknown[] = []
    await streamSession(
      's-1',
      { onToken: (text) => tokens.push(text), onDone: (payload) => dones.push(payload) },
      new AbortController().signal,
    )

    expect(tokens).toEqual(['你', '好'])
    expect(dones).toEqual([
      { sessionId: 's-1', turnNo: 1, answer: '你好', status: 'completed', classification: 'INTERNAL' },
    ])
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }]
    expect(url).toBe('/agent/sessions/s-1/stream')
    expect(init.headers['X-Tenant-Id']).toBe(DEFAULT_TENANT)
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('登录会话存在时携带 Bearer 令牌（IAM 启用）', async () => {
    vi.stubEnv('VITE_IAM_ENABLED', 'true')
    saveSession({ accessToken: 'token-1', expiresAt: Date.now() + 600_000 })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, body: sseStream('') })
    vi.stubGlobal('fetch', fetchMock)

    await streamSession('s-1', {}, new AbortController().signal)

    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }]
    expect(init.headers.Authorization).toBe('Bearer token-1')
    expect(init.headers['X-Tenant-Id']).toBeUndefined()
  })

  it('confirm_required 事件触发确认卡回调', async () => {
    const payload = {
      confirmToken: 'ct-1',
      tool: 'data.update_dataset',
      riskLevel: 'R3',
      summary: { code: 'ds-1', plan: '更新数据集', impact: '覆盖写' },
      argumentsSummary: '{"id":"ds-1"}',
      expiresAt: '2026-08-26T12:00:00Z',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: sseStream(`event: confirm_required\ndata: ${JSON.stringify(payload)}\n\n`),
      }),
    )

    const cards: unknown[] = []
    await streamSession('s-1', { onConfirmRequired: (p) => cards.push(p) }, new AbortController().signal)

    expect(cards).toEqual([payload])
  })

  it('非 2xx 响应抛出中文 ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, body: null }))

    await expect(streamSession('s-1', {}, new AbortController().signal)).rejects.toThrowError('事件流连接失败（403）')
  })
})
