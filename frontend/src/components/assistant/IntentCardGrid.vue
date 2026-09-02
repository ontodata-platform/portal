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
      {{ intent.title }}
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
  background: #fff;
  color: var(--od-gray-700, #334155);
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.chip:hover {
  border-color: var(--od-primary-300, #7a9fc4);
  color: var(--od-primary-600, #1b446a);
  background: var(--od-primary-50, #eef4fa);
}
</style>
