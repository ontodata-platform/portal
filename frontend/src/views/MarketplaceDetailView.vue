<script setup lang="ts">
import { KeyOutlined } from '@ant-design/icons-vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/api/client'
import { marketplaceApi } from '@/api/portal'
import { catalogItem } from '@/catalog'
import ApplyWizardModal from '@/components/data-workbench/ApplyWizardModal.vue'
import DescriptorSection from '@/components/descriptor/DescriptorSection.vue'
import { useMessageStore } from '@/stores/message'
import type { ApplyTarget } from '@/types/application'
import type { ProductDescriptor } from '@/types/data-workbench'
import type { CatalogEntry, UpstreamAggregation } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'
import { 中文展示 } from '@/ui-kit/展示文本'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const messageStore = useMessageStore()

const code = computed(() => String(route.params.code ?? ''))

const loading = ref(false)
const notFound = ref(false)
const aggregation = ref<UpstreamAggregation | null>(null)
const service = ref<CatalogEntry | null>(null)

const applyOpen = ref(false)

const descriptor = computed(() => (service.value?.descriptor ?? null) as ProductDescriptor | null)

const applyTargets = computed<ApplyTarget[]>(() => {
  if (!service.value) return []
  return [{
    code: service.value.code,
    name: service.value.name,
    source: 'SERVICE',
    fields: descriptor.value?.fieldSpecs.map((field) => field.name),
    applyRequirements: descriptor.value?.applyRequirements,
  }]
})

async function loadDetail() {
  if (!code.value) return
  loading.value = true
  notFound.value = false
  aggregation.value = null
  service.value = null
  try {
    const res = await marketplaceApi.find(code.value)
    aggregation.value = res
    service.value = catalogItem(res, code.value)
    notFound.value = !service.value && Boolean(res.available)
  } catch (error) {
    const apiError = error instanceof ApiError ? error : ApiError.from(error)
    if (apiError.status === 404 || apiError.code === 'NOT_FOUND') {
      notFound.value = true
      if (messageStore.feedback?.kind === 'error') messageStore.clear()
    } else {
      messageStore.reportError(error)
    }
  } finally {
    loading.value = false
  }
}

function openApplyModal() {
  applyOpen.value = true
}

function onApplied() {
  void loadDetail()
}

onMounted(loadDetail)
</script>

<template>
  <div class="marketplace-detail-view">
    <PageHeader
      :title="service?.name ?? t('marketplace.detailTitle')"
      :status="service ? 'success' : undefined"
      :status-label="service ? 中文展示(service.status) : undefined"
      back-to="/data-workbench"
    />
    <a-card :bordered="false" class="detail-card">
      <a-spin :spinning="loading">
        <a-alert
          v-if="aggregation && !aggregation.available"
          type="warning"
          show-icon
          style="margin-bottom: 16px; border-radius: 8px"
          :message="aggregation.message ?? t('marketplace.unavailable')"
          :description="t('marketplace.description')"
        />

        <template v-if="service">
          <div class="service-header">
            <div class="service-title-area">
              <a-space wrap>
                <span class="mono-badge">{{ service.code }}</span>
                <a-tag :color="service.status === 'PUBLISHED' || service.status === 'ONLINE' ? 'success' : 'default'">
                  {{ 中文展示(service.status) }}
                </a-tag>
                <a-tag color="blue">v{{ service.currentVersion }}</a-tag>
                <a-tag v-if="service.classification" color="orange">{{ 中文展示(service.classification) }}</a-tag>
              </a-space>
            </div>

            <div class="service-actions">
              <a-button
                type="primary"
                size="large"
                :disabled="!aggregation?.available"
                class="apply-main-btn"
                @click="openApplyModal"
              >
                <template #icon><KeyOutlined /></template>
                {{ t('marketplace.applyButton') }}
              </a-button>
            </div>
          </div>

          <a-divider style="margin: 20px 0" />

          <div class="product-sections">
            <DescriptorSection :title="t('marketplace.details')">
              <a-descriptions bordered :column="2" size="middle">
                <a-descriptions-item :label="t('common.stableCode')">
                  <span class="mono-text">{{ service.code }}</span>
                </a-descriptions-item>
                <a-descriptions-item :label="t('common.name')">{{ service.name }}</a-descriptions-item>
                <a-descriptions-item :label="t('common.currentVersion')">v{{ service.currentVersion }}</a-descriptions-item>
                <a-descriptions-item :label="t('common.status')">{{ 中文展示(service.status) }}</a-descriptions-item>
                <a-descriptions-item :label="t('marketplace.updateCycle')">
                  {{ descriptor?.updateCycle ?? '—' }}
                </a-descriptions-item>
                <a-descriptions-item :label="t('scenarios.description')" :span="2">
                  {{ descriptor?.overview ?? service.description }}
                </a-descriptions-item>
              </a-descriptions>
            </DescriptorSection>

            <DescriptorSection
              :title="t('marketplace.sectionFields')"
              :empty="!descriptor?.fieldSpecs.length"
              :empty-title="t('marketplace.emptySection', { section: t('marketplace.sectionFields') })"
            >
              <a-table
                :columns="[
                  { title: t('marketplace.fieldName'), dataIndex: 'name' },
                  { title: t('marketplace.fieldType'), dataIndex: 'type' },
                  { title: t('marketplace.fieldDesc'), dataIndex: 'desc' },
                ]"
                :data-source="descriptor?.fieldSpecs ?? []"
                :pagination="false"
                row-key="name"
                size="small"
              />
            </DescriptorSection>

            <DescriptorSection
              :title="t('marketplace.sectionSample')"
              :empty="!descriptor?.sample.rows.length"
              :empty-title="t('marketplace.emptySection', { section: t('marketplace.sectionSample') })"
            >
              <a-table
                :columns="(descriptor?.sample.columns ?? []).map((column) => ({ title: column, dataIndex: column }))"
                :data-source="(descriptor?.sample.rows ?? []).map((row, index) => ({ ...row, __row: index }))"
                :pagination="false"
                row-key="__row"
                size="small"
              />
            </DescriptorSection>

            <DescriptorSection
              :title="t('marketplace.sectionRequirements')"
              :empty="!descriptor?.applyRequirements.length"
              :empty-title="t('marketplace.emptySection', { section: t('marketplace.sectionRequirements') })"
            >
              <ul class="requirement-list">
                <li v-for="item in descriptor?.applyRequirements ?? []" :key="item">{{ item }}</li>
              </ul>
            </DescriptorSection>

            <DescriptorSection
              :title="t('marketplace.sectionDelivery')"
              :empty="!descriptor?.delivery"
              :empty-title="t('marketplace.emptySection', { section: t('marketplace.sectionDelivery') })"
            >
              <a-descriptions bordered :column="1" size="small">
                <a-descriptions-item :label="t('marketplace.deliveryFormats')">
                  {{ descriptor?.delivery.formats.join('、') }}
                </a-descriptions-item>
                <a-descriptions-item :label="t('marketplace.deliveryChannel')">
                  {{ descriptor?.delivery.channel }}
                </a-descriptions-item>
                <a-descriptions-item :label="t('marketplace.deliverySla')">
                  {{ descriptor?.delivery.sla }}
                </a-descriptions-item>
              </a-descriptions>
            </DescriptorSection>

            <!-- B2-1：产品详情内直接呈现底层数据资产，数据集不再作为平级目录 -->
            <DescriptorSection
              :title="t('marketplace.sectionAssets')"
              :empty="!descriptor?.asset"
              :empty-title="t('marketplace.emptySection', { section: t('marketplace.sectionAssets') })"
            >
              <button
                v-if="descriptor?.asset"
                type="button"
                class="asset-link"
                @click="router.push(`/data-workbench/dataset/${encodeURIComponent(descriptor.asset.code)}`)"
              >
                <span class="asset-name">{{ descriptor.asset.name }}</span>
                <span class="cell-mono asset-code">{{ descriptor.asset.code }}</span>
                <a-tag>{{ descriptor.asset.version }}</a-tag>
                <span class="asset-quality">
                  {{ t('dataWorkbench.qualityPassRate') }}：{{ descriptor.asset.qualityPassRate }}
                </span>
              </button>
            </DescriptorSection>
          </div>
        </template>
        <template v-else-if="!loading && (notFound || aggregation?.available)">
          <EmptyState
            :title="t('marketplace.emptyDetailTitle')"
            :description="t('marketplace.emptyDetailDesc')"
            :action-label="t('marketplace.backToList')"
            @action="router.push('/data-workbench')"
          />
        </template>
      </a-spin>
    </a-card>

    <ApplyWizardModal v-model:open="applyOpen" :targets="applyTargets" @submitted="onApplied" />
  </div>
</template>

<style scoped>
.detail-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: var(--od-shadow-1);
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding: 8px 0;
}

.mono-badge {
  font-family: var(--font-mono);
  background: var(--od-gray-100, #f1f5f9);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-tertiary);
}

.apply-main-btn {
  border-radius: 8px;
  font-weight: 600;
  padding: 0 24px;
}

.product-sections {
  display: grid;
  gap: 16px;
}

/* B2-1：关联数据资产卡（整卡可点，跳数据集详情） */
.asset-link {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 8px;
  background: #f8fafc;
  cursor: pointer;
  text-align: left;
}

.asset-link:hover {
  border-color: var(--od-primary, #2563eb);
}

.asset-name {
  font-weight: 600;
}

.asset-quality {
  margin-left: auto;
  font-size: 12px;
  color: var(--od-gray-500, #64748b);
}

.requirement-list {
  margin: 0;
  padding-left: 18px;
  color: var(--od-color-ink-soft, #334e68);
  line-height: 1.8;
}
</style>
