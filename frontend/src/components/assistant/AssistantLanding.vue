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
      <div class="mark-wrap">
        <span class="mark" aria-hidden="true"><RobotOutlined /></span>
      </div>
      <h1 class="landing-title">{{ t('assistant.landingTitle') }}</h1>
      <p class="hint">{{ t('assistant.landingHint') }}</p>
    </div>
    <AssistantComposer
      v-model="draft"
      variant="hero"
      autofocus
      @submit="submit"
    />
    <div class="chips-container">
      <div class="chips-label">🎯 推荐快捷探索意图</div>
      <IntentCardGrid class="chips" :intents="intents" @pick="emit('pick', $event)" />
    </div>
  </div>
</template>

<style scoped>
.landing {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: min(70vh, 640px);
  padding: 32px 24px 48px;
  text-align: center;
}

.brand {
  margin-bottom: 32px;
}

.mark-wrap {
  display: inline-flex;
  margin-bottom: 16px;
  position: relative;
}

.mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: #fff;
  font-size: 26px;
  box-shadow: 0 8px 24px rgba(37, 99, 235, 0.35);
}

.landing-title {
  margin: 0;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--od-gray-900, #0f172a);
}

.hint {
  margin: 10px 0 0;
  color: var(--od-gray-500, #64748b);
  font-size: 14px;
  max-width: 480px;
}

.chips-container {
  margin-top: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.chips-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--od-gray-500, #64748b);
}

:deep(.composer.hero) {
  width: min(860px, 100%);
}
</style>
