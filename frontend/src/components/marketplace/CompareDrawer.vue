<script setup lang="ts">
/**
 * 产品对比抽屉（B5-2）：2~4 个产品按申请条件/更新周期/交付方式等维度并排对比。
 * 数据来自 marketplaceApi.find（mock 目录含 descriptor），差异行由单元格值自动对比高亮。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { marketplaceApi } from '@/api/portal'
import { catalogItem } from '@/catalog'
import { useFavoritesStore } from '@/stores/favorites'
import type { CatalogEntry, UpstreamAggregation } from '@/types/portal'
import type { ProductDescriptor } from '@/types/data-workbench'
import EmptyState from '@/ui-kit/EmptyState.vue'
import { 中文展示 } from '@/ui-kit/展示文本'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ codes: string[] }>()

const { t } = useI18n()
const favoritesStore = useFavoritesStore()

const loading = ref(false)
const columns = ref<Array<{ code: string; name: string; entry: CatalogEntry | null; descriptor: ProductDescriptor | null }>>([])

async function load(): Promise<void> {
  if (props.codes.length < 2) return
  loading.value = true
  try {
    const found = await Promise.all(
      props.codes.map(async (code) => {
        const res: UpstreamAggregation = await marketplaceApi.find(code)
        const entry = (catalogItem(res, code) ?? null) as (CatalogEntry & { descriptor?: ProductDescriptor }) | null
        return {
          code,
          name: entry?.name ?? code,
          entry: entry as CatalogEntry | null,
          descriptor: entry?.descriptor ?? null,
        }
      }),
    )
    columns.value = found
  } finally {
    loading.value = false
  }
}

watch(open, (value) => {
  if (value) void load()
})

const compareRows = computed(() => {
  const first = columns.value[0]
  return [
    {
      label: t('common.status'),
      values: columns.value.map((column) => 中文展示(column.entry?.status ?? '')),
    },
    {
      label: t('marketplace.updateCycle'),
      values: columns.value.map((column) => column.descriptor?.updateCycle ?? '—'),
    },
    {
      label: t('marketplace.sectionRequirements'),
      values: columns.value.map((column) => column.descriptor?.applyRequirements.join('；') || '—'),
    },
    {
      label: t('marketplace.deliveryFormats'),
      values: columns.value.map((column) => column.descriptor?.delivery.formats.join('、') || '—'),
    },
    {
      label: t('marketplace.deliveryChannel'),
      values: columns.value.map((column) => column.descriptor?.delivery.channel || '—'),
    },
    {
      label: t('marketplace.deliverySla'),
      values: columns.value.map((column) => column.descriptor?.delivery.sla || '—'),
    },
    {
      label: t('marketplace.sectionAssets'),
      values: columns.value.map((column) => column.descriptor?.asset?.code ?? '—'),
    },
    {
      label: t('marketplace.compareFavorite'),
      values: columns.value.map((column) => (favoritesStore.isFavorite(column.code) ? t('marketplace.card.subscribed') : '—')),
    },
  ].map((row) => ({
    ...row,
    differs: new Set(row.values).size > 1 && first !== undefined,
  }))
})
</script>

<template>
  <a-drawer v-model:open="open" :title="t('marketplace.compareTitle')" width="80%">
    <a-spin :spinning="loading">
      <EmptyState
        v-if="columns.length < 2"
        :title="t('marketplace.compareTitle')"
        :description="t('marketplace.compareUnavailable')"
      />
      <div v-else class="compare-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th class="compare-label-col"></th>
              <th v-for="column in columns" :key="column.code">
                <div class="compare-name">{{ column.name }}</div>
                <div class="cell-mono compare-code">{{ column.code }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in compareRows" :key="row.label">
              <th class="compare-label-col">{{ row.label }}</th>
              <td v-for="(value, index) in row.values" :key="index" :class="{ 'compare-differs': row.differs && value !== row.values[0] }">
                {{ value }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </a-spin>
  </a-drawer>
</template>

<style scoped>
.compare-table-wrap {
  overflow: auto;
}

.compare-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.compare-table th,
.compare-table td {
  border: 1px solid var(--od-gray-200, #e2e8f0);
  padding: 10px 12px;
  text-align: left;
  vertical-align: top;
}

.compare-label-col {
  width: 120px;
  color: var(--od-gray-500, #64748b);
  font-weight: 500;
  white-space: nowrap;
}

.compare-name {
  font-weight: 600;
}

.compare-code {
  font-size: 11px;
}

.compare-differs {
  background: #fffbeb;
}
</style>
