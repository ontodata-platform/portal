<script setup lang="ts">
import { PlusOutlined } from '@ant-design/icons-vue'
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
      {{ t('assistant.newSession') }}
    </button>
    <div class="label">{{ t('assistant.sessions') }}</div>
    <button
      v-for="session in sessions"
      :key="session.id"
      type="button"
      class="item"
      :class="{ active: session.id === current }"
      @click="current = session.id"
    >
      <span class="title">{{ session.title }}</span>
      <span
        class="delete"
        role="button"
        tabindex="0"
        @click.stop="emit('delete', session.id)"
        @keydown.enter.stop="emit('delete', session.id)"
      >
        {{ t('assistant.deleteSession') }}
      </span>
    </button>
  </aside>
</template>

<style scoped>
.drawer {
  width: 260px;
  height: 100%;
  padding: 16px 12px;
  background: #fafbfc;
  border-right: 1px solid var(--od-gray-200, #e2e8f0);
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
}

.new-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  background: #fff;
  border-radius: 999px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 500;
  color: var(--od-gray-800, #1e293b);
  margin-bottom: 8px;
}

.new-btn:hover {
  border-color: var(--od-primary-300, #7a9fc4);
  color: var(--od-primary-600, #1b446a);
}

.label {
  font-size: 12px;
  color: var(--od-gray-400, #94a3b8);
  padding: 4px 8px 8px;
}

.item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border: 0;
  background: transparent;
  cursor: pointer;
  border-radius: 12px;
  text-align: left;
}

.item:hover {
  background: #fff;
}

.item.active {
  background: #fff;
  box-shadow: var(--od-shadow-1, 0 1px 2px rgb(15 23 42 / 6%));
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

.delete {
  font-size: 12px;
  color: var(--od-gray-400, #94a3b8);
  opacity: 0;
}

.item:hover .delete,
.item.active .delete {
  opacity: 1;
}

.delete:hover {
  color: #c53030;
}
</style>
