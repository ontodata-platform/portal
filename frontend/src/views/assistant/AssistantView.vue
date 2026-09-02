<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AgentConfirmCard from '@/components/AgentConfirmCard.vue'
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
  <div class="assistant-page">
    <div class="toolbar">
      <a-button size="small" @click="historyOpen = !historyOpen">{{ t('assistant.sessions') }}</a-button>
    </div>
    <div class="body">
      <SessionDrawer
        v-if="historyOpen || sessions.length > 0"
        class="history"
        :sessions="sessions"
        :model-value="currentId"
        @update:model-value="selectSession"
        @create="createSession()"
        @delete="deleteSession"
      />
      <div class="main">
        <a-alert
          v-if="degraded"
          type="warning"
          show-icon
          :message="t('assistant.degradedBanner')"
          class="banner"
        />
        <DegradedPanel v-if="degraded" :keyword="typeof route.query.q === 'string' ? route.query.q : ''" />
        <template v-else>
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
          >
            <template #action>
              <a-button type="link" @click="goApproval">{{ t('assistant.goApproval') }}</a-button>
            </template>
          </a-alert>
          <div v-if="started" class="composer">
            <a-input
              v-model:value="draft"
              :placeholder="t('assistant.inputPlaceholder')"
              @press-enter="send(draft); draft = ''"
            />
            <a-button type="primary" :loading="sending" @click="send(draft); draft = ''">
              {{ t('assistant.send') }}
            </a-button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.assistant-page { display: flex; flex-direction: column; min-height: calc(100vh - 120px); }
.toolbar { margin-bottom: 8px; }
.body { display: flex; gap: 16px; flex: 1; }
.main { flex: 1; min-width: 0; }
.banner, .confirm { margin-bottom: 12px; }
.composer { display: flex; gap: 8px; margin-top: 16px; }
</style>
