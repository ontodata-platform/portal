<script setup lang="ts">
import { LeftOutlined } from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'

const props = defineProps<{
  eyebrow?: string
  title: string
  titleId?: string
  /** v5 已全局移除描述行；属性保留仅为兼容，渲染层不再输出 */
  description?: string
  status?: 'success' | 'running' | 'warning' | 'blocked' | 'archived'
  statusLabel?: string
  /** v2 新增：详情页统一返回路径（渲染左缘返回箭头） */
  backTo?: string
  /** v2 新增：面包屑父级（显示于 eyebrow 之上） */
  parents?: string[]
}>()

const router = useRouter()

function goBack() {
  if (props.backTo && router) {
    void router.push(props.backTo)
    return
  }
  if (window.history.length > 1) router.back()
}
</script>

<template>
  <header class="od-page-header">
    <button v-if="backTo" class="od-page-header__back" :aria-label="'返回'" @click="goBack">
      <LeftOutlined />
    </button>
    <div class="od-page-header__text">
      <a-breadcrumb v-if="parents && parents.length" class="od-page-header__crumbs">
        <a-breadcrumb-item v-for="parent in parents" :key="parent">{{ parent }}</a-breadcrumb-item>
      </a-breadcrumb>
      <p v-if="eyebrow" class="od-page-header__eyebrow">
        <span class="eyebrow-dot"></span>
        {{ eyebrow }}
      </p>
      <div class="od-page-header__title-row">
        <h1 :id="titleId">{{ title }}</h1>
        <span v-if="status && statusLabel" class="od-status" :data-status="status">{{ statusLabel }}</span>
      </div>
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
  justify-content: flex-start;
  gap: var(--od-space-3);
  margin-bottom: 12px;
  padding: 0 0 4px 0;
}

.od-page-header__extra {
  margin-left: auto;
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
.od-page-header__back {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 8px;
  background: #fff;
  color: var(--od-gray-700, #334155);
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.od-page-header__back:hover {
  border-color: var(--od-primary-500, #3b82f6);
  color: var(--od-primary-500, #3b82f6);
}

.od-page-header__crumbs {
  margin-bottom: 6px;
  font-size: 12px;
}
</style>
