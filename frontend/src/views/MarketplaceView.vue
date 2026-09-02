<script setup lang="ts">
import { EyeOutlined } from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { marketplaceApi } from '@/api/portal'
import { catalogItems, catalogTotal } from '@/catalog'
import { useMessageStore } from '@/stores/message'
import type { CatalogEntry, UpstreamAggregation } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'

const { t } = useI18n()
const router = useRouter()
const messageStore = useMessageStore()

const loading = ref(false)
const loadError = ref('')
const aggregation = ref<UpstreamAggregation | null>(null)
const rows = ref<CatalogEntry[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, keyword: '' })

const columns = computed(() => [
  { title: t('common.stableCode'), dataIndex: 'code', key: 'code', width: 180 },
  { title: t('common.name'), dataIndex: 'name', key: 'name' },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 120 },
  { title: t('common.currentVersion'), dataIndex: 'currentVersion', key: 'currentVersion', width: 120 },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 160 },
])

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
  } catch (error) {
    loadError.value = describeLoadError(error)
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

function goToDetail(code: string) {
  router.push(`/marketplace/${encodeURIComponent(code)}`)
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

    <a-space style="margin-bottom: 16px">
      <a-input-search
        v-model:value="query.keyword"
        :placeholder="t('marketplace.searchPlaceholder')"
        style="width: 280px"
        allow-clear
        @search="
          query.page = 1;
          load();
        "
      />
    </a-space>

    <EmptyState
      v-if="!loading && rows.length === 0"
      :title="t('marketplace.emptyTitle')"
      :description="t('marketplace.emptyDesc')"
    />
    <a-table
      v-else
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      row-key="code"
      :pagination="{ current: query.page, pageSize: query.size, total }"
      :custom-row="
        (record: CatalogEntry) => ({
          onClick: () => goToDetail(record.code),
          style: { cursor: 'pointer' },
        })
      "
      @change="
        (pagination: { current?: number }) => {
          query.page = pagination.current ?? 1;
          load();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'code'">
          <a class="code-link" @click.stop="goToDetail(record.code)">{{ record.code }}</a>
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="record.status === 'PUBLISHED' || record.status === 'ONLINE' ? 'success' : 'default'">
            {{ record.status }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button type="primary" size="small" ghost @click.stop="goToDetail(record.code)">
            <template #icon><EyeOutlined /></template>
            {{ t('marketplace.viewDetail') }}
          </a-button>
        </template>
      </template>
    </a-table>
    </a-card>
  </div>
</template>

<style scoped>
.marketplace-card {
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.code-link {
  font-weight: 500;
}
</style>
