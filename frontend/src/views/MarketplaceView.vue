<script setup lang="ts">
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  EyeOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import {
  dataWorkbenchApi,
  type DataApplication,
  type DataSubscription,
  type DatasetSummary,
} from '@/api/data-workbench'
import { marketplaceApi } from '@/api/portal'
import { catalogItems, catalogTotal } from '@/catalog'
import MarketServiceCard from '@/components/marketplace/MarketServiceCard.vue'
import { useMessageStore } from '@/stores/message'
import type { CatalogEntry, UpstreamAggregation } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import { formatDate, formatDateTime, formatNumber } from '@/ui-kit/format'
import OdTable from '@/ui-kit/OdTable.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'
import SkeletonList from '@/ui-kit/SkeletonList.vue'

const { t } = useI18n()
const router = useRouter()
const messageStore = useMessageStore()

const activeTab = ref('services')

// ── 数据服务签（目录） ──
const loading = ref(false)
const loadError = ref('')
const aggregation = ref<UpstreamAggregation | null>(null)
const rows = ref<CatalogEntry[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, keyword: '' })

// ── 数据集签（v5 §14.3，底座依赖 D-4，mock 先行） ──
const datasetsLoading = ref(false)
const datasets = ref<DatasetSummary[]>([])
const domains = ref<string[]>([])
const datasetQuery = reactive({ keyword: '', domain: '' })

const domainOptions = computed(() => [
  { label: t('dataWorkbench.domainAll'), value: '' },
  ...domains.value.map((domain) => ({ label: domain, value: domain })),
])

// ── 我的申请签 ──
const applicationsLoading = ref(false)
const applications = ref<DataApplication[]>([])

// ── 我的订阅与交付签 ──
const subscriptionsLoading = ref(false)
const subscriptions = ref<DataSubscription[]>([])

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

async function loadApplications() {
  applicationsLoading.value = true
  try {
    const res = await dataWorkbenchApi.listMyApplications()
    applications.value = res.items
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    applicationsLoading.value = false
  }
}

async function loadSubscriptions() {
  subscriptionsLoading.value = true
  try {
    const res = await dataWorkbenchApi.listMySubscriptions()
    subscriptions.value = res.items
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    subscriptionsLoading.value = false
  }
}

function onTabChange(tab: string | number) {
  if (tab === 'datasets' && datasets.value.length === 0) {
    void loadDatasets()
    void loadDomains()
  } else if (tab === 'applications' && applications.value.length === 0) {
    void loadApplications()
  } else if (tab === 'subscriptions' && subscriptions.value.length === 0) {
    void loadSubscriptions()
  }
}

const applicationColumns = [
  { title: t('dataWorkbench.applicationCode'), dataIndex: 'code', key: 'code', width: 140, odEllipsis: true, odSortable: true },
  { title: t('common.name'), dataIndex: 'serviceName', key: 'serviceName', odEllipsis: true, odSortable: true },
  { title: t('common.status'), key: 'status', width: 120, odSortable: true },
  { title: t('common.submittedAt'), dataIndex: 'submittedAt', key: 'submittedAt', width: 180, odSortable: true },
  { title: t('common.remark'), dataIndex: 'remark', key: 'remark', odEllipsis: true },
  { title: t('common.action'), key: 'action', width: 130 },
]

const subscriptionColumns = [
  { title: t('common.code'), dataIndex: 'code', key: 'code', width: 120, odEllipsis: true, odSortable: true },
  { title: t('common.name'), dataIndex: 'serviceName', key: 'serviceName', odEllipsis: true, odSortable: true },
  { title: t('dataWorkbench.deliveryType'), dataIndex: 'deliveryType', key: 'deliveryType', width: 120, odSortable: true },
  { title: t('dataWorkbench.expiresAt'), dataIndex: 'expiresAt', key: 'expiresAt', width: 220, odSortable: true },
  { title: t('dataWorkbench.rowsCount'), dataIndex: 'rowsCount', key: 'rowsCount', width: 110, odSortable: true },
  { title: t('common.action'), key: 'action', width: 160 },
]

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
      <!-- 签页 1: 数据服务 -->
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

      <!-- 签页 2: 数据集 (v5 §14.3 新增) -->
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

      <!-- 签页 3: 我的申请 -->
      <a-tab-pane key="applications" :tab="t('dataWorkbench.tabApplications')">
        <a-card :bordered="false" class="marketplace-card">
          <SkeletonList v-if="applicationsLoading" variant="list" :rows="4" />
          <EmptyState
            v-else-if="applications.length === 0"
            :title="t('dataWorkbench.emptyApplications')"
            :description="t('dataWorkbench.emptyApplicationsDesc')"
          />
          <OdTable
            v-else
            :columns="applicationColumns"
            :data-source="applications"
            row-key="code"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'code'">
                <span class="mono-code">{{ record.code }}</span>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag v-if="record.status === 'DELIVERED'" color="success">
                  <template #icon><CheckCircleOutlined /></template>
                  已交付
                </a-tag>
                <a-tag v-else-if="record.status === 'PENDING'" color="processing">
                  <template #icon><ClockCircleOutlined /></template>
                  审批中
                </a-tag>
                <a-tag v-else-if="record.status === 'REJECTED'" color="error">
                  <template #icon><CloseCircleOutlined /></template>
                  已驳回
                </a-tag>
                <a-tag v-else color="default">{{ record.status }}</a-tag>
              </template>
              <template v-else-if="column.key === 'submittedAt'">
                {{ formatDateTime(record.submittedAt) }}
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space size="small">
                  <a-button
                    v-if="record.status === 'DELIVERED'"
                    size="small"
                    type="link"
                    @click="router.push(`/data-workbench/${encodeURIComponent(record.serviceCode)}`)"
                  >
                    去使用
                  </a-button>
                  <a-button
                    v-else-if="record.status === 'REJECTED'"
                    size="small"
                    type="link"
                    @click="router.push(`/data-workbench/${encodeURIComponent(record.serviceCode)}`)"
                  >
                    {{ t('dataWorkbench.reapply') }}
                  </a-button>
                  <span v-else class="text-muted">{{ record.currentApprover ?? '-' }}</span>
                </a-space>
              </template>
            </template>
          </OdTable>
        </a-card>
      </a-tab-pane>

      <!-- 签页 4: 我的订阅与交付 -->
      <a-tab-pane key="subscriptions" :tab="t('dataWorkbench.tabSubscriptions')">
        <a-card :bordered="false" class="marketplace-card">
          <SkeletonList v-if="subscriptionsLoading" variant="list" :rows="4" />
          <EmptyState
            v-else-if="subscriptions.length === 0"
            :title="t('dataWorkbench.emptySubscriptions')"
            :description="t('dataWorkbench.emptySubscriptionsDesc')"
          />
          <OdTable
            v-else
            :columns="subscriptionColumns"
            :data-source="subscriptions"
            row-key="code"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'serviceName'">
                <div>
                  <div style="font-weight: 600">{{ record.serviceName }}</div>
                  <span class="mono-code">{{ record.serviceCode }}</span>
                  <a-tag style="margin-left: 6px">{{ record.version }}</a-tag>
                </div>
              </template>
              <template v-else-if="column.key === 'deliveryType'">
                <a-tag color="blue">{{ record.deliveryType }}</a-tag>
              </template>
              <template v-else-if="column.key === 'expiresAt'">
                <div style="display: flex; align-items: center; gap: 6px">
                  <span>{{ formatDate(record.expiresAt) }}</span>
                  <a-tag v-if="record.isExpiringSoon" color="warning">
                    <template #icon><WarningOutlined /></template>
                    {{ t('dataWorkbench.expiringSoon') }}
                  </a-tag>
                </div>
              </template>
              <template v-else-if="column.key === 'rowsCount'">
                <span class="mono-code">{{ formatNumber(record.rowsCount) }}</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space size="small">
                  <a-button
                    v-if="record.previewUrl"
                    size="small"
                    type="primary"
                    ghost
                    @click="router.push(record.previewUrl)"
                  >
                    <template #icon><EyeOutlined /></template>
                    {{ t('dataWorkbench.previewData') }}
                  </a-button>
                  <a-button
                    size="small"
                    @click="messageStore.info('开始下载受控交付物，请注意数据安全规范')"
                  >
                    <template #icon><DownloadOutlined /></template>
                    下载
                  </a-button>
                </a-space>
              </template>
            </template>
          </OdTable>
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
  transition: all 0.2s ease;
}

.dataset-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--od-shadow-2);
  border-color: var(--od-primary-300, #93c5fd);
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

.text-muted {
  font-size: 12px;
  color: var(--od-gray-500, #64748b);
}
</style>
