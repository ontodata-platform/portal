<script setup lang="ts">
import { CheckCircleOutlined, CloseCircleOutlined, CopyOutlined, EyeOutlined, SyncOutlined } from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { taskApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { PortalTask } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import { formatDate, formatDateTime } from '@/ui-kit/format'
import OdTable from '@/ui-kit/OdTable.vue'
import { 中文展示 } from '@/ui-kit/展示文本'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const messageStore = useMessageStore()

const loading = ref(false)
const loadError = ref('')
const rows = ref<PortalTask[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, status: '', domain: '', type: '' })
const dateFilter = computed(() => (typeof route.query.date === 'string' ? route.query.date : ''))

const detailOpen = ref(false)
const detail = ref<PortalTask | null>(null)

const columns = computed(() => [
  { title: t('tasks.taskId'), dataIndex: 'taskId', key: 'taskId', width: 200, odEllipsis: true, odSortable: true },
  { title: t('common.type'), dataIndex: 'taskType', key: 'taskType', width: 140, odEllipsis: true, odSortable: true },
  { title: t('common.sourceSystem'), dataIndex: 'sourceSystem', key: 'sourceSystem', width: 150, odEllipsis: true, odSortable: true },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 120, odSortable: true },
  { title: t('common.progress'), dataIndex: 'progress', key: 'progress', width: 180, odSortable: true },
  { title: t('common.updatedAt'), dataIndex: 'updatedAt', key: 'updatedAt', width: 180, odSortable: true },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 100 },
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

function formatTime(value: string): string {
  return formatDateTime(value)
}

function describeLoadError(error: unknown): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  if (message) return message
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const page = await taskApi.list({
      page: query.page,
      size: query.size,
      status: query.status || undefined,
      domain: query.domain || undefined,
      type: query.type || undefined,
    })
    const items = dateFilter.value ? page.items.filter((item) => formatDate(item.updatedAt) === dateFilter.value) : page.items
    rows.value = items
    total.value = dateFilter.value ? items.length : page.total
  } catch (error) {
    loadError.value = describeLoadError(error)
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

function onQuickStatusFilter(val: string) {
  query.status = val
  query.page = 1
  void load()
}

function copyTaskId(id: string) {
  void navigator.clipboard.writeText(id)
  messageStore.success('任务标识已复制到剪贴板')
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
  <div class="task-section">
    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />

    <a-card v-else :bordered="false" class="task-card">
      <!-- 快捷过滤工具栏 -->
      <div class="toolbar-area">
        <div class="status-tabs">
          <button
            type="button"
            class="filter-pill"
            :class="{ active: !query.status }"
            @click="onQuickStatusFilter('')"
          >
            全部状态
          </button>
          <button
            type="button"
            class="filter-pill"
            :class="{ active: query.status === 'RUNNING' }"
            @click="onQuickStatusFilter('RUNNING')"
          >
            <SyncOutlined :spin="query.status === 'RUNNING'" />
            运行中
          </button>
          <button
            type="button"
            class="filter-pill"
            :class="{ active: query.status === 'SUCCESS' }"
            @click="onQuickStatusFilter('SUCCESS')"
          >
            <CheckCircleOutlined />
            成功
          </button>
          <button
            type="button"
            class="filter-pill"
            :class="{ active: query.status === 'FAILED' }"
            @click="onQuickStatusFilter('FAILED')"
          >
            <CloseCircleOutlined />
            失败
          </button>
        </div>

        <a-space wrap class="filter-inputs">
          <a-input
            v-model:value="query.domain"
            :placeholder="t('tasks.domainPlaceholder')"
            style="width: 160px"
            allow-clear
            @press-enter="query.page = 1; load()"
          />
          <a-input
            v-model:value="query.type"
            :placeholder="t('tasks.typePlaceholder')"
            style="width: 180px"
            allow-clear
            @press-enter="query.page = 1; load()"
          />
          <a-button
            type="primary"
            @click="
              query.page = 1;
              load();
            "
          >
            {{ t('common.query') }}
          </a-button>
        </a-space>
      </div>

      <a-alert
        v-if="dateFilter"
        type="info"
        show-icon
        class="date-filter-hint"
        :message="`正在查看 ${dateFilter} 更新的任务`"
        closable
        @close="router.push('/personal/tasks')"
      />

      <EmptyState
        v-if="!loading && rows.length === 0"
        :title="t('tasks.emptyTitle')"
        :description="t('tasks.emptyDesc')"
        :action-label="t('menu.personal')"
        @action="router.push('/personal')"
      />

      <OdTable
        v-else
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        row-key="taskId"
        class="task-table"
        :pagination="{ current: query.page, pageSize: query.size, total, showTotal: (tot: number) => `共 ${tot} 项` }"
        @change="
          (pagination: { current?: number }) => {
            query.page = pagination.current ?? 1;
            load();
          }
        "
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'taskId'">
            <div class="task-id-cell">
              <span class="task-id-text">{{ record.taskId }}</span>
              <button
                type="button"
                class="icon-btn"
                title="复制标识"
                @click.stop="copyTaskId(record.taskId)"
              >
                <CopyOutlined />
              </button>
            </div>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColor[record.status]" class="status-tag">
              <template #icon>
                <SyncOutlined v-if="record.status === 'RUNNING'" spin />
                <CheckCircleOutlined v-else-if="record.status === 'SUCCESS'" />
                <CloseCircleOutlined v-else-if="record.status === 'FAILED'" />
              </template>
              {{ 中文展示(record.status) }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'taskType'">
            {{ 中文展示(record.taskType) }}
          </template>

          <template v-else-if="column.key === 'sourceSystem'">
            {{ 中文展示(record.sourceSystem) }}
          </template>

          <template v-else-if="column.key === 'progress'">
            <div class="progress-cell">
              <a-progress
                :percent="record.progress"
                :status="record.status === 'FAILED' ? 'exception' : record.status === 'SUCCESS' ? 'success' : 'active'"
                size="small"
              />
              <span v-if="record.stage" class="stage-hint">{{ record.stage }}</span>
            </div>
          </template>

          <template v-else-if="column.key === 'updatedAt'">
            <span class="time-text">{{ formatTime(record.updatedAt) }}</span>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-button size="small" type="link" @click="openDetail(record)">
              <template #icon><EyeOutlined /></template>
              {{ t('common.detail') }}
            </a-button>
          </template>
        </template>
      </OdTable>

      <!-- 任务详情抽屉/弹窗 -->
      <a-modal v-model:open="detailOpen" :title="t('tasks.detailModal')" :footer="null" width="680px">
        <a-descriptions
          v-if="detail"
          :column="2"
          bordered
          size="middle"
          class="task-desc"
        >
          <a-descriptions-item :label="t('tasks.taskId')" :span="2">
            <span class="mono-text">{{ detail.taskId }}</span>
          </a-descriptions-item>
          <a-descriptions-item :label="t('common.type')">{{ 中文展示(detail.taskType) }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.sourceSystem')">{{ 中文展示(detail.sourceSystem) }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.status')">
            <a-tag :color="statusColor[detail.status]">{{ 中文展示(detail.status) }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item :label="t('tasks.stage')">{{ detail.stage ?? '-' }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.progress')" :span="2">
            <a-progress :percent="detail.progress" />
          </a-descriptions-item>
          <a-descriptions-item :label="t('tasks.resourceRefs')" :span="2">
            <span v-if="detail.resourceRefs.length > 0">{{ detail.resourceRefs.join('、') }}</span>
            <span v-else class="text-muted">无</span>
          </a-descriptions-item>
          <a-descriptions-item :label="t('tasks.resultRefs')" :span="2">
            <span v-if="detail.resultRefs.length > 0">{{ detail.resultRefs.join('、') }}</span>
            <span v-else class="text-muted">无</span>
          </a-descriptions-item>
          <a-descriptions-item :label="t('tasks.traceId')" :span="2">
            <span class="mono-text">{{ detail.traceId ?? '-' }}</span>
          </a-descriptions-item>
          <a-descriptions-item :label="t('common.updatedAt')" :span="2">
            {{ formatTime(detail.updatedAt) }}
          </a-descriptions-item>
        </a-descriptions>
      </a-modal>
    </a-card>
  </div>
</template>

<style scoped>
.task-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: var(--od-shadow-1);
}

.toolbar-area {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.status-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--od-gray-100, #f1f5f9);
  padding: 4px;
  border-radius: 8px;
}

.filter-pill {
  border: 0;
  background: transparent;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--od-gray-600, #475569);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.filter-pill:hover {
  color: var(--od-gray-900, #0f172a);
}

.filter-pill.active {
  background: #ffffff;
  color: var(--od-color-primary, #1e40af);
  font-weight: 600;
  box-shadow: var(--od-shadow-xs);
}

.task-id-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.task-id-text {
  font-family: var(--od-font-mono, monospace);
  font-weight: 600;
  font-size: 13px;
  color: var(--od-gray-900, #0f172a);
}

.icon-btn {
  border: 0;
  background: transparent;
  padding: 2px 4px;
  color: var(--od-gray-500, #64748b);
  cursor: pointer;
  border-radius: 4px;
}

.icon-btn:hover {
  color: var(--od-color-accent, #2563eb);
  background: var(--od-gray-100, #f1f5f9);
}

.status-tag {
  font-weight: 500;
  border-radius: 4px;
}

.progress-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stage-hint {
  font-size: 11px;
  color: var(--od-gray-500, #64748b);
}

.time-text {
  font-size: 13px;
  color: var(--od-gray-500, #64748b);
}

.mono-text {
  font-family: var(--od-font-mono, monospace);
}

.text-muted {
  color: var(--od-gray-500, #64748b);
}
</style>
