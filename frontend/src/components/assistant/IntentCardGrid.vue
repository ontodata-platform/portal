<script setup lang="ts">
import type { IntentSuggestion } from '@/types/assistant'

defineProps<{ intents: IntentSuggestion[] }>()
const emit = defineEmits<{ pick: [intent: IntentSuggestion] }>()
</script>

<template>
  <div class="intent-grid">
    <button
      v-for="intent in intents"
      :key="intent.id"
      type="button"
      class="intent-card"
      @click="emit('pick', intent)"
    >
      <strong>{{ intent.title }}</strong>
      <span>{{ intent.example }}</span>
    </button>
  </div>
</template>

<style scoped>
.intent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.intent-card {
  text-align: left;
  padding: 14px;
  border: 1px solid #e8eef4;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
}

.intent-card span {
  display: block;
  margin-top: 6px;
  color: #64748b;
  font-size: 13px;
}
</style>
