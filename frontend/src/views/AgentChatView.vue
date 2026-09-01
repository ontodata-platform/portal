<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { agentApi, streamSession } from '@/api/agent'
import { ApiError } from '@/api/client'
import AgentConfirmCard from '@/components/AgentConfirmCard.vue'
import { localAgentMockApi } from '@/mocks/agentMockApi'
import { useLocalMock } from '@/mocks/localMode'
import { useMessageStore } from '@/stores/message'
import type {
  AgentDef,
  AgentMessage,
  AgentSession,
  AgentVersion,
  ConfirmRequiredEvent,
  InterruptedEvent,
  StreamDoneEvent,
} from '@/types/agent'

/**
 * 智能体会话页（3B）：检索助手走 messages + R2/R3 确认卡；质量分析助手走
 * /runs（graph=quality），R4 中断展示审批条并深链审批中心。
 */
interface ChatItem {
  id: string
  role: AgentMessage['role']
  content: string
  streaming?: boolean
}

const LAST_SESSION_KEY = 'ontodata.agent.lastSession'
const SAMPLE_QUALITY_PROMPT = '分析客户表质量并提交工作流'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const messageStore = useMessageStore()

const agents = ref<AgentDef[]>([])
const agentsLoading = ref(false)
const selectedAgentId = ref<string>()
const publishedVersion = ref<AgentVersion | null>(null)
const session = ref<AgentSession | null>(null)
const starting = ref(false)
const messages = ref<ChatItem[]>([])
const input = ref('')
const sending = ref(false)
const pendingConfirm = ref<ConfirmRequiredEvent | null>(null)
const pendingApproval = ref<InterruptedEvent | null>(null)
const listRef = ref<HTMLElement | null>(null)
const streamingItem = ref<ChatItem | null>(null)

let streamController: AbortController | null = null
let restoring = false

const agentOptions = computed(() => agents.value.map((agent) => ({ value: agent.id, label: agent.name })))

const roleLabel = computed<Record<ChatItem['role'], string>>(() => ({
  user: t('agentChat.roleUser'),
  assistant: t('agentChat.roleAssistant'),
  tool: t('agentChat.roleTool'),
  system: t('agentChat.roleSystem'),
}))

const usesQualityGraph = computed(() => publishedVersion.value?.riskLevel === 'R4')

async function scrollToBottom() {
  await nextTick()
  const list = listRef.value
  if (list) {
    list.scrollTop = list.scrollHeight
  }
}

function rememberSession(current: AgentSession, agentId: string) {
  sessionStorage.setItem(LAST_SESSION_KEY, JSON.stringify({ sessionId: current.id, agentId }))
}

function readRemembered(): { sessionId: string; agentId: string } | null {
  try {
    const raw = sessionStorage.getItem(LAST_SESSION_KEY)
    return raw ? (JSON.parse(raw) as { sessionId: string; agentId: string }) : null
  } catch {
    return null
  }
}

function tryParseRecord(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function displayContent(item: ChatItem): string {
  const parsed = tryParseRecord(item.content)
  if (parsed?.audit === 'confirm') {
    return t('agentChat.auditConfirm', { decision: String(parsed.decision ?? ''), tool: String(parsed.tool ?? '') })
  }
  if (parsed?.audit === 'approval') {
    return t('agentChat.auditApproval', { code: String(parsed.approvalCode ?? '') })
  }
  return item.content
}

function approvalCodeOf(item: ChatItem): string | null {
  const parsed = tryParseRecord(item.content)
  const fromJson = parsed?.approvalCode
  if (typeof fromJson === 'string' && fromJson.startsWith('apr-')) {
    return fromJson
  }
  const match = item.content.match(/apr-[0-9a-z-]+/i)
  return match?.[0] ?? null
}

async function loadAgents() {
  agentsLoading.value = true
  try {
    agents.value = await agentApi.listDefs()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    agentsLoading.value = false
  }
}

function stopStream() {
  streamController?.abort()
  streamController = null
}

function openStream(sessionId: string) {
  stopStream()
  const controller = new AbortController()
  streamController = controller
  streamSession(
    sessionId,
    {
      onToken: (text) => {
        if (!streamingItem.value) {
          const item: ChatItem = { id: `streaming-${Date.now()}`, role: 'assistant', content: '', streaming: true }
          streamingItem.value = item
          messages.value = [...messages.value, item]
        }
        streamingItem.value.content += text
        void scrollToBottom()
      },
      onConfirmRequired: (payload) => {
        pendingConfirm.value = payload
      },
      onConfirmResolved: () => {
        pendingConfirm.value = null
        void reloadMessages()
      },
      onInterrupted: (payload) => {
        pendingApproval.value = payload
        void reloadMessages()
      },
      onDone: (payload: StreamDoneEvent) => {
        if (payload.status === 'succeeded' || payload.status === 'completed') {
          pendingApproval.value = null
        }
        if (streamingItem.value) {
          if (payload.answer || streamingItem.value.content) {
            streamingItem.value.content = payload.answer || streamingItem.value.content
            streamingItem.value.streaming = false
          } else {
            messages.value = messages.value.filter((item) => item !== streamingItem.value)
          }
          streamingItem.value = null
        } else if (payload.answer) {
          messages.value = [
            ...messages.value,
            { id: payload.messageId || `done-${Date.now()}`, role: 'assistant', content: payload.answer },
          ]
        }
        void scrollToBottom()
      },
      onError: (message) => {
        streamingItem.value = null
        messageStore.reportError(new ApiError(0, 'TURN_FAILED', message))
      },
    },
    controller.signal,
  ).catch((error: unknown) => {
    if (!controller.signal.aborted) {
      messageStore.reportError(error)
    }
  })
}

async function reloadMessages() {
  if (!session.value) {
    return
  }
  try {
    const history = await agentApi.listMessages(session.value.id)
    messages.value = history.map((message) => ({ id: message.id, role: message.role, content: message.content }))
    await scrollToBottom()
  } catch (error) {
    messageStore.reportError(error)
  }
}

async function bindPublished(agentId: string) {
  const detail = await agentApi.findDef(agentId)
  const published = detail.versions
    .filter((version) => version.status === 'published')
    .sort((a, b) => b.version - a.version)[0]
  publishedVersion.value = published ?? null
  return published
}

async function startSession(agentId: string) {
  starting.value = true
  stopStream()
  session.value = null
  messages.value = []
  pendingConfirm.value = null
  pendingApproval.value = null
  streamingItem.value = null
  try {
    const published = await bindPublished(agentId)
    if (!published) {
      messageStore.reportError(new ApiError(409, 'NO_PUBLISHED_VERSION', t('agentChat.noPublishedVersion')))
      return
    }
    session.value = await agentApi.createSession({ agentId, agentVersion: published.version })
    rememberSession(session.value, agentId)
    await reloadMessages()
    openStream(session.value.id)
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    starting.value = false
  }
}

async function restoreSession(saved: { sessionId: string; agentId: string }) {
  starting.value = true
  try {
    await bindPublished(saved.agentId)
    session.value = await agentApi.findSession(saved.sessionId)
    selectedAgentId.value = saved.agentId
    await reloadMessages()
    openStream(session.value.id)
    const resume = typeof route.query.resume === 'string' ? route.query.resume : ''
    if (resume && useLocalMock) {
      await localAgentMockApi.resumeAfterApproval(session.value.id, resume)
      await reloadMessages()
      pendingApproval.value = null
    }
  } catch {
    sessionStorage.removeItem(LAST_SESSION_KEY)
  } finally {
    starting.value = false
  }
}

async function send(text?: string) {
  const content = (text ?? input.value).trim()
  if (!content || !session.value || sending.value) {
    return
  }
  sending.value = true
  try {
    if (usesQualityGraph.value) {
      await agentApi.createRun(session.value.id, { graph: 'quality', input: { question: content } })
    } else {
      await agentApi.postMessage(session.value.id, content)
    }
    messages.value = [...messages.value, { id: `local-${Date.now()}`, role: 'user', content }]
    input.value = ''
    await scrollToBottom()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    sending.value = false
  }
}

async function onConfirmResolved() {
  pendingConfirm.value = null
  await reloadMessages()
}

function goApproval() {
  if (!pendingApproval.value?.ref) {
    return
  }
  void router.push({ path: '/approvals', query: { code: pendingApproval.value.ref, from: 'agent' } })
}

watch(selectedAgentId, (agentId) => {
  if (agentId && !restoring) {
    void startSession(agentId)
  }
})

onMounted(async () => {
  await loadAgents()
  const saved = readRemembered()
  if (saved) {
    restoring = true
    await restoreSession(saved)
    restoring = false
  }
})
onUnmounted(stopStream)
</script>

<template>
  <a-card>
    <a-space style="margin-bottom: 12px" wrap>
      <a-select
        v-model:value="selectedAgentId"
        :options="agentOptions"
        :loading="agentsLoading"
        :placeholder="t('agentChat.selectAgent')"
        style="width: 280px"
      />
      <span v-if="starting">{{ t('agentChat.starting') }}</span>
      <a-tag v-if="usesQualityGraph" color="error">R4</a-tag>
      <span v-if="usesQualityGraph" class="quality-hint">{{ t('agentChat.qualityHint') }}</span>
    </a-space>

    <a-empty v-if="!agentsLoading && agents.length === 0" :description="t('agentChat.noAgent')" />

    <template v-if="session">
      <div v-if="usesQualityGraph" class="sample-row">
        <a-button size="small" @click="send(SAMPLE_QUALITY_PROMPT)">{{ t('agentChat.samplePrompt') }}</a-button>
      </div>

      <a-alert
        v-if="pendingApproval"
        type="warning"
        show-icon
        class="approval-bar"
        :message="t('agentChat.approvalTitle')"
        :description="t('agentChat.approvalWaiting', { code: pendingApproval.ref, tool: pendingApproval.tool || '' })"
      >
        <template #action>
          <a-button type="primary" size="small" @click="goApproval">{{ t('agentChat.goApproval') }}</a-button>
        </template>
      </a-alert>

      <div ref="listRef" class="message-list">
        <a-empty v-if="messages.length === 0" :description="t('agentChat.empty')" />
        <div v-for="item in messages" :key="item.id" class="message-row" :class="`role-${item.role}`">
          <div class="message-bubble">
            <div class="message-role">{{ roleLabel[item.role] }}</div>
            <div class="message-content">
              {{ displayContent(item) }}<span v-if="item.streaming" class="cursor">▌</span>
            </div>
            <a
              v-if="approvalCodeOf(item)"
              class="approval-link"
              href="#"
              @click.prevent="router.push({ path: '/approvals', query: { code: approvalCodeOf(item) || '', from: 'agent' } })"
            >
              {{ t('agentChat.openApproval', { code: approvalCodeOf(item) }) }}
            </a>
          </div>
        </div>
        <AgentConfirmCard
          v-if="pendingConfirm"
          :session-id="session.id"
          :payload="pendingConfirm"
          @resolved="onConfirmResolved"
        />
      </div>

      <div class="input-row">
        <a-textarea
          v-model:value="input"
          :placeholder="t('agentChat.inputPlaceholder')"
          :auto-size="{ minRows: 1, maxRows: 4 }"
          @keydown.enter.exact.prevent="send()"
        />
        <a-button type="primary" :loading="sending" :disabled="!input.trim()" @click="send()">
          {{ t('agentChat.send') }}
        </a-button>
      </div>
    </template>
  </a-card>
</template>

<style scoped>
.message-list {
  max-height: 60vh;
  overflow-y: auto;
  padding: 8px 4px;
}

.message-row {
  display: flex;
  margin-bottom: 12px;
}

.message-row.role-user {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 75%;
  padding: 8px 12px;
  border-radius: 8px;
  background: #f5f5f5;
}

.role-user .message-bubble {
  background: #e6f4ff;
}

.role-tool .message-bubble,
.role-system .message-bubble {
  background: transparent;
  border: 1px dashed #d9d9d9;
  color: rgba(0, 0, 0, 0.55);
}

.message-role {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  margin-bottom: 4px;
}

.message-content {
  white-space: pre-wrap;
  word-break: break-word;
}

.approval-link {
  display: inline-block;
  margin-top: 6px;
  font-size: 12px;
}

.quality-hint {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}

.sample-row {
  margin-bottom: 8px;
}

.approval-bar {
  margin-bottom: 12px;
}

.cursor {
  animation: blink 1s step-start infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.input-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  align-items: flex-end;
}
</style>
