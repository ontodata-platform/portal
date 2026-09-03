<script setup lang="ts">
import { WarningOutlined } from '@ant-design/icons-vue'

defineProps<{
  title?: string
  reason: string
  nextStep: string
  traceId?: string
  actionLabel?: string
}>()

defineEmits<{
  retry: []
}>()
</script>

<template>
  <div class="od-error" role="alert">
    <div class="od-error__header">
      <WarningOutlined class="od-error__icon" />
      <strong class="od-error__title">{{ title || '未能完成这次操作' }}</strong>
    </div>
    <p class="od-error__reason">{{ reason }}</p>
    <p class="od-error__next">
      <span class="next-label">下一步建议：</span>{{ nextStep }}
    </p>
    <p v-if="traceId" class="od-error__trace">追踪日志 traceId: {{ traceId }}</p>
    <button v-if="actionLabel" type="button" class="od-error__action" @click="$emit('retry')">
      {{ actionLabel }}
    </button>
  </div>
</template>

<style scoped>
.od-error {
  border: 1px solid rgba(220, 38, 38, 0.25);
  border-radius: var(--od-radius-card, 12px);
  padding: 16px 20px;
  background: #fff8f8;
  color: var(--od-color-ink, #0f172a);
  box-shadow: var(--od-shadow-xs);
  margin-bottom: 16px;
}

.od-error__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.od-error__icon {
  color: var(--od-color-blocked, #dc2626);
  font-size: 16px;
}

.od-error__title {
  font-size: 14px;
  color: var(--od-color-blocked, #dc2626);
  font-weight: 600;
}

.od-error__reason {
  margin: 8px 0 4px;
  color: var(--od-color-ink-soft, #334155);
  font-size: 13px;
  line-height: 1.6;
}

.od-error__next {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--od-color-ink, #0f172a);
}

.next-label {
  font-weight: 600;
  color: var(--od-color-ink-soft, #334155);
}

.od-error__trace {
  font-family: var(--od-font-mono, monospace);
  font-size: 12px;
  color: var(--od-color-muted, #64748b);
  margin: 6px 0 0;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.03);
  display: inline-block;
  border-radius: 4px;
}

.od-error__action {
  margin-top: 12px;
  border: 1px solid var(--od-color-blocked, #dc2626);
  border-radius: var(--od-radius-ctl, 8px);
  padding: 6px 14px;
  background: #fff;
  color: var(--od-color-blocked, #dc2626);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.od-error__action:hover {
  background: var(--od-color-blocked, #dc2626);
  color: #fff;
}

.od-error__action:focus-visible {
  outline: none;
  box-shadow: var(--od-focus-ring);
}
</style>
