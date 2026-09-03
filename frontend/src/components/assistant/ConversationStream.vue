<script setup lang="ts">
import { useRouter } from 'vue-router'

import type { AssistantMessage } from '@/types/assistant'
import MessageCardGroup from './MessageCardGroup.vue'

defineProps<{ messages: AssistantMessage[] }>()
const router = useRouter()
</script>

<template>
  <div class="stream">
    <div v-for="item in messages" :key="item.id" class="row" :class="item.role">
      <div class="bubble">
        <p v-if="item.text" class="text">{{ item.text }}<span v-if="item.streaming" class="cursor">▍</span></p>
        <MessageCardGroup v-if="item.cards?.length" :cards="item.cards" />
        <div v-if="item.citations?.length" class="citations">
          <span v-for="cite in item.citations" :key="cite.source" class="cite">
            {{ cite.source }}{{ cite.version ? ` · ${cite.version}` : '' }}
          </span>
        </div>
        <div v-if="item.actions?.length" class="actions">
          <button
            v-for="action in item.actions"
            :key="action.target"
            type="button"
            class="action"
            @click="action.kind === 'navigate' && router.push(action.target)"
          >
            {{ action.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stream {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: min(780px, 100%);
  margin: 0 auto;
  padding: 12px 0 28px;
}

.row {
  display: flex;
}

.row.user {
  justify-content: flex-end;
}

.row.assistant,
.row.system {
  justify-content: flex-start;
}

.bubble {
  max-width: min(680px, 92%);
}

.row.user .bubble {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border: 1px solid #bfdbfe;
  border-radius: 18px 18px 4px 18px;
  padding: 12px 18px;
  box-shadow: var(--od-shadow-xs);
}

.row.assistant .bubble,
.row.system .bubble {
  background: transparent;
  padding: 2px 0;
}

.text {
  margin: 0;
  font-size: 15px;
  line-height: 1.75;
  color: var(--od-gray-900, #0f172a);
  white-space: pre-wrap;
}

.cursor {
  color: var(--od-color-accent, #2563eb);
  margin-left: 2px;
  animation: blink 0.9s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.citations {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.cite {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 999px;
  background: #ffffff;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  color: var(--od-gray-600, #475569);
  font-size: 12px;
  box-shadow: var(--od-shadow-xs);
}

.cite::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--od-color-accent, #2563eb);
  margin-right: 6px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.action {
  border: 1px solid var(--od-gray-200, #e2e8f0);
  background: #ffffff;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--od-color-primary, #1e40af);
  cursor: pointer;
  box-shadow: var(--od-shadow-xs);
  transition: all 0.15s ease;
}

.action:hover {
  background: var(--od-primary-50, #eff6ff);
  border-color: var(--od-primary-300, #93c5fd);
  transform: translateY(-1px);
}
</style>
