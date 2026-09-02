<script setup lang="ts">
import { RobotOutlined } from '@ant-design/icons-vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { IntentSuggestion } from '@/types/assistant'
import AssistantComposer from './AssistantComposer.vue'
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
    <div class="brand">
      <span class="mark" aria-hidden="true"><RobotOutlined /></span>
      <h1>{{ t('assistant.landingTitle') }}</h1>
      <p class="hint">{{ t('assistant.landingHint') }}</p>
    </div>
    <AssistantComposer
      v-model="draft"
      variant="hero"
      autofocus
      @submit="submit"
    />
    <IntentCardGrid class="chips" :intents="intents" @pick="emit('pick', $event)" />
  </div>
</template>

<style scoped>
.landing {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: min(68vh, 640px);
  padding: 32px 24px 48px;
  text-align: center;
}

.brand {
  margin-bottom: 28px;
}

.mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(145deg, var(--od-primary-500, #1f4e79), var(--od-primary-700, #163856));
  color: #fff;
  font-size: 22px;
  margin-bottom: 16px;
  box-shadow: 0 10px 24px rgb(31 78 121 / 22%);
}

h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--od-gray-900, #0f172a);
}

.hint {
  margin: 10px 0 0;
  color: var(--od-gray-500, #64748b);
  font-size: 14px;
}

.chips {
  margin-top: 22px;
}

:deep(.composer.hero) {
  width: min(720px, 100%);
}
</style>
