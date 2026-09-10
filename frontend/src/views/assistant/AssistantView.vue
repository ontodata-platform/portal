<script setup lang="ts">
import { HistoryOutlined, PlusOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons-vue'
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AgentConfirmCard from '@/components/AgentConfirmCard.vue'
import AssistantComposer from '@/components/assistant/AssistantComposer.vue'
import AssistantLanding from '@/components/assistant/AssistantLanding.vue'
import ConversationStream from '@/components/assistant/ConversationStream.vue'
import DegradedPanel from '@/components/assistant/DegradedPanel.vue'
import SessionDrawer from '@/components/assistant/SessionDrawer.vue'
import { useAssistantEngine } from '@/composables/useAssistantEngine'
import type { IntentSuggestion } from '@/types/assistant'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const draft = ref('')
const historyOpen = ref(false)

const {
  sessions,
  currentId,
  messages,
  started,
  intents,
  degraded,
  sending,
  pendingConfirm,
  pendingApproval,
  remoteSessionId,
  confirming,
  createSession,
  selectSession,
  deleteSession,
  resumeSession,
  renameSession,
  stop,
  regenerate,
  retryLast,
  send: sendMessage,
  confirmDecision,
  onConfirmResolved,
} = useAssistantEngine()

function send(text: string) {
  void sendMessage(text)
}

function pick(intent: IntentSuggestion) {
  send(intent.example)
}

function submitDraft() {
  const text = draft.value.trim()
  if (!text) return
  send(text)
  draft.value = ''
}

function goApproval() {
  if (!pendingApproval.value) return
  void router.push({
    path: '/personal/approvals',
    query: { code: pendingApproval.value, from: 'agent' },
  })
}

function rerunLastAnswer() {
  void regenerate()
}

function retryLastMessage() {
  void retryLast()
}

onMounted(() => {
  const q = typeof route.query.q === 'string' ? route.query.q : ''
  const resume = typeof route.query.resume === 'string' ? route.query.resume : ''
  if (resume) {
    resumeSession(resume)
  }
  if (q) {
    send(q)
  }
})

watch(
  () => route.query.q,
  (value) => {
    if (typeof value === 'string' && value && !sending.value) {
      send(value)
    }
  },
)
</script>

<template>
  <div class="assistant-page" :class="{ chatting: started }">
    <aside v-if="historyOpen" class="history-rail">
      <SessionDrawer
        :sessions="sessions"
        :model-value="currentId"
        @update:model-value="selectSession"
        @create="createSession(); historyOpen = false"
        @delete="deleteSession"
        @rename="renameSession"
      />
    </aside>

    <div class="stage">
      <div class="floating-tools">
        <button
          type="button"
          class="ghost-btn"
          :class="{ active: historyOpen }"
          :aria-label="t('assistant.sessions')"
          @click="historyOpen = !historyOpen"
        >
          <HistoryOutlined />
          <span>{{ t('assistant.sessions') }}</span>
        </button>
        <button
          v-if="sending"
          type="button"
          class="ghost-btn"
          aria-label="停止生成"
          @click="stop"
        >
          <StopOutlined />
          <span>停止生成</span>
        </button>
        <button
          v-else-if="started"
          type="button"
          class="ghost-btn"
          aria-label="重新生成"
          @click="rerunLastAnswer"
        >
          <ReloadOutlined />
          <span>重新生成</span>
        </button>
        <button
          v-if="started"
          type="button"
          class="ghost-btn"
          :aria-label="t('assistant.newSession')"
          @click="createSession()"
        >
          <PlusOutlined />
          <span>{{ t('assistant.newSession') }}</span>
        </button>
      </div>

      <a-alert
        v-if="degraded"
        type="warning"
        show-icon
        :message="t('assistant.degradedBanner')"
        class="banner"
      />
      <DegradedPanel
        v-if="degraded"
        :keyword="typeof route.query.q === 'string' ? route.query.q : ''"
        @retry="retryLastMessage"
      />

      <template v-else>
        <div class="scroll">
          <AssistantLanding v-if="!started" :intents="intents" @send="send" @pick="pick" />
          <ConversationStream v-else :messages="messages" />

          <div v-if="pendingConfirm && remoteSessionId" class="confirm">
            <AgentConfirmCard
              :session-id="remoteSessionId"
              :payload="pendingConfirm"
              @resolved="onConfirmResolved"
            />
          </div>
          <div v-else-if="pendingConfirm" class="confirm">
            <a-card :title="t('assistant.confirmTitle')" class="confirm-card">
              <p>{{ pendingConfirm.summary.plan }}</p>
              <a-space>
                <a-button type="primary" :loading="confirming" @click="confirmDecision('approve')">{{ t('assistant.approve') }}</a-button>
                <a-button :loading="confirming" @click="confirmDecision('reject')">{{ t('assistant.reject') }}</a-button>
              </a-space>
            </a-card>
          </div>
          <a-alert
            v-if="pendingApproval"
            type="info"
            show-icon
            :message="t('assistant.approvalWaiting', { code: pendingApproval })"
            class="confirm"
          >
            <template #action>
              <a-button type="link" @click="goApproval">{{ t('assistant.goApproval') }}</a-button>
            </template>
          </a-alert>
        </div>

        <div v-if="started" class="dock">
          <AssistantComposer
            v-model="draft"
            variant="dock"
            :loading="sending"
            @submit="submitDraft"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.assistant-page {
  margin: -24px;
  height: calc(100vh - var(--od-topbar-height, 60px));
  background: #ffffff;
  display: flex;
  position: relative;
}

.history-rail {
  flex: 0 0 260px;
  max-width: 260px;
  z-index: 2;
  box-shadow: 2px 0 8px rgba(15, 23, 42, 0.04);
}

.stage {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  background: #ffffff;
}

.floating-tools {
  position: absolute;
  top: 16px;
  left: 20px;
  z-index: 3;
  display: flex;
  gap: 8px;
}

.ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--od-gray-600, #475569);
  cursor: pointer;
  box-shadow: var(--od-shadow-xs);
  transition: all 0.15s ease;
}

.ghost-btn:hover,
.ghost-btn.active {
  border-color: var(--od-primary-300, #93c5fd);
  color: var(--od-color-primary, #1e40af);
  background: #ffffff;
}

.banner {
  margin: 56px 24px 0;
  border-radius: 8px;
}

.scroll {
  flex: 1;
  overflow: auto;
  padding: 56px 24px 24px;
}

.confirm {
  width: min(760px, 100%);
  margin: 0 auto 16px;
}

.confirm-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: var(--od-shadow-1);
}

.dock {
  position: sticky;
  bottom: 0;
  padding: 12px 24px 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.95) 40%, #ffffff 100%);
}

.dock :deep(.composer) {
  width: min(760px, 100%);
  margin: 0 auto;
}

@media (max-width: 900px) {
  .history-rail {
    position: absolute;
    inset: 0 auto 0 0;
    box-shadow: var(--od-shadow-3);
    background: #fff;
  }
}
</style>
