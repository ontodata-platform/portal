import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import type { AgentStreamHandlers } from '@/api/agent'
import { i18n } from '@/i18n'
import AgentChatView from './AgentChatView.vue'

const listDefsMock = vi.fn()
const findDefMock = vi.fn()
const createSessionMock = vi.fn()
const findSessionMock = vi.fn()
const listMessagesMock = vi.fn()
const postMessageMock = vi.fn()
const createRunMock = vi.fn()
const streamSessionMock = vi.fn()
const routerPush = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: routerPush }),
}))

vi.mock('@/api/agent', () => ({
  agentApi: {
    listDefs: () => listDefsMock(),
    findDef: (...args: unknown[]) => findDefMock(...args),
    createSession: (...args: unknown[]) => createSessionMock(...args),
    findSession: (...args: unknown[]) => findSessionMock(...args),
    listMessages: (...args: unknown[]) => listMessagesMock(...args),
    postMessage: (...args: unknown[]) => postMessageMock(...args),
    createRun: (...args: unknown[]) => createRunMock(...args),
    confirm: vi.fn(),
  },
  streamSession: (...args: unknown[]) => streamSessionMock(...args),
}))

/** Ant Design Vue 组件在测试中需要全局 stub，避免依赖完整样式与挂载动画。 */
const stubs = {
  'a-card': { template: '<div><slot /></div>' },
  'a-space': { template: '<div><slot /></div>' },
  // select 无匹配 option 时浏览器会把值重置为空，故用 input 承载选择值
  'a-select': {
    props: ['value', 'options', 'loading', 'placeholder'],
    emits: ['update:value'],
    template: '<input class="agent-select" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
  },
  'a-empty': { props: ['description'], template: '<div class="empty">{{ description }}</div>' },
  'a-textarea': {
    props: ['value', 'placeholder', 'autoSize'],
    emits: ['update:value'],
    template: '<textarea :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
  },
  // emits 必须声明：未声明 click 时父级 @click 会作为原生监听回落到根元素，与 $emit 双触发
  'a-button': {
    props: ['type', 'loading', 'disabled'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  AgentConfirmCard: { props: ['sessionId', 'payload'], template: '<div class="confirm-card-stub">{{ payload.tool }}</div>' },
  'a-alert': {
    props: ['type', 'message', 'description'],
    template: '<div class="alert-stub"><span>{{ message }}</span><span>{{ description }}</span><slot name="action" /></div>',
  },
  'a-tag': { props: ['color'], template: '<span class="tag-stub"><slot /></span>' },
}

/** 捕获最近一次 streamSession 的事件回调，驱动流式场景。 */
let streamHandlers: AgentStreamHandlers

function mountView() {
  return mount(
    defineComponent({
      components: { AgentChatView },
      template: '<AgentChatView />',
    }),
    { global: { plugins: [createPinia(), i18n], stubs } },
  )
}

async function selectAgent(wrapper: ReturnType<typeof mountView>, agentId: string) {
  const select = wrapper.find('.agent-select')
  await select.setValue(agentId)
  await flushPromises()
}

describe('AgentChatView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    listDefsMock.mockResolvedValue([
      { id: 'agent-1', tenantId: 'default', name: '检索助手', description: '', owner: 'ops', createdAt: '2026-08-26T00:00:00Z' },
    ])
    findDefMock.mockResolvedValue({
      id: 'agent-1',
      tenantId: 'default',
      name: '检索助手',
      description: '',
      owner: 'ops',
      createdAt: '2026-08-26T00:00:00Z',
      versions: [
        { agentId: 'agent-1', version: 1, riskLevel: 'R1', status: 'deprecated', createdAt: '2026-08-20T00:00:00Z' },
        { agentId: 'agent-1', version: 2, riskLevel: 'R1', status: 'published', createdAt: '2026-08-25T00:00:00Z' },
        { agentId: 'agent-1', version: 3, riskLevel: 'R1', status: 'draft', createdAt: '2026-08-26T00:00:00Z' },
      ],
    })
    createSessionMock.mockResolvedValue({
      id: 's-1',
      tenantId: 'default',
      userId: 'u-1',
      agentId: 'agent-1',
      agentVersion: 2,
      state: 'active',
      createdAt: '2026-08-26T01:00:00Z',
    })
    listMessagesMock.mockResolvedValue([
      { id: 'm-1', role: 'user', content: '历史问题', classification: 'INTERNAL', turnNo: 1, createdAt: '2026-08-26T01:00:01Z' },
      { id: 'm-2', role: 'assistant', content: '历史回答', classification: 'INTERNAL', turnNo: 1, createdAt: '2026-08-26T01:00:02Z' },
    ])
    postMessageMock.mockResolvedValue({ sessionId: 's-1', turnNo: 2, status: 'accepted' })
    streamSessionMock.mockImplementation((_id: string, handlers: AgentStreamHandlers) => {
      streamHandlers = handlers
      return new Promise(() => {})
    })
  })

  it('挂载后加载智能体列表', async () => {
    mountView()
    await flushPromises()

    expect(listDefsMock).toHaveBeenCalledTimes(1)
  })

  it('选择智能体后以最高已发布版本建会话、加载历史并订阅事件流', async () => {
    const wrapper = mountView()
    await flushPromises()
    await selectAgent(wrapper, 'agent-1')

    expect(createSessionMock).toHaveBeenCalledWith({ agentId: 'agent-1', agentVersion: 2 })
    expect(listMessagesMock).toHaveBeenCalledWith('s-1')
    expect(streamSessionMock).toHaveBeenCalledWith('s-1', expect.any(Object), expect.any(AbortSignal))
    expect(wrapper.text()).toContain('历史问题')
    expect(wrapper.text()).toContain('历史回答')
  })

  it('token 事件逐增量拼接为流式气泡，done 事件落定最终回答', async () => {
    const wrapper = mountView()
    await flushPromises()
    await selectAgent(wrapper, 'agent-1')

    streamHandlers.onToken!('你')
    await flushPromises()
    streamHandlers.onToken!('好')
    await flushPromises()
    expect(wrapper.text()).toContain('你好')

    streamHandlers.onDone!({
      sessionId: 's-1',
      turnNo: 2,
      answer: '你好，有什么可以帮你？',
      status: 'completed',
      classification: 'INTERNAL',
      messageId: 'm-3',
    })
    await flushPromises()
    expect(wrapper.text()).toContain('你好，有什么可以帮你？')
  })

  it('confirm_required 事件展示确认卡（R2/R3）', async () => {
    const wrapper = mountView()
    await flushPromises()
    await selectAgent(wrapper, 'agent-1')

    streamHandlers.onConfirmRequired!({
      confirmToken: 'ct-1',
      tool: 'data.update_dataset',
      riskLevel: 'R3',
      summary: { plan: '更新数据集' },
      argumentsSummary: '{}',
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    })
    await flushPromises()

    expect(wrapper.find('.confirm-card-stub').exists()).toBe(true)
    expect(wrapper.text()).toContain('data.update_dataset')
  })

  it('interrupted 事件展示 R4 审批条', async () => {
    const wrapper = mountView()
    await flushPromises()
    await selectAgent(wrapper, 'agent-1')

    streamHandlers.onInterrupted!({
      runId: 'run-1',
      sessionId: 's-1',
      status: 'awaiting_approval',
      kind: 'approval',
      ref: 'apr-r4-sample',
      tool: 'workflow.submit_execution',
      riskLevel: 'R4',
    })
    await flushPromises()

    expect(wrapper.text()).toContain('apr-r4-sample')
    expect(wrapper.text()).toContain('提交工作流执行')
  })

  it('R4 质量助手发送消息走 /runs', async () => {
    findDefMock.mockResolvedValue({
      id: 'agent-q',
      tenantId: 'default',
      name: '质量分析助手',
      description: '',
      owner: 'ops',
      createdAt: '2026-08-26T00:00:00Z',
      versions: [{ agentId: 'agent-q', version: 1, riskLevel: 'R4', status: 'published', createdAt: '2026-08-26T00:00:00Z' }],
    })
    createRunMock.mockResolvedValue({ runId: 'run-1', threadId: 'run-1', status: 'running' })
    const wrapper = mountView()
    await flushPromises()
    await selectAgent(wrapper, 'agent-1')

    await wrapper.find('textarea').setValue('分析高分光学影像并提交目标特性提取')
    const send = wrapper.findAll('button').find((button) => button.text().includes('发送'))!
    await send.trigger('click')
    await flushPromises()

    expect(createRunMock).toHaveBeenCalledWith('s-1', {
      graph: 'quality',
      input: { question: '分析高分光学影像并提交目标特性提取' },
    })
    expect(postMessageMock).not.toHaveBeenCalled()
  })

  it('发送消息：POST 202 受理后本地追加用户气泡并清空输入框', async () => {
    const wrapper = mountView()
    await flushPromises()
    await selectAgent(wrapper, 'agent-1')

    await wrapper.find('textarea').setValue('查一下高分光学影像')
    const send = wrapper.findAll('button').find((button) => button.text().includes('发送'))!
    await send.trigger('click')
    await flushPromises()

    expect(postMessageMock).toHaveBeenCalledWith('s-1', '查一下高分光学影像')
    expect(wrapper.text()).toContain('查一下高分光学影像')
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('组件卸载中止 SSE 连接（AbortController）', async () => {
    const wrapper = mountView()
    await flushPromises()
    await selectAgent(wrapper, 'agent-1')

    const signal = streamSessionMock.mock.calls[0][2] as AbortSignal
    expect(signal.aborted).toBe(false)

    wrapper.unmount()
    expect(signal.aborted).toBe(true)
  })
})
