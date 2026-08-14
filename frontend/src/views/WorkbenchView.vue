<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import { workbenchApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { CatalogEntry, UpstreamAggregation } from '@/types/portal'

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

const columns = [
  { title: '稳定编码', dataIndex: 'code', key: 'code' },
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '当前版本', dataIndex: 'currentVersion', key: 'currentVersion' },
]

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
      :message="capabilityAggregation.message ?? '算法转换工具能力目录不可用'"
      description="能力引用与准入由重组平台发布校验把关；此处仅为目录展示。"
    />

    <a-card title="能力目录（算法转换工具）" size="small" :bordered="false" style="margin-bottom: 16px">
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
      :message="templateAggregation.message ?? '算法重组平台工作流模板目录不可用'"
      description="编排与执行请在算法重组平台工作台办理；此处仅为目录展示。"
    />

    <a-card title="工作流模板（算法重组平台）" size="small" :bordered="false">
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
