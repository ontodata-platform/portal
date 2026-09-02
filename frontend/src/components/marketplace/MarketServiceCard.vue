<script setup lang="ts">
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
  if (/SECRET|CONFIDENTIAL|机密/.test(raw)) return '#c53030'
  if (/INTERNAL|内部/.test(raw)) return '#1f4e79'
  return '#168a62'
})

function open() {
  void router.push(`/data-workbench/${encodeURIComponent(props.item.code)}`)
}
</script>

<template>
  <a-card hoverable class="market-card" @click="open">
    <div class="icon" :style="{ background: tone }">{{ item.name.slice(0, 1) }}</div>
    <div class="name">{{ item.name }}</div>
    <div class="meta">{{ item.code }} · {{ item.currentVersion }}</div>
    <a-space>
      <a-tag>{{ item.status }}</a-tag>
      <a-tag :color="subscribed ? 'green' : 'default'">
        {{ subscribed ? t('marketplace.card.subscribed') : t('marketplace.card.unsubscribed') }}
      </a-tag>
      <a-button size="small" type="primary" ghost @click.stop="open">
        {{ subscribed ? t('marketplace.viewDetail') : t('marketplace.applyButton') }}
      </a-button>
    </a-space>
  </a-card>
</template>

<style scoped>
.market-card { border-radius: var(--od-radius-card); box-shadow: var(--od-shadow-1); }
.icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  margin-bottom: 8px;
}
.name { font-weight: 600; }
.meta { color: var(--od-gray-500); font-size: 12px; margin: 4px 0 8px; }
</style>
