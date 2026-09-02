<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import PageHeader from '@/ui-kit/PageHeader.vue'

const { t } = useI18n()
const route = useRoute()
const preset = typeof route.query.q === 'string' ? route.query.q : ''
</script>

<template>
  <div class="assistant-stub">
    <PageHeader :eyebrow="t('menu.assistant')" :title="t('assistant.landingTitle')" :description="t('assistant.landingHint')" />
    <a-card>
      <p v-if="preset">{{ t('assistant.presetQuery', { q: preset }) }}</p>
      <p v-else>{{ t('assistant.landingHint') }}</p>
    </a-card>
  </div>
</template>
