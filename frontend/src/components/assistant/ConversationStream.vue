<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import type { AssistantMessage } from '@/types/assistant'
import MessageCardGroup from './MessageCardGroup.vue'

defineProps<{ messages: AssistantMessage[] }>()
const { t } = useI18n()
const router = useRouter()
</script>

<template>
  <div class="stream">
    <div v-for="item in messages" :key="item.id" class="row" :class="item.role">
      <div class="bubble">
        <p>{{ item.text }}<span v-if="item.streaming" class="cursor">▍</span></p>
        <MessageCardGroup v-if="item.cards?.length" :cards="item.cards" />
        <div v-if="item.citations?.length" class="citations">
          {{ t('assistant.citations') }}：
          <span v-for="cite in item.citations" :key="cite.source">{{ cite.source }}</span>
        </div>
        <div v-if="item.actions?.length" class="actions">
          <a-button
            v-for="action in item.actions"
            :key="action.target"
            size="small"
            type="link"
            @click="action.kind === 'navigate' && router.push(action.target)"
          >
            {{ action.label }}
          </a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stream { display: flex; flex-direction: column; gap: 12px; }
.row { display: flex; }
.row.user { justify-content: flex-end; }
.bubble {
  max-width: 720px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e8eef4;
}
.row.user .bubble { background: #eef4fa; }
.cursor { color: #1f4e79; }
.citations, .actions { margin-top: 8px; font-size: 12px; color: #64748b; }
</style>
