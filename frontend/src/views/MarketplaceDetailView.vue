<script setup lang="ts">
import { KeyOutlined } from '@ant-design/icons-vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/api/client'
import { marketplaceApi } from '@/api/portal'
import { catalogItem } from '@/catalog'
import ApplyWizardModal from '@/components/data-workbench/ApplyWizardModal.vue'
import { useMessageStore } from '@/stores/message'
import type { ApplyTarget } from '@/types/application'
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

const applyTargets = computed<ApplyTarget[]>(() => {
  if (!service.value) return []
  return [{ code: service.value.code, name: service.value.name, source: 'SERVICE' }]
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

          <a-descriptions :title="t('marketplace.details')" bordered :column="2" size="middle">
            <a-descriptions-item :label="t('common.stableCode')">
              <span class="mono-text">{{ service.code }}</span>
            </a-descriptions-item>
            <a-descriptions-item :label="t('common.name')">{{ service.name }}</a-descriptions-item>
            <a-descriptions-item :label="t('common.currentVersion')">v{{ service.currentVersion }}</a-descriptions-item>
            <a-descriptions-item :label="t('common.status')">{{ 中文展示(service.status) }}</a-descriptions-item>
            <a-descriptions-item v-if="service.description" :label="t('scenarios.description')" :span="2">
              {{ service.description }}
            </a-descriptions-item>
          </a-descriptions>
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
  font-family: var(--od-font-mono, monospace);
  background: var(--od-gray-100, #f1f5f9);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--od-gray-700, #334155);
}

.mono-text {
  font-family: var(--od-font-mono, monospace);
}

.apply-main-btn {
  border-radius: 8px;
  font-weight: 600;
  padding: 0 24px;
}
</style>
