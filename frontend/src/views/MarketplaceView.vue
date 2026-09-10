<script setup lang="ts">
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  WarningOutlined,
} from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import {
  dataWorkbenchApi,
  type DataApplication,
  type DataSubscription,
} from '@/api/data-workbench'
import { marketplaceApi } from '@/api/portal'
import { downloadBlob } from '@/utils/download'
import { catalogItems, catalogTotal } from '@/catalog'
import ApplyWizardModal from '@/components/data-workbench/ApplyWizardModal.vue'
import CompareDrawer from '@/components/marketplace/CompareDrawer.vue'
import MarketServiceCard from '@/components/marketplace/MarketServiceCard.vue'
import TableFilterBar from '@/ui-kit/TableFilterBar.vue'
import { useFavoritesStore } from '@/stores/favorites'
import { useMessageStore } from '@/stores/message'
import type { CatalogEntry, UpstreamAggregation } from '@/types/portal'
import type { ApplyTarget } from '@/types/application'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import { formatDate, formatDateTime, formatNumber } from '@/ui-kit/format'
import OdTable from '@/ui-kit/OdTable.vue'
import SkeletonList from '@/ui-kit/SkeletonList.vue'
import { 中文展示 } from '@/ui-kit/展示文本'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const messageStore = useMessageStore()
const favoritesStore = useFavoritesStore()

const allowedTabs = new Set(['services', 'applications', 'subscriptions'])
const queryTab = String(route.query.tab ?? '')
const activeTab = ref(allowedTabs.has(queryTab) ? queryTab : 'services')

// ── 数据目录签（B2-1：数据集并入产品详情的"关联数据资产"，目录只保留产品视角） ──
const loading = ref(false)
const loadError = ref('')
const aggregation = ref<UpstreamAggregation | null>(null)
const rows = ref<CatalogEntry[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, keyword: '', subscribed: '', classification: '' })

/** B2-2/B2-3：客户端即时过滤（开通状态/密级/关键字），不再依赖"查询"按钮。 */
const visibleRows = computed(() =>
  rows.value.filter((row) => {
    if (query.subscribed && String(row.subscribed) !== query.subscribed) return false
    if (query.classification && row.classification !== query.classification) return false
    if (query.keyword) {
      const keyword = query.keyword.toLowerCase()
      if (!`${row.name}${row.code}`.toLowerCase().includes(keyword)) return false
    }
    return true
  }),
)

const catalogFilterSpecs = computed(() => [
  {
    key: 'subscribed',
    label: t('marketplace.filterSubscribed'),
    options: [
      { value: 'true', label: t('marketplace.subscribed') },
      { value: 'false', label: t('marketplace.unsubscribed') },
    ],
    width: 140,
  },
  {
    key: 'classification',
    label: t('marketplace.filterClassification'),
    options: [
      { value: 'INTERNAL', label: t('dataWorkbench.classificationInternal') },
      { value: 'CONFIDENTIAL', label: t('dataWorkbench.classificationConfidential') },
    ],
    width: 120,
  },
])

// ── B3-2：多产品合并申请 ──
const selectedCodes = ref<string[]>([])
const wizardOpen = ref(false)
const wizardTargets = ref<ApplyTarget[]>([])
const compareOpen = ref(false)

function toggleSelect(item: CatalogEntry, checked: boolean) {
  selectedCodes.value = checked
    ? [...selectedCodes.value, item.code]
    : selectedCodes.value.filter((code) => code !== item.code)
}

function openBulkApply() {
  wizardTargets.value = visibleRows.value
    .filter((item) => selectedCodes.value.includes(item.code))
    .map((item) => ({ code: item.code, name: item.name, source: 'SERVICE' as const }))
  wizardOpen.value = true
}

function onBulkSubmitted() {
  selectedCodes.value = []
  void load()
}

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

async function downloadSubscription(record: DataSubscription) {
  if (!record.hasFile) return
  try {
    const file = await marketplaceApi.downloadDeliverable(record.code)
    downloadBlob(file.filename, file.mime, file.blob)
    favoritesStore.recordDownload(record.code, String(record.serviceName ?? record.code), 'service')
  } catch (error) {
    messageStore.reportError(error)
  }
}

function onTabChange(tab: string | number) {
  if (tab === 'applications' && applications.value.length === 0) {
    void loadApplications()
  } else if (tab === 'subscriptions' && subscriptions.value.length === 0) {
    void loadSubscriptions()
  }
}

const applicationColumns = [
  { title: t('dataWorkbench.applicationCode'), dataIndex: 'code', key: 'code', width: 140, odEllipsis: true, odSortable: true, mono: true },
  { title: t('common.name'), dataIndex: 'serviceName', key: 'serviceName', odEllipsis: true, odSortable: true },
  { title: t('common.status'), key: 'status', width: 120, odSortable: true },
  { title: t('common.submittedAt'), dataIndex: 'submittedAt', key: 'submittedAt', width: 180, odSortable: true },
  { title: t('common.remark'), dataIndex: 'remark', key: 'remark', odEllipsis: true },
  { title: t('common.action'), key: 'action', width: 130 },
]

const subscriptionColumns = [
  { title: t('common.code'), dataIndex: 'code', key: 'code', width: 120, odEllipsis: true, odSortable: true, mono: true },
  { title: t('common.name'), dataIndex: 'serviceName', key: 'serviceName', odEllipsis: true, odSortable: true },
  { title: t('dataWorkbench.deliveryType'), dataIndex: 'deliveryType', key: 'deliveryType', width: 120, odSortable: true },
  { title: t('dataWorkbench.expiresAt'), dataIndex: 'expiresAt', key: 'expiresAt', width: 220, odSortable: true },
  { title: t('dataWorkbench.rowsCount'), dataIndex: 'rowsCount', key: 'rowsCount', width: 110, odSortable: true },
  { title: t('common.action'), key: 'action', width: 160 },
]

onMounted(() => {
  void load()
  if (activeTab.value !== 'services') onTabChange(activeTab.value)
})
</script>

<template>
  <div class="marketplace-page">
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

          <TableFilterBar
            :query="query"
            :filters="catalogFilterSpecs"
            :search-placeholder="t('marketplace.searchPlaceholder')"
            :search-width="320"
            @update="Object.assign(query, $event)"
            @search="query.page = 1; load()"
          />

          <SkeletonList v-if="loading" variant="cards" :rows="6" />
          <EmptyState
            v-else-if="visibleRows.length === 0"
            :title="t('marketplace.emptyTitle')"
            :description="t('marketplace.emptyDesc')"
          />
          <div v-else class="card-grid">
            <div v-for="item in visibleRows" :key="item.code" class="card-select-wrap">
              <label class="card-select">
                <a-checkbox
                  :checked="selectedCodes.includes(item.code)"
                  :aria-label="t('marketplace.bulkSelect', { name: item.name })"
                  @update:checked="(checked: boolean) => toggleSelect(item, checked)"
                >
                  {{ t('marketplace.bulkSelectShort') }}
                </a-checkbox>
              </label>
              <MarketServiceCard :item="item" />
            </div>
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

      <!-- 签页 2: 我的申请（B2-1：数据集签已并入产品详情"关联数据资产"，目录只保留产品视角） -->
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
                <button
                  v-if="String(record.code).startsWith('apr-')"
                  type="button"
                  class="mono-code link-code"
                  :title="t('matter.title')"
                  @click="router.push(`/matter/approval/${encodeURIComponent(record.code)}`)"
                >
                  {{ record.code }}
                </button>
                <span v-else class="mono-code">{{ record.code }}</span>
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
                <a-tag v-else color="default">{{ 中文展示(record.status) }}</a-tag>
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
                <a-tag color="blue">{{ 中文展示(record.deliveryType) }}</a-tag>
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
                <span class="od-num">{{ formatNumber(record.rowsCount) }}</span>
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
                  <a-tooltip :title="record.hasFile ? undefined : t('common.fileGenerating')">
                    <span>
                      <a-button
                        size="small"
                        :disabled="!record.hasFile"
                        @click="downloadSubscription(record)"
                      >
                        <template #icon><DownloadOutlined /></template>
                        {{ t('common.download') }}
                      </a-button>
                    </span>
                  </a-tooltip>
                </a-space>
              </template>
            </template>
          </OdTable>
        </a-card>
      </a-tab-pane>
    </a-tabs>

    <!-- B3-2：合并申请浮条（选中 >0 时出现），支持对比（2~4 项） -->
    <div v-if="selectedCodes.length > 0" class="bulk-bar">
      <span class="bulk-hint">{{ t('marketplace.bulkSelected', { count: selectedCodes.length }) }}</span>
      <a-button size="small" @click="selectedCodes = []">{{ t('marketplace.bulkClear') }}</a-button>
      <a-button size="small" :disabled="selectedCodes.length < 2 || selectedCodes.length > 4" @click="compareOpen = true">
        {{ t('marketplace.bulkCompare') }}
      </a-button>
      <a-button type="primary" size="small" @click="openBulkApply">{{ t('marketplace.bulkApply') }}</a-button>
    </div>

    <ApplyWizardModal v-model:open="wizardOpen" :targets="wizardTargets" @submitted="onBulkSubmitted" />
    <CompareDrawer v-model:open="compareOpen" :codes="selectedCodes" />
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

/* C1：可点击单号（直达事项详情） */
.link-code {
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 0;
  text-decoration: underline dotted;
}

/* B3-2：合并申请 */
.card-select-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-select {
  font-size: 12px;
  color: var(--od-gray-500, #64748b);
}

.bulk-bar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 10px;
  background: #fff;
  box-shadow: var(--od-shadow-2, 0 8px 24px rgba(15, 23, 42, 0.16));
  z-index: 20;
}

.bulk-hint {
  font-size: 13px;
  color: var(--od-primary, #2563eb);
  font-weight: 500;
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
