<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { 中文展示 } from '@/ui-kit/展示文本'

const props = defineProps<{
  payload: {
    code: string
    name: string
    version: string
    classification: string
    source: string
    subscribed: boolean
  }
}>()
const emit = defineEmits<{ action: [kind: string] }>()
const { t } = useI18n()
const router = useRouter()

function open() {
  emit('action', 'navigate')
  void router.push(`/data-workbench/${props.payload.code}`)
}

// C5-1：直达申请（带 apply 标记，详情页自动打开申请向导）
function apply() {
  emit('action', 'apply')
  void router.push({ path: `/data-workbench/${props.payload.code}`, query: { apply: '1' } })
}
</script>

<template>
  <a-card size="small" class="card" @click="open">
    <div class="name">{{ payload.name }}</div>
    <div class="meta"><span class="cell-mono">{{ payload.code }}</span> · {{ payload.version }} · {{ 中文展示(payload.classification) }}</div>
    <div class="card-foot">
      <a-tag :color="payload.subscribed ? 'green' : 'default'">
        {{ payload.subscribed ? t('assistant.card.subscribed') : t('assistant.card.unsubscribed') }}
      </a-tag>
      <a-button size="small" type="link" @click.stop="apply">
        {{ t('assistant.card.apply') }}
      </a-button>
    </div>
  </a-card>
</template>

<style scoped>
.card {
  cursor: pointer;
  border-radius: 14px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  box-shadow: none;
}
.name { font-weight: 600; }
.card-foot { display: flex; align-items: center; justify-content: space-between; }
.meta { color: var(--od-gray-500, #64748b); font-size: 12px; margin: 4px 0 8px; }
</style>
