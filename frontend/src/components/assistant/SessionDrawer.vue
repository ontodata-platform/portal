<script setup lang="ts">
import { DeleteOutlined, MessageOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AssistantSession } from '@/types/assistant'

const props = defineProps<{ sessions: AssistantSession[]; modelValue: string }>()
const emit = defineEmits<{
  'update:modelValue': [id: string]
  delete: [id: string]
  rename: [id: string, title: string]
  create: []
}>()
const { t } = useI18n()

const current = computed({
  get: () => props.modelValue,
  set: (id: string) => emit('update:modelValue', id),
})
</script>

<template>
  <aside class="drawer">
    <button type="button" class="new-btn" @click="emit('create')">
      <PlusOutlined />
      <span>{{ t('assistant.newSession') }}</span>
    </button>
    <div class="label">{{ t('assistant.sessions') }}</div>
    <div class="session-list">
      <button
        v-for="session in sessions"
        :key="session.id"
        type="button"
        class="item"
        :class="{ active: session.id === current }"
        @click="current = session.id"
      >
        <MessageOutlined class="item-icon" />
        <span class="title">{{ session.title }}</span>
        <span
          class="delete-btn"
          role="button"
          tabindex="0"
          title="删除会话"
          @click.stop="emit('delete', session.id)"
          @keydown.enter.stop="emit('delete', session.id)"
        >
          <DeleteOutlined />
        </span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.drawer {
  width: 260px;
  height: 100%;
  padding: 16px 12px;
  background: #f8fafc;
  border-right: 1px solid var(--od-gray-200, #e2e8f0);
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
}

.new-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  border: 1px solid var(--od-primary-300, #93c5fd);
  background: #ffffff;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  color: var(--od-color-primary, #1e40af);
  margin-bottom: 8px;
  box-shadow: var(--od-shadow-xs);
  transition: all 0.15s ease;
}

.new-btn:hover {
  background: var(--od-primary-50, #eff6ff);
  border-color: var(--od-color-accent, #2563eb);
}

.label {
  font-size: 11px;
  font-weight: 600;
  color: var(--od-gray-500, #64748b);
  padding: 4px 8px 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  flex: 1;
}

.item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  border-radius: 8px;
  text-align: left;
  transition: all 0.15s ease;
}

.item-icon {
  font-size: 13px;
  color: var(--od-gray-400, #94a3b8);
  flex-shrink: 0;
}

.item:hover {
  background: #ffffff;
  border-color: var(--od-gray-200, #e2e8f0);
}

.item.active {
  background: #ffffff;
  border-color: var(--od-primary-200, #bfdbfe);
  box-shadow: var(--od-shadow-xs);
}

.item.active .item-icon {
  color: var(--od-color-accent, #2563eb);
}

.title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--od-gray-700, #334155);
}

.item.active .title {
  font-weight: 600;
  color: var(--od-gray-900, #0f172a);
}

.delete-btn {
  font-size: 13px;
  color: var(--od-gray-400, #94a3b8);
  opacity: 0;
  padding: 2px;
  border-radius: 4px;
}

.item:hover .delete-btn,
.item.active .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  color: #dc2626;
  background: #fee2e2;
}
</style>
