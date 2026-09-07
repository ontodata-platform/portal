<script setup lang="ts">
import { computed } from 'vue'
import { InboxOutlined, SearchOutlined, LockOutlined, CloudServerOutlined, DatabaseOutlined } from '@ant-design/icons-vue'

const props = defineProps<{
  title: string
  description?: string
  actionLabel?: string
  /** 空态场景：决定插画图标（UX-1 §10.1） */
  kind?: 'search' | 'list' | 'lock' | 'cloud' | 'data' | 'generic'
}>()

defineEmits<{
  action: []
}>()

const icon = computed(() => {
  switch (props.kind) {
    case 'search': return SearchOutlined
    case 'lock': return LockOutlined
    case 'cloud': return CloudServerOutlined
    case 'data': return DatabaseOutlined
    case 'list': return InboxOutlined
    default: return InboxOutlined
  }
})
</script>

<template>
  <div class="od-empty" role="status">
    <div class="od-empty__icon-wrap" :data-kind="kind ?? 'generic'">
      <component :is="icon" class="od-empty__icon" />
    </div>
    <h2>{{ title }}</h2>
    <p v-if="description">{{ description }}</p>
    <button v-if="actionLabel" type="button" class="od-empty__action" @click="$emit('action')">
      {{ actionLabel }}
    </button>
  </div>
</template>

<style scoped>
.od-empty {
  padding: var(--od-space-4, 32px) var(--od-space-2, 16px);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.od-empty__icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--od-primary-50, #eff6ff);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--od-space-2, 16px);
}

.od-empty__icon {
  font-size: 24px;
  color: var(--od-color-accent, #2563eb);
}

.od-empty h2 {
  margin: 0;
  color: var(--od-color-ink, #0f172a);
  font-size: var(--od-title-section, 17px);
  font-weight: 600;
}

.od-empty p {
  margin: 6px auto 0;
  max-width: 28rem;
  color: var(--od-color-muted, #64748b);
  font-size: 13px;
  line-height: 1.6;
}

.od-empty__action {
  margin-top: var(--od-space-25, 20px);
  border: 0;
  border-radius: var(--od-radius-ctl, 8px);
  padding: 8px 18px;
  background: var(--od-color-primary, #1e40af);
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: var(--od-shadow-xs);
  transition: background 0.15s ease, transform 0.15s ease;
}

.od-empty__action:hover {
  background: var(--od-color-accent, #2563eb);
  transform: translateY(-1px);
}

.od-empty__action:focus-visible {
  outline: none;
  box-shadow: var(--od-focus-ring);
}
</style>
