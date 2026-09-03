<script setup lang="ts">
import { ArrowLeftOutlined, CheckOutlined, KeyOutlined } from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/api/client'
import { marketplaceApi } from '@/api/portal'
import { catalogItem } from '@/catalog'
import { useMessageStore } from '@/stores/message'
import type { CatalogEntry, UpstreamAggregation } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'

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
const applying = ref(false)
const applyForm = reactive({
  grantedColumns: [] as string[],
  columnInput: '',
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
  applyForm.grantedColumns = []
  applyForm.columnInput = ''
  applyOpen.value = true
}

function addColumn() {
  const col = applyForm.columnInput.trim()
  if (col && !applyForm.grantedColumns.includes(col)) {
    applyForm.grantedColumns.push(col)
    applyForm.columnInput = ''
  }
}

function removeColumn(col: string) {
  applyForm.grantedColumns = applyForm.grantedColumns.filter((c) => c !== col)
}

async function submitApply() {
  applying.value = true
  try {
    const res = await marketplaceApi.apply(code.value, {
      grantedColumns: applyForm.grantedColumns.length > 0 ? applyForm.grantedColumns : undefined,
    })
    messageStore.success(t('marketplace.applySuccess', { code: res.approvalCode }))
    applyOpen.value = false
    void router.push('/personal')
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    applying.value = false
  }
}

onMounted(loadDetail)
</script>

<template>
  <div class="marketplace-detail-view">
    <PageHeader
      :eyebrow="t('menu.marketplace')"
      :title="service?.name ?? t('marketplace.detailTitle')"
      :description="t('marketplace.detailPageDesc')"
      :status="service ? 'success' : undefined"
      :status-label="service ? service.status : undefined"
    />
    <a-card :bordered="false" class="detail-card">
      <template #title>
        <a-space>
          <a-button type="link" @click="router.push('/data-workbench')">
            <template #icon><ArrowLeftOutlined /></template>
            {{ t('marketplace.backToList') }}
          </a-button>
          <span class="detail-title">{{ t('marketplace.detailTitle') }}</span>
        </a-space>
      </template>

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
              <h2 class="service-name">{{ service.name }}</h2>
              <a-space wrap>
                <span class="mono-badge">{{ service.code }}</span>
                <a-tag :color="service.status === 'PUBLISHED' || service.status === 'ONLINE' ? 'success' : 'default'">
                  {{ service.status }}
                </a-tag>
                <a-tag color="blue">v{{ service.currentVersion }}</a-tag>
                <a-tag v-if="service.classification" color="orange">{{ service.classification }}</a-tag>
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
            <a-descriptions-item :label="t('common.status')">{{ service.status }}</a-descriptions-item>
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

    <!-- 申请授权弹窗 -->
    <a-modal
      v-model:open="applyOpen"
      :title="t('marketplace.applyModal')"
      :confirm-loading="applying"
      width="560px"
      @ok="submitApply"
    >
      <a-form layout="vertical">
        <a-form-item :label="t('common.name')">
          <a-input :value="service?.name" disabled />
        </a-form-item>
        <a-form-item :label="t('common.stableCode')">
          <a-input :value="service?.code" disabled />
        </a-form-item>
        <a-form-item
          :label="t('marketplace.grantedColumns')"
          :extra="t('marketplace.grantedColumnsPlaceholder')"
        >
          <a-input
            v-model:value="applyForm.columnInput"
            placeholder="如 id, name, created_at（回车添加）"
            @press-enter.prevent="addColumn"
          >
            <template #suffix>
              <a-button type="link" size="small" :disabled="!applyForm.columnInput.trim()" @click="addColumn">
                <template #icon><CheckOutlined /></template>
              </a-button>
            </template>
          </a-input>

          <div v-if="applyForm.grantedColumns.length > 0" style="margin-top: 8px">
            <a-tag
              v-for="col in applyForm.grantedColumns"
              :key="col"
              closable
              color="blue"
              @close="removeColumn(col)"
            >
              {{ col }}
            </a-tag>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.detail-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: var(--od-shadow-1);
}

.detail-title {
  font-size: 16px;
  font-weight: 650;
  color: var(--od-gray-900, #0f172a);
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding: 8px 0;
}

.service-name {
  margin: 0 0 8px 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--od-gray-900, #0f172a);
  letter-spacing: -0.01em;
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
