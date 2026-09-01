<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  actionLabel?: string
}>()

defineEmits<{
  action: []
}>()
</script>

<template>
  <div class="od-empty" role="status">
    <h2>{{ title }}</h2>
    <p v-if="description">{{ description }}</p>
    <button v-if="actionLabel" type="button" class="od-empty__action" @click="$emit('action')">
      {{ actionLabel }}
    </button>
  </div>
</template>

<style scoped>
.od-empty {
  padding: var(--od-space-4) var(--od-space-2);
  text-align: center;
}

.od-empty h2 {
  margin: 0;
  color: var(--od-color-ink);
  font-size: var(--od-title-section);
}

.od-empty p {
  margin: var(--od-space-1) auto 0;
  max-width: 28rem;
  color: var(--od-color-muted);
  line-height: 1.6;
}

.od-empty__action {
  margin-top: var(--od-space-2);
  border: 0;
  border-radius: 6px;
  padding: 8px 14px;
  background: var(--od-color-primary);
  color: #fff;
  font: inherit;
  cursor: pointer;
}

.od-empty__action:focus-visible {
  outline: none;
  box-shadow: var(--od-focus-ring);
}
</style>
