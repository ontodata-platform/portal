<script setup lang="ts">
/**
 * 问答记录（C5-3）：展示智能服务会话历史（localStorage 持久），
 * 会话可展开只读回看；新对话在智能服务页开启。
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAssistantEngine } from '@/composables/useAssistantEngine'
import EmptyState from '@/ui-kit/EmptyState.vue'
import { formatDate } from '@/ui-kit/format'

const { t } = useI18n()
const { sessions } = useAssistantEngine()

const expandedId = ref('')

function toggle(id: string): void {
  expandedId.value = expandedId.value === id ? '' : id
}

/** 会话摘要：首条用户消息作为标题补充。 */
function preview(messages: Array<{ id: string; role: string; text?: string }>): string {
  const firstUser = messages.find((message) => message.role === 'user')
  return firstUser?.text?.slice(0, 60) ?? ''
}

function visibleMessages(messages: Array<{ id: string; role: string; text?: string }>) {
  return messages.filter((message) => message.role !== 'system' && message.text)
}
</script>

<template>
  <div class="qa-history">
    <a-card :bordered="false" class="qa-card">
      <EmptyState
        v-if="sessions.length === 0"
        :title="t('personal.qaTab.emptyTitle')"
        :description="t('personal.qaTab.emptyDesc')"
      />
      <ul v-else class="qa-list">
        <li v-for="session in sessions" :key="session.id" class="qa-item">
          <button type="button" class="qa-head" @click="toggle(session.id)">
            <span class="qa-title">{{ session.title || preview(session.messages) || t('personal.qaTab.untitled') }}</span>
            <span class="qa-meta">
              {{ session.messages.length }} {{ t('personal.qaTab.messagesUnit') }} ·
              {{ formatDate(new Date(session.updatedAt).toISOString()) }}
            </span>
          </button>
          <div v-if="expandedId === session.id" class="qa-messages">
            <div
              v-for="message in visibleMessages(session.messages)"
              :key="message.id"
              class="qa-message"
              :class="`qa-message--${message.role}`"
            >
              {{ message.text }}
            </div>
          </div>
        </li>
      </ul>
    </a-card>
  </div>
</template>

<style scoped>
.qa-card {
  border-radius: 12px;
}

.qa-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.qa-item {
  border-bottom: 1px dashed var(--od-gray-200, #e2e8f0);
}

.qa-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 2px;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.qa-title {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qa-meta {
  font-size: 11px;
  color: var(--od-gray-500, #64748b);
}

.qa-messages {
  padding: 8px 2px 12px;
  display: grid;
  gap: 8px;
}

.qa-message {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.6;
  background: var(--od-gray-50, #f8fafc);
  white-space: pre-wrap;
}

.qa-message--assistant {
  background: #eff6ff;
}
</style>
