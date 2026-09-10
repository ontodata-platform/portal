<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { 中文展示 } from '@/ui-kit/展示文本'

const props = defineProps<{
  payload: { code: string; name: string; kind: 'capability' | 'template'; version: string; status: string }
}>()
defineEmits<{ action: [kind: string] }>()
const router = useRouter()
const { t } = useI18n()

function open() {
  if (props.payload.kind === 'template') {
    void router.push(`/algorithm-workbench/${props.payload.code}/run`)
    return
  }
  void router.push('/algorithm-workbench')
}

// C5-1：直达运行向导
function run() {
  void router.push(`/algorithm-workbench/${props.payload.code}/run`)
}
</script>

<template>
  <a-card size="small" class="card" @click="open">
    <div class="name">{{ payload.name }}</div>
    <div class="meta"><span class="cell-mono">{{ payload.code }}</span> · {{ 中文展示(payload.kind) }} · {{ payload.version }} · {{ 中文展示(payload.status) }}</div>
    <a-button size="small" type="link" @click.stop="run">
      {{ t('assistant.card.run') }}
    </a-button>
  </a-card>
</template>

<style scoped>
.card { cursor: pointer; }
.name { font-weight: 600; }
.meta { color: #64748b; font-size: 12px; margin-top: 4px; }
</style>
