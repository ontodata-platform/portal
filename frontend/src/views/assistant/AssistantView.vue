<script setup lang="ts">
import { MenuOutlined, PlusOutlined } from '@ant-design/icons-vue'
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
  createSession,
  selectSession,
  deleteSession,
  resumeSession,
  send: sendMessage,
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
      />
    </aside>

    <div class="stage">
      <div class="floating-tools">
        <button type="button" class="ghost-btn" :aria-label="t('assistant.sessions')" @click="historyOpen = !historyOpen">
          <MenuOutlined />
          <span>{{ t('assistant.sessions') }}</span>
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
      <DegradedPanel v-if="degraded" :keyword="typeof route.query.q === 'string' ? route.query.q : ''" />

      <template v-else>
        <div class="scroll">
          <AssistantLanding v-if="!started" :intents="intents" @send="send" @pick="pick" />
          <ConversationStream v-else :messages="messages" />

          <div v-if="pendingConfirm && remoteSessionId" class="confirm">
            <AgentConfirmCard
              :session-id="remoteSessionId"
              :payload="pendingConfirm"
              @resolved="pendingConfirm = null"
            />
          </div>
          <div v-else-if="pendingConfirm" class="confirm">
            <a-card :title="t('assistant.confirmTitle')">
              <p>{{ pendingConfirm.summary.plan }}</p>
              <a-space>
                <a-button type="primary" @click="pendingConfirm = null">{{ t('assistant.approve') }}</a-button>
                <a-button @click="pendingConfirm = null">{{ t('assistant.reject') }}</a-button>
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
  margin: -20px -24px;
  min-height: calc(100vh - 60px);
  background: #fff;
  display: flex;
  position: relative;
}

.history-rail {
  flex: 0 0 260px;
  max-width: 260px;
  min-height: calc(100vh - 60px);
  z-index: 2;
}

.stage {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}

.floating-tools {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 3;
  display: flex;
  gap: 8px;
}

.ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  background: rgb(255 255 255 / 92%);
  backdrop-filter: blur(6px);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--od-gray-600, #475569);
  cursor: pointer;
}

.ghost-btn:hover {
  border-color: var(--od-primary-300, #7a9fc4);
  color: var(--od-primary-600, #1b446a);
}

.banner {
  margin: 56px 24px 0;
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

.dock {
  position: sticky;
  bottom: 0;
  padding: 8px 24px 28px;
  background: linear-gradient(180deg, rgb(255 255 255 / 0%), #fff 28%);
}

.dock :deep(.composer) {
  width: min(760px, 100%);
  margin: 0 auto;
}

@media (max-width: 900px) {
  .history-rail {
    position: absolute;
    inset: 0 auto 0 0;
    box-shadow: var(--od-shadow-3, 0 12px 32px rgb(15 23 42 / 12%));
    background: #fff;
  }
}
</style>
