import { computed, ref } from 'vue'

import { agentApi, streamSession } from '@/api/agent'
import { i18n } from '@/i18n'
import { useLocalMock } from '@/mocks/localMode'
import { listIntentSuggestions, routeAssistantIntent, streamAssistantText } from '@/mocks/assistantMockApi'
import type { AssistantMessage, AssistantSession, IntentSuggestion } from '@/types/assistant'
import type { ConfirmRequiredEvent } from '@/types/agent'

const STORAGE_KEY = 'od-assistant-sessions'

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadSessions(): AssistantSession[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AssistantSession[]) : []
  } catch {
    return []
  }
}

function persist(sessions: AssistantSession[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

export function useAssistantEngine() {
  const sessions = ref<AssistantSession[]>(loadSessions())
  const currentId = ref(sessions.value[0]?.id ?? '')
  const intents = ref<IntentSuggestion[]>(listIntentSuggestions())
  const degraded = ref(false)
  const sending = ref(false)
  const pendingConfirm = ref<ConfirmRequiredEvent | null>(null)
  const pendingApproval = ref<string>('')
  const remoteSessionId = ref('')
  const activeController = ref<AbortController | null>(null)
  const lastSentText = ref('')
  const confirming = ref(false)

  const current = computed(() => sessions.value.find((item) => item.id === currentId.value) ?? null)
  const messages = computed(() => current.value?.messages ?? [])
  const started = computed(() => messages.value.length > 0)

  function save() {
    persist(sessions.value)
  }

  function createSession(title = '新会话'): AssistantSession {
    const session: AssistantSession = { id: uid('sess'), title, updatedAt: Date.now(), messages: [] }
    sessions.value = [session, ...sessions.value]
    currentId.value = session.id
    save()
    return session
  }

  function ensureSession(): AssistantSession {
    return current.value ?? createSession()
  }

  function selectSession(id: string) {
    currentId.value = id
  }

  function renameSession(id: string, title: string) {
    const session = sessions.value.find((item) => item.id === id)
    if (session) {
      session.title = title
      session.updatedAt = Date.now()
      save()
    }
  }

  function deleteSession(id: string) {
    sessions.value = sessions.value.filter((item) => item.id !== id)
    if (currentId.value === id) {
      currentId.value = sessions.value[0]?.id ?? ''
    }
    save()
  }

  function resumeSession(id: string) {
    const found = sessions.value.find((item) => item.id === id)
    if (found) {
      currentId.value = found.id
      return
    }
    createSession('续接会话')
  }

  function pushMessage(partial: Omit<AssistantMessage, 'id'> & { id?: string }): AssistantMessage {
    const session = ensureSession()
    const message: AssistantMessage = { id: partial.id ?? uid('msg'), ...partial }
    session.messages.push(message)
    session.updatedAt = Date.now()
    if (partial.role === 'user' && session.title === '新会话') {
      session.title = (partial.text ?? '新会话').slice(0, 18)
    }
    save()
    return message
  }

  async function sendMock(text: string, signal: AbortSignal) {
    pushMessage({ role: 'user', text })
    const turn = routeAssistantIntent(text)
    const assistant = pushMessage({ role: 'assistant', text: '', streaming: true })
    await streamAssistantText(turn.text, (chunk) => {
      assistant.text = `${assistant.text ?? ''}${chunk}`
    }, signal)
    if (signal.aborted) {
      assistant.streaming = false
      save()
      return
    }
    const finished: AssistantMessage = {
      ...assistant,
      text: turn.text,
      streaming: false,
      cards: turn.cards,
      citations: turn.citations,
      actions: turn.actions,
      approvalCode: turn.approvalCode,
      confirmToken: turn.confirm?.confirmToken,
    }
    const session = ensureSession()
    session.messages = session.messages.map((item) => (item.id === finished.id ? finished : item))
    if (turn.confirm) {
      pendingConfirm.value = turn.confirm
    }
    if (turn.approvalCode) {
      pendingApproval.value = turn.approvalCode
    }
    sessions.value = sessions.value.map((item) => (item.id === session.id ? { ...session, messages: [...session.messages] } : item))
    save()
  }

  async function sendRemote(text: string, signal: AbortSignal) {
    try {
      if (!remoteSessionId.value) {
        const agents = await agentApi.listDefs()
        const agent = agents[0]
        if (!agent) throw new Error('NO_AGENT')
        const detail = await agentApi.findDef(agent.id)
        const published = detail.versions.find((item) => item.status === 'published')
        if (!published) throw new Error('NO_VERSION')
        const session = await agentApi.createSession({ agentId: agent.id, agentVersion: published.version })
        remoteSessionId.value = session.id
      }
      pushMessage({ role: 'user', text })
      const assistant = pushMessage({ role: 'assistant', text: '', streaming: true })
      await agentApi.postMessage(remoteSessionId.value, text)
      await streamSession(
        remoteSessionId.value,
        {
          onToken: (token) => {
            assistant.text = `${assistant.text ?? ''}${token}`
          },
          onConfirmRequired: (payload) => {
            pendingConfirm.value = payload
            assistant.confirmToken = payload.confirmToken
          },
          onInterrupted: (payload) => {
            pendingApproval.value = payload.ref
            assistant.approvalCode = payload.ref
          },
          onDone: (payload) => {
            assistant.streaming = false
            if (payload.answer && !assistant.text) assistant.text = payload.answer
          },
        },
        signal,
      )
      if (signal.aborted) return
      assistant.streaming = false
      save()
    } catch {
      if (signal.aborted) return
      degraded.value = true
    }
  }

  async function send(text: string) {
    const content = text.trim()
    if (!content || sending.value) return
    sending.value = true
    lastSentText.value = content
    const controller = new AbortController()
    activeController.value = controller
    try {
      if (useLocalMock) {
        degraded.value = false
        await sendMock(content, controller.signal)
      } else {
        await sendRemote(content, controller.signal)
      }
    } finally {
      if (activeController.value === controller) activeController.value = null
      sending.value = false
    }
  }

  function appendCancelledNotice() {
    pushMessage({ role: 'assistant', text: String(i18n.global.t('assistant.confirmCancelled')) })
  }

  async function confirmDecision(decision: 'approve' | 'reject') {
    const payload = pendingConfirm.value
    if (!payload || confirming.value) return
    confirming.value = true
    const sessionId = remoteSessionId.value || current.value?.id || 'local-assistant'
    try {
      await agentApi.confirm(sessionId, {
        confirmToken: payload.confirmToken,
        decision,
      })
    } catch {
      // 降级卡仍要给出明确反馈：接口失败不阻断本地收口
    } finally {
      pendingConfirm.value = null
      if (decision === 'reject') appendCancelledNotice()
      confirming.value = false
    }
  }

  function onConfirmResolved(result: { decision: 'executed' | 'rejected' }) {
    pendingConfirm.value = null
    if (result.decision === 'rejected') appendCancelledNotice()
  }

  function stop() {
    const pending = pendingConfirm.value
    activeController.value?.abort()
    const session = current.value
    if (session) {
      session.messages = session.messages.map((item) => (item.streaming ? { ...item, streaming: false } : item))
      sessions.value = sessions.value.map((item) => (item.id === session.id ? { ...session, messages: [...session.messages] } : item))
      save()
    }
    if (pending) void confirmDecision('reject')
  }

  async function regenerate() {
    const session = current.value
    if (!session || sending.value) return
    const lastUserIndex = [...session.messages].map((item) => item.role).lastIndexOf('user')
    const user = lastUserIndex >= 0 ? session.messages[lastUserIndex] : undefined
    if (!user?.text) return
    session.messages = session.messages.slice(0, lastUserIndex)
    sessions.value = sessions.value.map((item) => (item.id === session.id ? { ...session, messages: [...session.messages] } : item))
    save()
    await send(user.text)
  }

  async function retryLast() {
    if (lastSentText.value && !sending.value) await send(lastSentText.value)
  }

  return {
    sessions,
    currentId,
    current,
    messages,
    started,
    intents,
    degraded,
    sending,
    pendingConfirm,
    pendingApproval,
    remoteSessionId,
    lastSentText,
    confirming,
    confirmDecision,
    onConfirmResolved,
    createSession,
    selectSession,
    renameSession,
    deleteSession,
    resumeSession,
    stop,
    regenerate,
    retryLast,
    send,
  }
}
