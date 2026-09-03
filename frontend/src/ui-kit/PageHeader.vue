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
      <p v-if="eyebrow" class="od-page-header__eyebrow">
        <span class="eyebrow-dot"></span>
        {{ eyebrow }}
      </p>
      <div class="od-page-header__title-row">
        <h1 :id="titleId">{{ title }}</h1>
        <span v-if="status && statusLabel" class="od-status" :data-status="status">{{ statusLabel }}</span>
      </div>
      <p v-if="description" class="od-page-header__desc">{{ description }}</p>
    </div>
    <div v-if="$slots.extra" class="od-page-header__extra">
      <slot name="extra"></slot>
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
  padding: 4px 0 8px 0;
}

.od-page-header__eyebrow {
  margin: 0 0 6px;
  color: var(--od-color-accent, #2563eb);
  font-family: var(--od-font-ui);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-transform: uppercase;
}

.eyebrow-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  display: inline-block;
}

.od-page-header__title-row {
  display: flex;
  align-items: center;
  gap: var(--od-space-2);
  flex-wrap: wrap;
}

.od-page-header h1 {
  margin: 0;
  color: var(--od-color-ink, #0f172a);
  font-size: var(--od-title-page, 26px);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.3;
}

.od-page-header__desc {
  max-width: 48rem;
  margin: 6px 0 0;
  color: var(--od-color-muted, #64748b);
  font-size: 14px;
  line-height: 1.6;
}

.od-status {
  border-radius: 999px;
  padding: 3px 12px;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
}

.od-status[data-status='success'] {
  color: var(--od-color-success);
  background: var(--od-color-success-bg, #ecfdf5);
  border: 1px solid rgba(5, 150, 105, 0.2);
}

.od-status[data-status='running'] {
  color: var(--od-color-running);
  background: var(--od-color-running-bg, #eff6ff);
  border: 1px solid rgba(37, 99, 235, 0.2);
}

.od-status[data-status='warning'] {
  color: var(--od-color-warning);
  background: var(--od-color-warning-bg, #fffbeb);
  border: 1px solid rgba(217, 119, 6, 0.2);
}

.od-status[data-status='blocked'] {
  color: var(--od-color-blocked);
  background: var(--od-color-blocked-bg, #fef2f2);
  border: 1px solid rgba(220, 38, 38, 0.2);
}

.od-status[data-status='archived'] {
  color: var(--od-color-archived);
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
}

@media (max-width: 700px) {
  .od-page-header {
    flex-direction: column;
  }
}
</style>
