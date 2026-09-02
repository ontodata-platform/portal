<script setup lang="ts">
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
    <div class="head">
      <strong>{{ t('assistant.sessions') }}</strong>
      <a-button size="small" type="link" @click="emit('create')">{{ t('assistant.newSession') }}</a-button>
    </div>
    <button
      v-for="session in sessions"
      :key="session.id"
      type="button"
      class="item"
      :class="{ active: session.id === current }"
      @click="current = session.id"
    >
      <span>{{ session.title }}</span>
      <a-button size="small" type="text" danger @click.stop="emit('delete', session.id)">
        {{ t('assistant.deleteSession') }}
      </a-button>
    </button>
  </aside>
</template>

<style scoped>
.drawer {
  width: 240px;
  border-right: 1px solid #e8eef4;
  padding-right: 12px;
}
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.item {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  border: 0;
  background: transparent;
  cursor: pointer;
  border-radius: 8px;
}
.item.active { background: #eef4fa; }
@media (max-width: 1279px) {
  .drawer { width: 100%; border-right: 0; }
}
</style>
