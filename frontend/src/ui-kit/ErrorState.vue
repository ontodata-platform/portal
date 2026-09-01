<script setup lang="ts">
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
    <strong>{{ title || '未能完成这次操作' }}</strong>
    <p>{{ reason }}</p>
    <p class="od-error__next">下一步：{{ nextStep }}</p>
    <p v-if="traceId" class="od-error__trace">traceId {{ traceId }}</p>
    <button v-if="actionLabel" type="button" class="od-error__action" @click="$emit('retry')">
      {{ actionLabel }}
    </button>
  </div>
</template>

<style scoped>
.od-error {
  border: 1px solid color-mix(in srgb, var(--od-color-blocked) 28%, var(--od-color-line));
  border-radius: 8px;
  padding: var(--od-space-2);
  background: color-mix(in srgb, var(--od-color-blocked) 6%, white);
  color: var(--od-color-ink);
}

.od-error p {
  margin: var(--od-space-1) 0 0;
  color: var(--od-color-ink-soft);
  line-height: 1.55;
}

.od-error__next {
  font-weight: 600;
}

.od-error__trace {
  font-family: var(--od-font-mono);
  font-size: 12px;
  color: var(--od-color-muted);
}

.od-error__action {
  margin-top: var(--od-space-2);
  border: 1px solid var(--od-color-blocked);
  border-radius: 6px;
  padding: 6px 12px;
  background: #fff;
  color: var(--od-color-blocked);
  font: inherit;
  cursor: pointer;
}

.od-error__action:focus-visible {
  outline: none;
  box-shadow: var(--od-focus-ring);
}
</style>
