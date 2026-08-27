<script setup lang="ts">
import { PlayCircleOutlined } from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { workbenchApi } from '@/api/portal'
import { catalogItems, catalogTotal } from '@/catalog'
import { useMessageStore } from '@/stores/message'
import type { CatalogEntry, UpstreamAggregation } from '@/types/portal'

const { t } = useI18n()
const router = useRouter()
const messageStore = useMessageStore()

const capabilityLoading = ref(false)
const capabilityAggregation = ref<UpstreamAggregation | null>(null)
const capabilityRows = ref<CatalogEntry[]>([])
const capabilityTotal = ref(0)
const capabilityQuery = reactive({ page: 1, size: 20 })

const templateLoading = ref(false)
const templateAggregation = ref<UpstreamAggregation | null>(null)
const templateRows = ref<CatalogEntry[]>([])
const templateTotal = ref(0)
const templateQuery = reactive({ page: 1, size: 20 })

const capabilityColumns = computed(() => [
  { title: t('common.stableCode'), dataIndex: 'code', key: 'code', width: 200 },
  { title: t('common.name'), dataIndex: 'name', key: 'name' },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 120 },
  { title: t('common.currentVersion'), dataIndex: 'currentVersion', key: 'currentVersion', width: 120 },
])

const templateColumns = computed(() => [
  { title: t('common.stableCode'), dataIndex: 'code', key: 'code', width: 200 },
  { title: t('common.name'), dataIndex: 'name', key: 'name' },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 120 },
  { title: t('common.currentVersion'), dataIndex: 'currentVersion', key: 'currentVersion', width: 120 },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 140 },
])

async function loadCapabilities() {
  capabilityLoading.value = true
  try {
    capabilityAggregation.value = await workbenchApi.capabilities({
      page: capabilityQuery.page,
      size: capabilityQuery.size,
    })
    capabilityRows.value = catalogItems(capabilityAggregation.value)
    capabilityTotal.value = catalogTotal(capabilityAggregation.value)
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    capabilityLoading.value = false
  }
}

async function loadTemplates() {
  templateLoading.value = true
  try {
    templateAggregation.value = await workbenchApi.workflowTemplates({
      page: templateQuery.page,
      size: templateQuery.size,
    })
    templateRows.value = catalogItems(templateAggregation.value)
    templateTotal.value = catalogTotal(templateAggregation.value)
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    templateLoading.value = false
  }
}

function runTemplate(code: string) {
  router.push(`/workbench/templates/${encodeURIComponent(code)}`)
}

onMounted(() => {
  loadCapabilities()
  loadTemplates()
})
</script>

<template>
  <div class="workbench-view">
    <!-- 算法转换能力目录 -->
    <a-card :bordered="false" class="section-card" style="margin-bottom: 16px">
      <a-alert
        v-if="capabilityAggregation && !capabilityAggregation.available"
        type="warning"
        show-icon
        style="margin-bottom: 12px"
        :message="capabilityAggregation.message ?? t('workbench.capabilityUnavailable')"
        :description="t('workbench.capabilityDescription')"
      />

      <div class="card-title-bar">
        <h3 class="section-title">{{ t('workbench.capabilityTitle') }}</h3>
      </div>

      <a-table
        :columns="capabilityColumns"
        :data-source="capabilityRows"
        :loading="capabilityLoading"
        row-key="code"
        :pagination="{ current: capabilityQuery.page, pageSize: capabilityQuery.size, total: capabilityTotal }"
        @change="
          (pagination: { current?: number }) => {
            capabilityQuery.page = pagination.current ?? 1;
            loadCapabilities();
          }
        "
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 'ADMITTED' || record.status === 'ONLINE' ? 'success' : 'default'">
              {{ record.status }}
            </a-tag>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 工作流模板目录 -->
    <a-card :bordered="false" class="section-card">
      <a-alert
        v-if="templateAggregation && !templateAggregation.available"
        type="warning"
        show-icon
        style="margin-bottom: 12px"
        :message="templateAggregation.message ?? t('workbench.templateUnavailable')"
        :description="t('workbench.templateDescription')"
      />

      <div class="card-title-bar">
        <h3 class="section-title">{{ t('workbench.templateTitle') }}</h3>
      </div>

      <a-table
        :columns="templateColumns"
        :data-source="templateRows"
        :loading="templateLoading"
        row-key="code"
        :pagination="{ current: templateQuery.page, pageSize: templateQuery.size, total: templateTotal }"
        @change="
          (pagination: { current?: number }) => {
            templateQuery.page = pagination.current ?? 1;
            loadTemplates();
          }
        "
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === 'PUBLISHED' || record.status === 'ONLINE' ? 'success' : 'default'">
              {{ record.status }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button
              type="primary"
              size="small"
              :disabled="!templateAggregation?.available"
              @click="runTemplate(record.code)"
            >
              <template #icon><PlayCircleOutlined /></template>
              {{ t('workbench.runButton') }}
            </a-button>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<style scoped>
.section-card {
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.card-title-bar {
  margin-bottom: 12px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.85);
  margin: 0;
}
</style>
