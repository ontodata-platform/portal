<script setup lang="ts">
import type { IntentSuggestion } from '@/types/assistant'

defineProps<{ intents: IntentSuggestion[] }>()
const emit = defineEmits<{ pick: [intent: IntentSuggestion] }>()
</script>

<template>
  <div class="intent-chips">
    <button
      v-for="intent in intents"
      :key="intent.id"
      type="button"
      class="chip"
      @click="emit('pick', intent)"
    >
      <span class="chip-dot"></span>
      <span>{{ intent.title }}</span>
    </button>
  </div>
</template>

<style scoped>
.intent-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  max-width: 720px;
  margin: 0 auto;
}

.chip {
  border: 1px solid var(--od-gray-200, #e2e8f0);
  background: #ffffff;
  color: var(--od-gray-700, #334155);
  border-radius: 999px;
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: var(--od-shadow-xs);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all 0.15s ease;
}

.chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--od-color-accent, #2563eb);
}

.chip:hover {
  border-color: var(--od-primary-300, #93c5fd);
  color: var(--od-color-primary, #1e40af);
  background: var(--od-primary-50, #eff6ff);
  transform: translateY(-1px);
  box-shadow: var(--od-shadow-1);
}
</style>
