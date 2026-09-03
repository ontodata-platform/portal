<script setup lang="ts">
import { SearchOutlined, DatabaseOutlined } from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { marketplaceApi } from '@/api/portal'
import { dataWorkbenchApi } from '@/api/data-workbench'
import { catalogItems, catalogTotal } from '@/catalog'
import MarketServiceCard from '@/components/marketplace/MarketServiceCard.vue'
import { useMessageStore } from '@/stores/message'
import type { CatalogEntry, UpstreamAggregation } from '@/types/portal'
import type { DatasetSummary } from '@/types/descriptor'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'
import SkeletonList from '@/ui-kit/SkeletonList.vue'

const { t } = useI18n()
const router = useRouter()
const messageStore = useMessageStore()

const activeTab = ref('services')

// ── 数据集签（v5 §14.3，底座依赖 D-4，mock 先行） ──
const datasetsLoading = ref(false)
const datasets = ref<DatasetSummary[]>([])
const domains = ref<string[]>([])
const datasetQuery = reactive({ keyword: '', domain: '' })

const domainOptions = computed(() => [
  { label: t('dataWorkbench.domainAll'), value: '' },
  ...domains.value.map((domain) => ({ label: domain, value: domain })),
])

async function loadDatasets() {
  datasetsLoading.value = true
  try {
    const res = await dataWorkbenchApi.listDatasets({
      page: 1,
      size: 50,
      keyword: datasetQuery.keyword || undefined,
      domain: datasetQuery.domain || undefined,
    })
    datasets.value = res.items
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    datasetsLoading.value = false
  }
}

async function loadDomains() {
  try {
    domains.value = await dataWorkbenchApi.listDomains()
  } catch {
    domains.value = []
  }
}

function onTabChange(tab: string | number) {
  if (tab === 'datasets' && datasets.value.length === 0) {
    void loadDatasets()
    void loadDomains()
  }
}

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
  <div class="marketplace-page">
    <PageHeader
      :eyebrow="t('menu.groupPortal')"
      :title="t('menu.marketplace')"
    />

    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />

    <a-tabs
      v-else
      v-model:active-key="activeTab"
      class="dw-tabs"
      @change="onTabChange"
    >
      <a-tab-pane key="services" :tab="t('dataWorkbench.tabServices')">
    <a-card :bordered="false" class="marketplace-card">
      <a-alert
        v-if="aggregation && !aggregation.available"
        type="warning"
        show-icon
        style="margin-bottom: 16px; border-radius: 8px"
        :message="aggregation.message ?? t('marketplace.unavailable')"
        :description="t('marketplace.description')"
      />

      <div class="toolbar">
        <a-input
          v-model:value="query.keyword"
          :placeholder="t('marketplace.searchPlaceholder')"
          style="width: 320px"
          allow-clear
          @press-enter="query.page = 1; load()"
        >
          <template #prefix><SearchOutlined style="color: #94a3b8" /></template>
        </a-input>
        <a-button type="primary" @click="query.page = 1; load()">
          {{ t('common.query') }}
        </a-button>
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
      </a-tab-pane>

      <a-tab-pane key="datasets" :tab="t('dataWorkbench.tabDatasets')">
        <a-card :bordered="false" class="marketplace-card">
          <div class="toolbar">
            <a-input-search
              v-model:value="datasetQuery.keyword"
              :placeholder="t('dataWorkbench.datasetSearch')"
              style="width: 320px"
              allow-clear
              @search="loadDatasets"
            />
            <a-select
              v-model:value="datasetQuery.domain"
              :options="domainOptions"
              style="width: 200px"
              @change="loadDatasets"
            />
          </div>

          <SkeletonList v-if="datasetsLoading" variant="cards" :rows="6" />
          <EmptyState
            v-else-if="datasets.length === 0"
            :title="t('dataWorkbench.emptyDatasets')"
            :description="t('dataWorkbench.emptyDatasetsDesc')"
          />
          <div v-else class="card-grid">
            <a-card
              v-for="dataset in datasets"
              :key="dataset.code"
              hoverable
              class="dataset-card"
              @click="router.push(`/data-workbench/dataset/${encodeURIComponent(dataset.code)}`)"
            >
              <div class="dataset-head">
                <DatabaseOutlined class="dataset-icon" />
                <div class="dataset-titles">
                  <div class="dataset-name">{{ dataset.name }}</div>
                  <div class="dataset-code">
                    <span class="mono-code">{{ dataset.code }}</span>
                    <a-tag>{{ dataset.version }}</a-tag>
                  </div>
                </div>
              </div>
              <p class="dataset-desc">{{ dataset.description }}</p>
              <div class="dataset-meta">
                <span>{{ t('dataWorkbench.domainLabel') }}：{{ dataset.domain }}</span>
                <span>{{ t('dataWorkbench.qualityPassRate') }}：{{ dataset.qualityPassRate }}</span>
              </div>
            </a-card>
          </div>
        </a-card>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<style scoped>
.marketplace-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: var(--od-shadow-1);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.pager {
  margin-top: 20px;
  text-align: right;
}
.dataset-card {
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: var(--od-radius-card, 12px);
}

.dataset-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.dataset-icon {
  font-size: 20px;
  color: var(--od-primary-500, #3b82f6);
}

.dataset-titles {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.dataset-name {
  font-weight: 650;
  color: var(--od-gray-900, #0f172a);
}

.dataset-code {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mono-code {
  font-family: var(--od-font-mono, monospace);
  font-size: 12px;
  color: var(--od-gray-500, #64748b);
}

.dataset-desc {
  margin: 8px 0;
  color: var(--od-gray-500, #64748b);
  font-size: 13px;
  line-height: 1.5;
  min-height: 40px;
}

.dataset-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--od-gray-500, #64748b);
}
</style>
