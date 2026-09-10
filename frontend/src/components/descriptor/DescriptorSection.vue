<script setup lang="ts">
import EmptyState from '@/ui-kit/EmptyState.vue'

defineProps<{
  title: string
  empty?: boolean
  emptyTitle?: string
}>()
</script>

<template>
  <section class="descriptor-section">
    <h3 class="section-title">{{ title }}</h3>
    <EmptyState v-if="empty" :title="emptyTitle ?? title" kind="data" />
    <slot v-else></slot>
  </section>
</template>

<style scoped>
.descriptor-section {
  padding: var(--od-space-2, 16px);
  border: 1px solid var(--od-color-line-soft, #e8eef3);
  border-radius: var(--od-radius-card, 12px);
  background: var(--od-color-panel, #fff);
}

.section-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--od-color-ink, #102a43);
}
</style>
