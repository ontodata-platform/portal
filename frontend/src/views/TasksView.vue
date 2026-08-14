<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { taskApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { PortalTask } from '@/types/portal'

const { t, locale } = useI18n()
const messageStore = useMessageStore()

const loading = ref(false)
const rows = ref<PortalTask[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, status: '', domain: '', type: '' })

const detailOpen = ref(false)
const detail = ref<PortalTask | null>(null)

const columns = computed(() => [
  { title: t('tasks.taskId'), dataIndex: 'taskId', key: 'taskId' },
  { title: t('common.type'), dataIndex: 'taskType', key: 'taskType' },
  { title: t('common.sourceSystem'), dataIndex: 'ownerSystem', key: 'ownerSystem' },
  { title: t('common.status'), dataIndex: 'status', key: 'status' },
  { title: t('common.progress'), dataIndex: 'progress', key: 'progress' },
  { title: t('common.updatedAt'), dataIndex: 'updatedAt', key: 'updatedAt' },
  { title: t('common.action'), dataIndex: 'action', key: 'action' },
])

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

/** 日期时间按当前界面语言格式化（M5 国际化）。 */
function formatTime(value: string): string {
  return new Date(value).toLocaleString(locale.value)
}

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
      <a-select v-model:value="query.status" :placeholder="t('tasks.statusPlaceholder')" allow-clear style="width: 140px">
        <a-select-option value="PENDING">PENDING</a-select-option>
        <a-select-option value="RUNNING">RUNNING</a-select-option>
        <a-select-option value="SUCCESS">SUCCESS</a-select-option>
        <a-select-option value="FAILED">FAILED</a-select-option>
      </a-select>
      <a-input v-model:value="query.domain" :placeholder="t('tasks.domainPlaceholder')" style="width: 200px" />
      <a-input v-model:value="query.type" :placeholder="t('tasks.typePlaceholder')" style="width: 220px" />
      <a-button
        type="primary"
        @click="
          query.page = 1;
          load()
        "
      >
        {{ t('common.query') }}
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
          {{ formatTime(record.updatedAt) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button size="small" @click="openDetail(record)">{{ t('common.detail') }}</a-button>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="detailOpen" :title="t('tasks.detailModal')" :footer="null" width="640px">
      <a-descriptions v-if="detail" :column="1" bordered size="small">
        <a-descriptions-item :label="t('tasks.taskId')">{{ detail.taskId }}</a-descriptions-item>
        <a-descriptions-item :label="t('common.type')">{{ detail.taskType }}</a-descriptions-item>
        <a-descriptions-item :label="t('common.sourceSystem')">{{ detail.ownerSystem }}</a-descriptions-item>
        <a-descriptions-item :label="t('common.status')">{{ detail.status }}</a-descriptions-item>
        <a-descriptions-item :label="t('tasks.stage')">{{ detail.stage ?? '-' }}</a-descriptions-item>
        <a-descriptions-item :label="t('common.progress')">{{ detail.progress }}%</a-descriptions-item>
        <a-descriptions-item :label="t('tasks.resourceRefs')">{{ detail.resourceRefs.join('、') || '-' }}</a-descriptions-item>
        <a-descriptions-item :label="t('tasks.resultRefs')">{{ detail.resultRefs.join('、') || '-' }}</a-descriptions-item>
        <a-descriptions-item :label="t('tasks.traceId')">{{ detail.traceId ?? '-' }}</a-descriptions-item>
        <a-descriptions-item :label="t('common.updatedAt')">{{ formatTime(detail.updatedAt) }}</a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </a-card>
</template>
