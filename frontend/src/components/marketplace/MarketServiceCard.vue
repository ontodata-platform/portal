<script setup lang="ts">
import { ArrowRightOutlined, CheckCircleOutlined, DatabaseOutlined, KeyOutlined } from '@ant-design/icons-vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import type { CatalogEntry } from '@/types/portal'

const props = defineProps<{ item: CatalogEntry }>()
const { t } = useI18n()
const router = useRouter()

const subscribed = computed(() => Boolean(props.item.subscribed))

const tone = computed(() => {
  const raw = String(props.item.classification ?? props.item.status ?? '')
  if (/SECRET|CONFIDENTIAL|机密/.test(raw)) return '#dc2626'
  if (/INTERNAL|内部/.test(raw)) return '#1e40af'
  return '#059669'
})

function open() {
  void router.push(`/data-workbench/${encodeURIComponent(props.item.code)}`)
}
</script>

<template>
  <div
    class="market-card"
    :style="{ '--classification-tone': tone }"
    role="button"
    tabindex="0"
    @click="open"
  >
    <div class="card-head">
      <div class="icon" :style="{ background: tone }">
        <DatabaseOutlined />
      </div>
      <div class="badges">
        <a-tag v-if="subscribed" color="green" class="sub-tag">
          <template #icon><CheckCircleOutlined /></template>
          {{ t('marketplace.card.subscribed') }}
        </a-tag>
        <a-tag v-else color="default" class="sub-tag">
          {{ t('marketplace.card.unsubscribed') }}
        </a-tag>
      </div>
    </div>

    <div class="name" :title="item.name">{{ item.name }}</div>
    <div class="meta">
      <span class="mono-code">{{ item.code }}</span>
      <span class="version-tag">v{{ item.currentVersion }}</span>
    </div>

    <p v-if="item.description" class="desc">{{ item.description }}</p>

    <div class="card-footer">
      <a-tag class="status-tag">{{ item.status }}</a-tag>
      <button type="button" class="quick-btn" @click.stop="open">
        <span>{{ subscribed ? t('marketplace.viewDetail') : t('marketplace.applyButton') }}</span>
        <component :is="subscribed ? ArrowRightOutlined : KeyOutlined" />
      </button>
    </div>
    <div class="card-hover-action" aria-hidden="true">
      <span>{{ t('marketplace.viewDetail') }}</span>
      <ArrowRightOutlined />
    </div>
  </div>
</template>

<style scoped>
.market-card {
  border-radius: var(--od-radius-card, 12px);
  background: #ffffff;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  box-shadow: var(--od-shadow-xs);
  padding: 16px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  overflow: hidden;
}

.market-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--classification-tone);
}

.market-card:hover {
  border-color: var(--od-primary-300, #93c5fd);
  box-shadow: var(--od-shadow-2);
  transform: translateY(-2px);
}

.card-hover-action {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(15, 23, 42, 0.72);
  color: #fff;
  font-weight: 650;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.market-card:hover .card-hover-action,
.market-card:focus-visible .card-hover-action {
  opacity: 1;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
}

.sub-tag {
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
}

.name {
  font-weight: 650;
  font-size: 15px;
  color: var(--od-gray-900, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.meta {
  color: var(--od-gray-500, #64748b);
  font-size: 12px;
  margin: 4px 0 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.mono-code {
  font-family: var(--od-font-mono, monospace);
  font-weight: 500;
}

.version-tag {
  background: var(--od-gray-100, #f1f5f9);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.desc {
  font-size: 12px;
  color: var(--od-gray-500, #64748b);
  line-height: 1.5;
  margin: 0 0 14px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  flex: 1;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--od-gray-100, #f1f5f9);
}

.status-tag {
  font-size: 11px;
  font-weight: 500;
  border-radius: 4px;
}

.quick-btn {
  border: 0;
  background: var(--od-primary-50, #eff6ff);
  color: var(--od-color-primary, #1e40af);
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s ease;
}

.quick-btn:hover {
  background: var(--od-color-primary, #1e40af);
  color: #fff;
}
</style>
