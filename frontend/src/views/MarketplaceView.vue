<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import MarketServiceCard from '@/components/marketplace/MarketServiceCard.vue'
import { marketplaceApi } from '@/api/portal'
import { catalogItems, catalogTotal } from '@/catalog'
import { useMessageStore } from '@/stores/message'
import type { CatalogEntry, UpstreamAggregation } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'
import SkeletonList from '@/ui-kit/SkeletonList.vue'

const { t } = useI18n()
const messageStore = useMessageStore()

const loading = ref(false)
const loadError = ref('')
const aggregation = ref<UpstreamAggregation | null>(null)
const rows = ref<CatalogEntry[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, keyword: '' })

function describeLoadError(error: unknown): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  if (message) return message
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    aggregation.value = await marketplaceApi.dataServices({
      page: query.page,
      size: query.size,
      keyword: query.keyword || undefined,
    })
    rows.value = catalogItems(aggregation.value)
    total.value = catalogTotal(aggregation.value)
    // 列表加载成功后清掉上一页残留的全局错误条（如详情 404）
    if (messageStore.feedback?.kind === 'error') {
      messageStore.clear()
    }
  } catch (error) {
    loadError.value = describeLoadError(error)
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <PageHeader
      :eyebrow="t('menu.groupPortal')"
      :title="t('menu.marketplace')"
      :description="t('marketplace.description')"
    />

    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />

    <a-card v-else :bordered="false" class="marketplace-card">
    <a-alert
      v-if="aggregation && !aggregation.available"
      type="warning"
      show-icon
      style="margin-bottom: 16px"
      :message="aggregation.message ?? t('marketplace.unavailable')"
      :description="t('marketplace.description')"
    />

    <div class="toolbar">
      <a-input-search
        v-model:value="query.keyword"
        :placeholder="t('marketplace.searchPlaceholder')"
        style="width: 360px"
        allow-clear
        @search="
          query.page = 1;
          load();
        "
      />
    </div>

    <SkeletonList v-if="loading" variant="cards" :rows="6" />
    <EmptyState
      v-else-if="rows.length === 0"
      :title="t('marketplace.emptyTitle')"
      :description="t('marketplace.emptyDesc')"
    />
    <div v-else class="card-grid">
      <MarketServiceCard v-for="item in rows" :key="item.code" :item="item" />
    </div>
    <div v-if="total > query.size" class="pager">
      <a-pagination
        :current="query.page"
        :page-size="query.size"
        :total="total"
        @change="
          (page: number) => {
            query.page = page
            load()
          }
        "
      />
    </div>
    </a-card>
  </div>
</template>

<style scoped>
.marketplace-card {
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.pager {
  margin-top: 16px;
  text-align: right;
}
</style>
