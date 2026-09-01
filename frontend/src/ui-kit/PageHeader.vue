<script setup lang="ts">
defineProps<{
  eyebrow?: string
  title: string
  titleId?: string
  description?: string
  status?: 'success' | 'running' | 'warning' | 'blocked' | 'archived'
  statusLabel?: string
}>()
</script>

<template>
  <header class="od-page-header">
    <div class="od-page-header__text">
      <p v-if="eyebrow" class="od-page-header__eyebrow">{{ eyebrow }}</p>
      <div class="od-page-header__title-row">
        <h1 :id="titleId">{{ title }}</h1>
        <span v-if="status && statusLabel" class="od-status" :data-status="status">{{ statusLabel }}</span>
      </div>
      <p v-if="description" class="od-page-header__desc">{{ description }}</p>
    </div>
    <div v-if="$slots.extra" class="od-page-header__extra">
      <slot name="extra" />
    </div>
  </header>
</template>

<style scoped>
.od-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--od-space-3);
  margin-bottom: var(--od-space-3);
}

.od-page-header__eyebrow {
  margin: 0 0 var(--od-space-1);
  color: var(--od-color-teal);
  font-family: var(--od-font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.od-page-header__title-row {
  display: flex;
  align-items: center;
  gap: var(--od-space-2);
  flex-wrap: wrap;
}

.od-page-header h1 {
  margin: 0;
  color: var(--od-color-ink);
  font-size: var(--od-title-page);
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.od-page-header__desc {
  max-width: 42rem;
  margin: var(--od-space-1) 0 0;
  color: var(--od-color-muted);
  line-height: 1.6;
}

.od-status {
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 600;
}

.od-status[data-status='success'] {
  color: var(--od-color-success);
  background: color-mix(in srgb, var(--od-color-success) 12%, white);
}

.od-status[data-status='running'] {
  color: var(--od-color-running);
  background: color-mix(in srgb, var(--od-color-running) 12%, white);
}

.od-status[data-status='warning'] {
  color: var(--od-color-warning);
  background: color-mix(in srgb, var(--od-color-warning) 14%, white);
}

.od-status[data-status='blocked'] {
  color: var(--od-color-blocked);
  background: color-mix(in srgb, var(--od-color-blocked) 12%, white);
}

.od-status[data-status='archived'] {
  color: var(--od-color-archived);
  background: color-mix(in srgb, var(--od-color-archived) 12%, white);
}

@media (max-width: 700px) {
  .od-page-header {
    flex-direction: column;
  }
}
</style>
