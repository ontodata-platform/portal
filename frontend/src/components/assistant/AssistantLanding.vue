<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { IntentSuggestion } from '@/types/assistant'
import IntentCardGrid from './IntentCardGrid.vue'

defineProps<{ intents: IntentSuggestion[] }>()
const emit = defineEmits<{ send: [text: string]; pick: [intent: IntentSuggestion] }>()
const { t } = useI18n()
const draft = ref('')

function submit() {
  const text = draft.value.trim()
  if (!text) return
  emit('send', text)
  draft.value = ''
}
</script>

<template>
  <div class="landing">
    <h1>{{ t('assistant.landingTitle') }}</h1>
    <p class="hint">{{ t('assistant.landingHint') }}</p>
    <a-textarea
      v-model:value="draft"
      :placeholder="t('assistant.inputPlaceholder')"
      :auto-size="{ minRows: 3, maxRows: 6 }"
      class="hero-input"
      @press-enter.prevent="submit"
    />
    <div class="actions">
      <a-button type="primary" @click="submit">{{ t('assistant.send') }}</a-button>
    </div>
    <IntentCardGrid :intents="intents" @pick="emit('pick', $event)" />
  </div>
</template>

<style scoped>
.landing {
  max-width: 720px;
  margin: 48px auto 0;
  text-align: center;
}

.hint {
  color: #64748b;
}

.hero-input {
  text-align: left;
  margin: 16px 0 12px;
}

.actions {
  margin-bottom: 24px;
}
</style>
