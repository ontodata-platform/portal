<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

defineProps<{
  payload: { pendingApprovals: number; runningTasks: number; openRequirements: number; unread: number }
}>()
const { t } = useI18n()
const router = useRouter()
</script>

<template>
  <a-card size="small">
    <a-space wrap>
      <a-button type="link" @click="router.push('/personal/approvals')">
        {{ t('assistant.card.pendingApprovals', { n: payload.pendingApprovals }) }}
      </a-button>
      <a-button type="link" @click="router.push('/personal/tasks')">
        {{ t('assistant.card.runningTasks', { n: payload.runningTasks }) }}
      </a-button>
      <a-button type="link" @click="router.push('/personal/requirements')">
        {{ t('assistant.card.openRequirements', { n: payload.openRequirements }) }}
      </a-button>
      <a-button type="link" @click="router.push('/personal/notifications')">
        {{ t('assistant.card.unread', { n: payload.unread }) }}
      </a-button>
    </a-space>
  </a-card>
</template>
