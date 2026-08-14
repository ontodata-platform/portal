<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import { resultApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { PortalResult } from '@/types/portal'

const messageStore = useMessageStore()

const loading = ref(false)
const rows = ref<PortalResult[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, type: '', domain: '', keyword: '' })

const registerOpen = ref(false)
const registering = ref(false)
const registerForm = reactive({
  sourceSystem: 'data-platform',
  resultId: '',
  resultType: 'DATASET',
  sourceTaskId: '',
})

const detailOpen = ref(false)
const detail = ref<PortalResult | null>(null)

const columns = [
  { title: '结果标识', dataIndex: 'resultId', key: 'resultId' },
  { title: '来源系统', dataIndex: 'sourceSystem', key: 'sourceSystem' },
  { title: '类型', dataIndex: 'resultType', key: 'resultType' },
  { title: '关联任务', dataIndex: 'sourceTaskId', key: 'sourceTaskId' },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt' },
  { title: '操作', dataIndex: 'action', key: 'action' },
]

async function load() {
  loading.value = true
  try {
    const page = await resultApi.list({
      page: query.page,
      size: query.size,
      type: query.type || undefined,
      domain: query.domain || undefined,
      keyword: query.keyword || undefined,
    })
    rows.value = page.items
    total.value = page.total
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

async function register() {
  registering.value = true
  try {
    await resultApi.register(registerForm.sourceSystem, registerForm.resultId, {
      resultType: registerForm.resultType,
      sourceTaskId: registerForm.sourceTaskId || undefined,
    })
    messageStore.success('结果引用登记成功（来源系统与结果标识在路径上，可追踪率 100%）')
    registerOpen.value = false
    registerForm.resultId = ''
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    registering.value = false
  }
}

async function openDetail(record: PortalResult) {
  try {
    detail.value = await resultApi.find(record.sourceSystem, record.resultId)
    detailOpen.value = true
  } catch (error) {
    messageStore.reportError(error)
  }
}

onMounted(load)
</script>

<template>
  <a-card>
    <a-space style="margin-bottom: 12px" wrap>
      <a-input v-model:value="query.domain" placeholder="来源系统（如 data-platform）" style="width: 200px" />
      <a-input v-model:value="query.type" placeholder="结果类型（大写，如 DATASET）" style="width: 220px" />
      <a-input v-model:value="query.keyword" placeholder="按结果标识搜索" style="width: 180px" />
      <a-button
        type="primary"
        @click="
          query.page = 1;
          load()
        "
      >
        查询
      </a-button>
      <a-button @click="registerOpen = true">登记结果</a-button>
    </a-space>

    <a-table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      row-key="resultId"
      :pagination="{ current: query.page, pageSize: query.size, total }"
      @change="
        (pagination: { current?: number }) => {
          query.page = pagination.current ?? 1;
          load();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'updatedAt'">
          {{ new Date(record.updatedAt).toLocaleString('zh-CN') }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button size="small" @click="openDetail(record)">详情</a-button>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="registerOpen" title="登记结果引用" :confirm-loading="registering" @ok="register">
      <a-form layout="vertical">
        <a-form-item label="来源系统" required>
          <a-select v-model:value="registerForm.sourceSystem">
            <a-select-option value="data-platform">data-platform</a-select-option>
            <a-select-option value="algorithm-transform">algorithm-transform</a-select-option>
            <a-select-option value="algorithm-recombine">algorithm-recombine</a-select-option>
            <a-select-option value="ontology-platform">ontology-platform</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="结果标识" required>
          <a-input v-model:value="registerForm.resultId" placeholder="源软件生成的结果标识（如 ds-xxxxxxxx）" />
        </a-form-item>
        <a-form-item label="结果类型" required>
          <a-select v-model:value="registerForm.resultType">
            <a-select-option value="DATASET">DATASET</a-select-option>
            <a-select-option value="REPORT">REPORT</a-select-option>
            <a-select-option value="EXECUTION_OUTPUT">EXECUTION_OUTPUT</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="关联任务标识">
          <a-input v-model:value="registerForm.sourceTaskId" placeholder="统一任务中心的任务标识（可空）" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="detailOpen" title="结果详情" :footer="null" width="640px">
      <a-descriptions v-if="detail" :column="1" bordered size="small">
        <a-descriptions-item label="结果标识">{{ detail.resultId }}</a-descriptions-item>
        <a-descriptions-item label="来源系统">{{ detail.sourceSystem }}</a-descriptions-item>
        <a-descriptions-item label="类型">{{ detail.resultType }}</a-descriptions-item>
        <a-descriptions-item label="资源引用">{{ detail.resourceRefs.join('、') || '-' }}</a-descriptions-item>
        <a-descriptions-item label="元数据">{{ JSON.stringify(detail.metadata) || '-' }}</a-descriptions-item>
        <a-descriptions-item label="关联任务">{{ detail.sourceTaskId ?? '-' }}</a-descriptions-item>
        <a-descriptions-item label="链路标识">{{ detail.traceId ?? '-' }}</a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </a-card>
</template>
