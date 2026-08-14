<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { workbenchApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { CatalogEntry, UpstreamAggregation } from '@/types/portal'

const { t } = useI18n()
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

const columns = computed(() => [
  { title: t('common.stableCode'), dataIndex: 'code', key: 'code' },
  { title: t('common.name'), dataIndex: 'name', key: 'name' },
  { title: t('common.status'), dataIndex: 'status', key: 'status' },
  { title: t('common.currentVersion'), dataIndex: 'currentVersion', key: 'currentVersion' },
])

async function loadCapabilities() {
  capabilityLoading.value = true
  try {
    capabilityAggregation.value = await workbenchApi.capabilities({
      page: capabilityQuery.page,
      size: capabilityQuery.size,
    })
    capabilityRows.value = capabilityAggregation.value.available
      ? capabilityAggregation.value.body?.items ?? []
      : []
    capabilityTotal.value = capabilityAggregation.value.available
      ? capabilityAggregation.value.body?.total ?? 0
      : 0
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
    templateRows.value = templateAggregation.value.available
      ? templateAggregation.value.body?.items ?? []
      : []
    templateTotal.value = templateAggregation.value.available
      ? templateAggregation.value.body?.total ?? 0
      : 0
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    templateLoading.value = false
  }
}

onMounted(() => {
  loadCapabilities()
  loadTemplates()
})
</script>

<template>
  <a-card>
    <a-alert
      v-if="capabilityAggregation && !capabilityAggregation.available"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      :message="capabilityAggregation.message ?? t('workbench.capabilityUnavailable')"
      :description="t('workbench.capabilityDescription')"
    />

    <a-card :title="t('workbench.capabilityTitle')" size="small" :bordered="false" style="margin-bottom: 16px">
      <a-table
        :columns="columns"
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
      />
    </a-card>

    <a-alert
      v-if="templateAggregation && !templateAggregation.available"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
      :message="templateAggregation.message ?? t('workbench.templateUnavailable')"
      :description="t('workbench.templateDescription')"
    />

    <a-card :title="t('workbench.templateTitle')" size="small" :bordered="false">
      <a-table
        :columns="columns"
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
      />
    </a-card>
  </a-card>
</template>
