<script setup lang="ts">
import { ArrowLeftOutlined, CheckOutlined, KeyOutlined } from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { marketplaceApi } from '@/api/portal'
import { catalogItem } from '@/catalog'
import { useMessageStore } from '@/stores/message'
import type { CatalogEntry, UpstreamAggregation } from '@/types/portal'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const messageStore = useMessageStore()

const code = computed(() => String(route.params.code ?? ''))

const loading = ref(false)
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
  try {
    const res = await marketplaceApi.find(code.value)
    aggregation.value = res
    service.value = catalogItem(res, code.value)
  } catch (error) {
    messageStore.reportError(error)
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
    router.push('/personal')
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
    <a-card :bordered="false" class="detail-card">
      <template #title>
        <a-space>
          <a-button type="link" @click="router.push('/marketplace')">
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
          style="margin-bottom: 16px"
          :message="aggregation.message ?? t('marketplace.unavailable')"
          :description="t('marketplace.description')"
        />

        <template v-if="service">
          <div class="service-header">
            <div class="service-title-area">
              <h2 class="service-name">{{ service.name }}</h2>
              <a-space>
                <a-tag color="blue">{{ service.code }}</a-tag>
                <a-tag :color="service.status === 'PUBLISHED' || service.status === 'ONLINE' ? 'success' : 'default'">
                  {{ service.status }}
                </a-tag>
                <a-tag color="purple">v{{ service.currentVersion }}</a-tag>
              </a-space>
            </div>

            <div class="service-actions">
              <a-button
                type="primary"
                size="large"
                :disabled="!aggregation?.available"
                @click="openApplyModal"
              >
                <template #icon><KeyOutlined /></template>
                {{ t('marketplace.applyButton') }}
              </a-button>
            </div>
          </div>

          <a-divider />

          <a-descriptions :title="t('marketplace.details')" bordered :column="2" size="middle">
            <a-descriptions-item :label="t('common.stableCode')">{{ service.code }}</a-descriptions-item>
            <a-descriptions-item :label="t('common.name')">{{ service.name }}</a-descriptions-item>
            <a-descriptions-item :label="t('common.currentVersion')">{{ service.currentVersion }}</a-descriptions-item>
            <a-descriptions-item :label="t('common.status')">{{ service.status }}</a-descriptions-item>
            <a-descriptions-item v-if="service.description" :label="t('scenarios.description')" :span="2">
              {{ service.description }}
            </a-descriptions-item>
          </a-descriptions>
        </template>
        <template v-else-if="!loading && aggregation?.available">
          <a-empty :description="t('marketplace.unavailable')" />
        </template>
      </a-spin>
    </a-card>

    <!-- 申请授权弹窗 -->
    <a-modal
      v-model:open="applyOpen"
      :title="t('marketplace.applyModal')"
      :confirm-loading="applying"
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
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.detail-title {
  font-size: 16px;
  font-weight: 600;
}

.service-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.service-name {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.85);
}
</style>
