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
  gap: 22px;
  width: min(760px, 100%);
  margin: 0 auto;
  padding: 8px 0 24px;
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
  background: var(--od-primary-50, #eef4fa);
  border-radius: 18px 18px 6px 18px;
  padding: 12px 16px;
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
  color: var(--od-gray-800, #1e293b);
  white-space: pre-wrap;
}

.cursor {
  color: var(--od-primary-500, #1f4e79);
  margin-left: 2px;
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
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--od-gray-100, #f8fafc);
  border: 1px solid var(--od-gray-200, #e2e8f0);
  color: var(--od-gray-600, #475569);
  font-size: 12px;
}

.cite::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--od-primary-400, #4d7aa8);
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
  background: #fff;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 13px;
  color: var(--od-primary-600, #1b446a);
  cursor: pointer;
}

.action:hover {
  background: var(--od-primary-50, #eef4fa);
}
</style>
