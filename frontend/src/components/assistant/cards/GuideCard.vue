<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const props = defineProps<{ payload: { title: string; steps: string[]; target: string } }>()
const { t } = useI18n()
const router = useRouter()
</script>

<template>
  <a-card size="small" :title="payload.title">
    <ol>
      <li v-for="step in payload.steps" :key="step">{{ step }}</li>
    </ol>
    <a-button type="primary" @click="router.push(payload.target)">{{ t('assistant.card.goHandle') }}</a-button>
  </a-card>
</template>
