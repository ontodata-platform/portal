<script setup lang="ts">
defineProps<{
  taskId?: string
  phase: string
  status: 'queued' | 'running' | 'blocked' | 'succeeded' | 'failed'
  message: string
  progress?: number
}>()
</script>

<template>
  <section class="od-task" :data-status="status" aria-live="polite">
    <div class="od-task__bar"></div>
    <div class="od-task__body">
      <div class="od-task__meta">
        <strong>{{ phase }}</strong>
        <span v-if="taskId" class="od-task__id">{{ taskId }}</span>
        <span v-if="progress != null" class="od-task__progress">{{ progress }}%</span>
      </div>
      <p>{{ message }}</p>
      <div v-if="$slots.actions" class="od-task__actions">
        <slot name="actions"></slot>
      </div>
    </div>
  </section>
</template>

<style scoped>
.od-task {
  display: flex;
  gap: var(--od-space-2);
  margin-bottom: var(--od-space-2);
  border: 1px solid var(--od-color-line);
  border-radius: 8px;
  background: var(--od-color-panel);
  overflow: hidden;
}

.od-task__bar {
  width: 6px;
  background: var(--od-color-archived);
}

.od-task[data-status='queued'] .od-task__bar,
.od-task[data-status='running'] .od-task__bar {
  background: var(--od-color-running);
}

.od-task[data-status='blocked'] .od-task__bar,
.od-task[data-status='failed'] .od-task__bar {
  background: var(--od-color-blocked);
}

.od-task[data-status='succeeded'] .od-task__bar {
  background: var(--od-color-success);
}

.od-task__body {
  flex: 1;
  padding: var(--od-space-2) var(--od-space-2) var(--od-space-2) 0;
}

.od-task__meta {
  display: flex;
  align-items: center;
  gap: var(--od-space-2);
  flex-wrap: wrap;
  color: var(--od-color-ink);
}

.od-task__id,
.od-task__progress {
  font-family: var(--od-font-mono);
  font-size: 12px;
  color: var(--od-color-muted);
}

.od-task p {
  margin: 6px 0 0;
  color: var(--od-color-ink-soft);
  line-height: 1.55;
}
</style>
