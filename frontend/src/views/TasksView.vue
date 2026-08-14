<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import { taskApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { PortalTask } from '@/types/portal'

const messageStore = useMessageStore()

const loading = ref(false)
const rows = ref<PortalTask[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, status: '', domain: '', type: '' })

const detailOpen = ref(false)
const detail = ref<PortalTask | null>(null)

const columns = [
  { title: '任务标识', dataIndex: 'taskId', key: 'taskId' },
  { title: '类型', dataIndex: 'taskType', key: 'taskType' },
  { title: '来源系统', dataIndex: 'ownerSystem', key: 'ownerSystem' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '进度', dataIndex: 'progress', key: 'progress' },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt' },
  { title: '操作', dataIndex: 'action', key: 'action' },
]

const statusColor = computed(
  () =>
    ({
      PENDING: 'default',
      RUNNING: 'processing',
      SUCCESS: 'success',
      FAILED: 'error',
      CANCELED: 'default',
    }) as Record<string, string>,
)

async function load() {
  loading.value = true
  try {
    const page = await taskApi.list({
      page: query.page,
      size: query.size,
      status: query.status || undefined,
      domain: query.domain || undefined,
      type: query.type || undefined,
    })
    rows.value = page.items
    total.value = page.total
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

async function openDetail(record: PortalTask) {
  try {
    detail.value = await taskApi.find(record.taskId)
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
      <a-select v-model:value="query.status" placeholder="状态" allow-clear style="width: 140px">
        <a-select-option value="PENDING">PENDING</a-select-option>
        <a-select-option value="RUNNING">RUNNING</a-select-option>
        <a-select-option value="SUCCESS">SUCCESS</a-select-option>
        <a-select-option value="FAILED">FAILED</a-select-option>
      </a-select>
      <a-input v-model:value="query.domain" placeholder="来源系统（如 recombine）" style="width: 200px" />
      <a-input v-model:value="query.type" placeholder="任务类型（大写，如 DATA_INGEST）" style="width: 220px" />
      <a-button
        type="primary"
        @click="
          query.page = 1;
          load()
        "
      >
        查询
      </a-button>
    </a-space>

    <a-table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      row-key="taskId"
      :pagination="{ current: query.page, pageSize: query.size, total }"
      @change="
        (pagination: { current?: number }) => {
          query.page = pagination.current ?? 1;
          load();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="statusColor[record.status]">{{ record.status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'progress'">
          <a-progress :percent="record.progress" size="small" />
        </template>
        <template v-else-if="column.key === 'updatedAt'">
          {{ new Date(record.updatedAt).toLocaleString('zh-CN') }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button size="small" @click="openDetail(record)">详情</a-button>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="detailOpen" title="任务详情" :footer="null" width="640px">
      <a-descriptions v-if="detail" :column="1" bordered size="small">
        <a-descriptions-item label="任务标识">{{ detail.taskId }}</a-descriptions-item>
        <a-descriptions-item label="类型">{{ detail.taskType }}</a-descriptions-item>
        <a-descriptions-item label="来源系统">{{ detail.ownerSystem }}</a-descriptions-item>
        <a-descriptions-item label="状态">{{ detail.status }}</a-descriptions-item>
        <a-descriptions-item label="阶段">{{ detail.stage ?? '-' }}</a-descriptions-item>
        <a-descriptions-item label="进度">{{ detail.progress }}%</a-descriptions-item>
        <a-descriptions-item label="资源引用">{{ detail.resourceRefs.join('、') || '-' }}</a-descriptions-item>
        <a-descriptions-item label="结果引用">{{ detail.resultRefs.join('、') || '-' }}</a-descriptions-item>
        <a-descriptions-item label="链路标识">{{ detail.traceId ?? '-' }}</a-descriptions-item>
        <a-descriptions-item label="更新时间">{{ new Date(detail.updatedAt).toLocaleString('zh-CN') }}</a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </a-card>
</template>
