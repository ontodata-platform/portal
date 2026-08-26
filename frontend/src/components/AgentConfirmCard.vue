<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { agentApi } from '@/api/agent'
import { ApiError } from '@/api/client'
import type { ConfirmRequiredEvent } from '@/types/agent'

/**
 * R2/R3 工具调用确认卡（M2 A5）：SSE confirm_required 事件触发展示；
 * 确认/拒绝提交 POST /agent/sessions/{id}/confirm，票据一次性（重放 409）、
 * 过期 410（本地倒计时归零同样置为过期态）。卡状态随响应更新。
 */
const props = defineProps<{
  sessionId: string
  payload: ConfirmRequiredEvent
}>()

const emit = defineEmits<{
  resolved: [result: { decision: 'executed' | 'rejected'; tool: string }]
}>()

const { t } = useI18n()

type CardState = 'pending' | 'submitting' | 'executed' | 'rejected' | 'expired' | 'conflict' | 'failed'

const state = ref<CardState>('pending')
const errorMessage = ref('')

/** 过期倒计时（秒）：归零且未提交时本地置为过期态（后端同时以 410 兜底）。 */
const remainSeconds = ref(Math.max(0, Math.ceil((new Date(props.payload.expiresAt).getTime() - Date.now()) / 1000)))
const countdownTimer = window.setInterval(() => {
  remainSeconds.value = Math.max(0, Math.ceil((new Date(props.payload.expiresAt).getTime() - Date.now()) / 1000))
  if (remainSeconds.value === 0 && state.value === 'pending') {
    state.value = 'expired'
    window.clearInterval(countdownTimer)
  }
}, 1000)

onUnmounted(() => window.clearInterval(countdownTimer))

const actionable = computed(() => state.value === 'pending' && remainSeconds.value > 0)

const riskColor = computed(() => (props.payload.riskLevel === 'R3' ? 'error' : 'warning'))

async function decide(decision: 'approve' | 'reject') {
  if (!actionable.value) {
    return
  }
  state.value = 'submitting'
  try {
    const result = await agentApi.confirm(props.sessionId, {
      confirmToken: props.payload.confirmToken,
      decision,
    })
    state.value = result.status
    emit('resolved', { decision: result.status, tool: result.tool })
  } catch (error) {
    const apiError = error instanceof ApiError ? error : ApiError.from(error)
    if (apiError.status === 409) {
      // 票据一次性使用：重放/已处理
      state.value = 'conflict'
    } else if (apiError.status === 410) {
      state.value = 'expired'
    } else {
      state.value = 'failed'
      errorMessage.value = apiError.detail
    }
  }
}
</script>

<template>
  <a-card class="confirm-card" size="small">
    <div class="confirm-header">
      <span class="confirm-title">{{ t('agentChat.confirmTitle') }}</span>
      <a-tag :color="riskColor">{{ payload.riskLevel }}</a-tag>
      <span v-if="state === 'pending'" class="confirm-countdown">
        {{ t('agentChat.confirmExpires', { seconds: remainSeconds }) }}
      </span>
    </div>
    <a-descriptions :column="1" size="small" bordered>
      <a-descriptions-item :label="t('agentChat.confirmTool')">{{ payload.tool }}</a-descriptions-item>
      <a-descriptions-item v-if="payload.summary.code" :label="t('agentChat.confirmCode')">
        {{ payload.summary.code }}
      </a-descriptions-item>
      <a-descriptions-item v-if="payload.summary.plan" :label="t('agentChat.confirmPlan')">
        {{ payload.summary.plan }}
      </a-descriptions-item>
      <a-descriptions-item v-if="payload.summary.impact" :label="t('agentChat.confirmImpact')">
        {{ payload.summary.impact }}
      </a-descriptions-item>
      <a-descriptions-item :label="t('agentChat.confirmArguments')">
        <pre class="confirm-args">{{ payload.argumentsSummary }}</pre>
      </a-descriptions-item>
    </a-descriptions>

    <div v-if="state === 'pending' || state === 'submitting'" class="confirm-actions">
      <a-button
        type="primary"
        danger
        :loading="state === 'submitting'"
        :disabled="!actionable"
        @click="decide('approve')"
      >
        {{ t('agentChat.approve') }}
      </a-button>
      <a-button :disabled="!actionable" @click="decide('reject')">{{ t('agentChat.reject') }}</a-button>
    </div>
    <a-alert
      v-else-if="state === 'executed'"
      type="success"
      :message="t('agentChat.executed')"
      show-icon
      class="confirm-result"
    />
    <a-alert
      v-else-if="state === 'rejected'"
      type="info"
      :message="t('agentChat.rejected')"
      show-icon
      class="confirm-result"
    />
    <a-alert
      v-else-if="state === 'conflict'"
      type="warning"
      :message="t('agentChat.conflict')"
      show-icon
      class="confirm-result"
    />
    <a-alert
      v-else-if="state === 'expired'"
      type="warning"
      :message="t('agentChat.expired')"
      show-icon
      class="confirm-result"
    />
    <a-alert
      v-else
      type="error"
      :message="t('agentChat.confirmFailed')"
      :description="errorMessage"
      show-icon
      class="confirm-result"
    />
  </a-card>
</template>

<style scoped>
.confirm-card {
  margin: 8px 0;
  border-color: #faad14;
}

.confirm-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.confirm-title {
  font-weight: 600;
}

.confirm-countdown {
  color: rgba(0, 0, 0, 0.45);
  margin-left: auto;
}

.confirm-args {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.confirm-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.confirm-result {
  margin-top: 12px;
}
</style>
