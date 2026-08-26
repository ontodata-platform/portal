<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { agentApi, streamSession } from '@/api/agent'
import { ApiError } from '@/api/client'
import AgentConfirmCard from '@/components/AgentConfirmCard.vue'
import { useMessageStore } from '@/stores/message'
import type { AgentDef, AgentMessage, AgentSession, ConfirmRequiredEvent } from '@/types/agent'

/**
 * 智能体会话页（M2 批次 A5）：选择已发布智能体建会话 → 历史消息 + SSE 逐 token
 * 流式回复；R2/R3 工具调用以确认卡裁决。SSE 连接随会话切换/组件卸载中止。
 */
interface ChatItem {
  id: string
  role: AgentMessage['role']
  content: string
  streaming?: boolean
}

const { t } = useI18n()
const messageStore = useMessageStore()

const agents = ref<AgentDef[]>([])
const agentsLoading = ref(false)
const selectedAgentId = ref<string>()
const session = ref<AgentSession | null>(null)
const starting = ref(false)
const messages = ref<ChatItem[]>([])
const input = ref('')
const sending = ref(false)
const pendingConfirm = ref<ConfirmRequiredEvent | null>(null)
const listRef = ref<HTMLElement | null>(null)

/** 进行中的流式回复气泡（token 增量拼接目标）。 */
const streamingItem = ref<ChatItem | null>(null)

let streamController: AbortController | null = null

const agentOptions = computed(() => agents.value.map((agent) => ({ value: agent.id, label: agent.name })))

const roleLabel = computed<Record<ChatItem['role'], string>>(() => ({
  user: t('agentChat.roleUser'),
  assistant: t('agentChat.roleAssistant'),
  tool: t('agentChat.roleTool'),
  system: t('agentChat.roleSystem'),
}))

async function scrollToBottom() {
  await nextTick()
  const list = listRef.value
  if (list) {
    list.scrollTop = list.scrollHeight
  }
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

/** 打开会话事件流；断线/中止仅记录（abort 属正常清理，不上报）。 */
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
      onDone: (payload) => {
        if (streamingItem.value) {
          if (payload.answer || streamingItem.value.content) {
            streamingItem.value.content = payload.answer || streamingItem.value.content
            streamingItem.value.streaming = false
          } else {
            // awaiting_confirmation 且无流式输出：移除空气泡
            messages.value = messages.value.filter((item) => item !== streamingItem.value)
          }
          streamingItem.value = null
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

/** 选中智能体后建会话：取最高已发布版本（仅已发布版本可建会话，后端 409 兜底）。 */
async function startSession(agentId: string) {
  starting.value = true
  stopStream()
  session.value = null
  messages.value = []
  pendingConfirm.value = null
  streamingItem.value = null
  try {
    const detail = await agentApi.findDef(agentId)
    const published = detail.versions
      .filter((version) => version.status === 'published')
      .sort((a, b) => b.version - a.version)[0]
    if (!published) {
      messageStore.reportError(new ApiError(409, 'NO_PUBLISHED_VERSION', t('agentChat.noPublishedVersion')))
      return
    }
    session.value = await agentApi.createSession({ agentId, agentVersion: published.version })
    await reloadMessages()
    openStream(session.value.id)
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    starting.value = false
  }
}

async function send() {
  const content = input.value.trim()
  if (!content || !session.value || sending.value) {
    return
  }
  sending.value = true
  try {
    await agentApi.postMessage(session.value.id, content)
    messages.value = [...messages.value, { id: `local-${Date.now()}`, role: 'user', content }]
    input.value = ''
    await scrollToBottom()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    sending.value = false
  }
}

/** 确认卡裁决完成：移除确认卡并回刷历史（工具结果/审计行已由后端落库）。 */
async function onConfirmResolved() {
  pendingConfirm.value = null
  await reloadMessages()
}

watch(selectedAgentId, (agentId) => {
  if (agentId) {
    void startSession(agentId)
  }
})

onMounted(loadAgents)
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
    </a-space>

    <a-empty v-if="!agentsLoading && agents.length === 0" :description="t('agentChat.noAgent')" />

    <template v-if="session">
      <div ref="listRef" class="message-list">
        <a-empty v-if="messages.length === 0" :description="t('agentChat.empty')" />
        <div v-for="item in messages" :key="item.id" class="message-row" :class="`role-${item.role}`">
          <div class="message-bubble">
            <div class="message-role">{{ roleLabel[item.role] }}</div>
            <div class="message-content">{{ item.content }}<span v-if="item.streaming" class="cursor">▌</span></div>
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
          @keydown.enter.exact.prevent="send"
        />
        <a-button type="primary" :loading="sending" :disabled="!input.trim()" @click="send">
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
