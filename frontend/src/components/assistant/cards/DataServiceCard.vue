<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const props = defineProps<{
  payload: {
    code: string
    name: string
    version: string
    classification: string
    source: string
    subscribed: boolean
  }
}>()
const emit = defineEmits<{ action: [kind: string] }>()
const { t } = useI18n()
const router = useRouter()

function open() {
  emit('action', 'navigate')
  void router.push(`/marketplace/${props.payload.code}`)
}
</script>

<template>
  <a-card size="small" class="card" @click="open">
    <div class="name">{{ payload.name }}</div>
    <div class="meta">{{ payload.code }} · {{ payload.version }} · {{ payload.classification }}</div>
    <a-tag :color="payload.subscribed ? 'green' : 'default'">
      {{ payload.subscribed ? t('assistant.card.subscribed') : t('assistant.card.unsubscribed') }}
    </a-tag>
  </a-card>
</template>

<style scoped>
.card { cursor: pointer; }
.name { font-weight: 600; }
.meta { color: #64748b; font-size: 12px; margin: 4px 0 8px; }
</style>
