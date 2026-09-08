<script setup lang="ts">
import { useRouter } from 'vue-router'

import { 中文展示 } from '@/ui-kit/展示文本'

const props = defineProps<{
  payload: { code: string; name: string; kind: 'capability' | 'template'; version: string; status: string }
}>()
defineEmits<{ action: [kind: string] }>()
const router = useRouter()

function open() {
  if (props.payload.kind === 'template') {
    void router.push(`/workbench/templates/${props.payload.code}`)
    return
  }
  void router.push('/workbench')
}
</script>

<template>
  <a-card size="small" class="card" @click="open">
    <div class="name">{{ payload.name }}</div>
    <div class="meta">{{ 中文展示(payload.kind) }} · {{ payload.version }} · {{ 中文展示(payload.status) }}</div>
  </a-card>
</template>

<style scoped>
.card { cursor: pointer; }
.name { font-weight: 600; }
.meta { color: #64748b; font-size: 12px; margin-top: 4px; }
</style>
