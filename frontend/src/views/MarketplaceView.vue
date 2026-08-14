<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { marketplaceApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { CatalogEntry, UpstreamAggregation } from '@/types/portal'

const { t } = useI18n()
const messageStore = useMessageStore()

const loading = ref(false)
const aggregation = ref<UpstreamAggregation | null>(null)
const rows = ref<CatalogEntry[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, keyword: '' })

const columns = computed(() => [
  { title: t('common.stableCode'), dataIndex: 'code', key: 'code' },
  { title: t('common.name'), dataIndex: 'name', key: 'name' },
  { title: t('common.status'), dataIndex: 'status', key: 'status' },
  { title: t('common.currentVersion'), dataIndex: 'currentVersion', key: 'currentVersion' },
])

async function load() {
  loading.value = true
  try {
    aggregation.value = await marketplaceApi.dataServices({
      page: query.page,
      size: query.size,
      keyword: query.keyword || undefined,
    })
    rows.value = aggregation.value.available ? aggregation.value.body?.items ?? [] : []
    total.value = aggregation.value.available ? aggregation.value.body?.total ?? 0 : 0
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <a-card>
    <a-alert
      v-if="aggregation && !aggregation.available"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      :message="aggregation.message ?? t('marketplace.unavailable')"
      :description="t('marketplace.description')"
    />

    <a-space style="margin-bottom: 12px">
      <a-input-search
        v-model:value="query.keyword"
        :placeholder="t('marketplace.searchPlaceholder')"
        style="width: 240px"
        @search="
          query.page = 1;
          load()
        "
      />
    </a-space>

    <a-table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      row-key="code"
      :pagination="{ current: query.page, pageSize: query.size, total }"
      @change="
        (pagination: { current?: number }) => {
          query.page = pagination.current ?? 1;
          load();
        }
      "
    />
  </a-card>
</template>
