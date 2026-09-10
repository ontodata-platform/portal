<script setup lang="ts">
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { approvalApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { ApprovalRequest } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import OdTable from '@/ui-kit/OdTable.vue'
import { 中文展示 } from '@/ui-kit/展示文本'

const { t } = useI18n()
const router = useRouter()
const messageStore = useMessageStore()

const loading = ref(false)
const loadError = ref('')
const rows = ref<ApprovalRequest[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, status: '', type: '', sla: '', keyword: '' })
const stats = reactive({ pending: 0, overdue: 0, decidedToday: 0 })

const drawerOpen = ref(false)
const current = ref<ApprovalRequest | null>(null)
const nudging = ref(false)

const columns = computed(() => [
  { title: t('common.code'), dataIndex: 'code', key: 'code', width: 150, odEllipsis: true, odSortable: true },
  { title: t('common.type'), dataIndex: 'approvalType', key: 'approvalType', width: 130, odEllipsis: true, odSortable: true },
  { title: t('common.title'), dataIndex: 'title', key: 'title', width: 220, odEllipsis: true, odSortable: true },
  { title: t('common.applicant'), dataIndex: 'requester', key: 'requester', width: 110, odEllipsis: true, odSortable: true },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 110, odSortable: true },
  { title: t('approvals.slaStatus'), dataIndex: 'slaStatus', key: 'slaStatus', width: 110, odSortable: true },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 160 },
])

const statusColor: Record<string, string> = {
  PENDING: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
}

const statusText = computed(
  () =>
    ({
      PENDING: t('approvals.pendingApproval'),
      APPROVED: t('approvals.approved'),
      REJECTED: t('approvals.rejected'),
    }) as Record<string, string>,
)

const typeLabel = computed(
  () =>
    ({
      DATA_GRANT: t('approvals.dataGrant'),
      R4_TOOL_CALL: t('approvals.r4ToolCall'),
      SYSTEM_PERMISSION: t('approvals.systemPermission'),
    }) as Record<string, string>,
)

function slaText(status?: string) {
  if (status === 'OVERDUE') return t('approvals.slaOverdue')
  if (status === 'DUE_SOON') return t('approvals.slaDueSoon')
  if (status === 'ON_TIME') return t('approvals.slaOnTime')
  if (status === 'MET') return t('approvals.slaMet')
  if (status === 'MISSED') return t('approvals.slaMissed')
  return t('approvals.slaNone')
}

function slaColor(status?: string) {
  if (status === 'OVERDUE' || status === 'MISSED') return 'error'
  if (status === 'DUE_SOON') return 'warning'
  if (status === 'ON_TIME' || status === 'MET') return 'success'
  return 'default'
}

function isToday(iso?: string) {
  if (!iso) return false
  const date = new Date(iso)
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
}

function describeLoadError(error: unknown): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  if (message) return message
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

function applyStats(items: ApprovalRequest[]) {
  stats.pending = items.filter((item) => item.status === 'PENDING').length
  stats.overdue = items.filter((item) => item.slaStatus === 'OVERDUE').length
  stats.decidedToday = items.filter(
    (item) => (item.status === 'APPROVED' || item.status === 'REJECTED') && isToday(item.decisionAt ?? item.updatedAt),
  ).length
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [page, all] = await Promise.all([
      approvalApi.list({
        page: query.page,
        size: query.size,
        status: query.status || undefined,
        type: query.type || undefined,
        sla: query.sla || undefined,
        keyword: query.keyword || undefined,
      }),
      approvalApi.list({ page: 1, size: 200 }),
    ])
    rows.value = page.items
    total.value = page.total
    applyStats(all.items)
  } catch (error) {
    loadError.value = describeLoadError(error)
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

function openDetail(record: ApprovalRequest) {
  current.value = record
  drawerOpen.value = true
}

async function nudge(record: ApprovalRequest) {
  if (record.status !== 'PENDING') return
  nudging.value = true
  try {
    await approvalApi.nudge(record.code)
    messageStore.success(t('admin.approvals.nudged', { code: record.code }))
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    nudging.value = false
  }
}

function openInWorkbench(code: string) {
  void router.push({ path: '/personal/approvals', query: { code } })
}

onMounted(load)
</script>

<template>
  <div class="approval-admin-view">
    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />

    <div v-else class="approval-body">
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-label">{{ t('admin.approvals.pending') }}</span>
          <span class="stat-value">{{ stats.pending }}</span>
        </div>
        <div class="stat-card" :class="{ urgent: stats.overdue > 0 }">
          <span class="stat-label">{{ t('admin.approvals.overdue') }}</span>
          <span class="stat-value">{{ stats.overdue }}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">{{ t('admin.approvals.decidedToday') }}</span>
          <span class="stat-value">{{ stats.decidedToday }}</span>
        </div>
      </div>

      <a-card :bordered="false" class="admin-card">
        <div class="toolbar-area">
          <a-space wrap>
            <a-select v-model:value="query.status" :placeholder="t('common.status')" allow-clear style="width: 130px">
              <a-select-option value="PENDING">{{ t('approvals.pendingApproval') }}</a-select-option>
              <a-select-option value="APPROVED">{{ t('approvals.approved') }}</a-select-option>
              <a-select-option value="REJECTED">{{ t('approvals.rejected') }}</a-select-option>
            </a-select>
            <a-select v-model:value="query.type" :placeholder="t('common.type')" allow-clear style="width: 150px">
              <a-select-option value="DATA_GRANT">{{ t('approvals.dataGrant') }}</a-select-option>
              <a-select-option value="R4_TOOL_CALL">{{ t('approvals.r4ToolCall') }}</a-select-option>
              <a-select-option value="SYSTEM_PERMISSION">{{ t('approvals.systemPermission') }}</a-select-option>
            </a-select>
            <a-select v-model:value="query.sla" :placeholder="t('admin.approvals.slaPlaceholder')" allow-clear style="width: 120px">
              <a-select-option value="ON_TIME">{{ t('approvals.slaOnTime') }}</a-select-option>
              <a-select-option value="DUE_SOON">{{ t('approvals.slaDueSoon') }}</a-select-option>
              <a-select-option value="OVERDUE">{{ t('approvals.slaOverdue') }}</a-select-option>
              <a-select-option value="MET">{{ t('approvals.slaMet') }}</a-select-option>
              <a-select-option value="MISSED">{{ t('approvals.slaMissed') }}</a-select-option>
            </a-select>
            <a-input
              v-model:value="query.keyword"
              :placeholder="t('admin.approvals.keywordPlaceholder')"
              style="width: 220px"
              allow-clear
              @press-enter="query.page = 1; load()"
            />
            <a-button type="primary" @click="query.page = 1; load()">
              <template #icon><SearchOutlined /></template>
              {{ t('common.query') }}
            </a-button>
          </a-space>
        </div>

        <EmptyState
          v-if="!loading && rows.length === 0"
          :title="t('admin.approvals.emptyTitle')"
          :description="t('admin.approvals.emptyDesc')"
        />

        <OdTable
          v-else
          :columns="columns"
          :data-source="rows"
          :loading="loading"
          row-key="code"
          :pagination="{ current: query.page, pageSize: query.size, total, showTotal: (tot: number) => `共 ${tot} 项` }"
          @change="
            (pagination: { current?: number }) => {
              query.page = pagination.current ?? 1
              load()
            }
          "
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'code'">
              <span class="mono-code">{{ record.code }}</span>
            </template>
            <template v-else-if="column.key === 'approvalType'">
              {{ typeLabel[record.approvalType] ?? record.approvalType }}
            </template>
            <template v-else-if="column.key === 'sourceSystem'">
              {{ 中文展示(record.sourceSystem) }}
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="statusColor[record.status]" class="status-tag">
                <template #icon>
                  <SyncOutlined v-if="record.status === 'PENDING'" spin />
                  <CheckCircleOutlined v-else-if="record.status === 'APPROVED'" />
                  <CloseCircleOutlined v-else-if="record.status === 'REJECTED'" />
                </template>
                {{ statusText[record.status] ?? record.status }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'slaStatus'">
              <a-tag :color="slaColor(record.slaStatus)">{{ slaText(record.slaStatus) }}</a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space size="small">
                <a-button
                  v-if="record.status === 'PENDING'"
                  size="small"
                  type="primary"
                  ghost
                  :loading="nudging"
                  @click="nudge(record)"
                >
                  {{ t('admin.approvals.nudge') }}
                </a-button>
                <a-button size="small" @click="openDetail(record)">
                  {{ t('admin.approvals.detail') }}
                </a-button>
              </a-space>
            </template>
          </template>
        </OdTable>
      </a-card>
    </div>

    <a-drawer v-model:open="drawerOpen" :title="current?.code ?? ''" width="480">
      <template v-if="current">
        <a-descriptions :column="1" size="small">
          <a-descriptions-item :label="t('common.title')">{{ current.title }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.type')">{{ typeLabel[current.approvalType] ?? current.approvalType }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.applicant')">{{ current.requester }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.sourceSystem')">{{ 中文展示(current.sourceSystem) }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.status')">{{ statusText[current.status] ?? current.status }}</a-descriptions-item>
          <a-descriptions-item :label="t('approvals.slaStatus')">{{ slaText(current.slaStatus) }}</a-descriptions-item>
          <a-descriptions-item :label="t('approvals.decisionBy')">{{ current.decisionBy || '—' }}</a-descriptions-item>
          <a-descriptions-item :label="t('approvals.decisionNote')">{{ current.decisionNote || '—' }}</a-descriptions-item>
        </a-descriptions>
      </template>
      <template #footer>
        <a-button v-if="current" type="link" @click="openInWorkbench(current.code)">
          {{ t('admin.approvals.openInWorkbench') }}
        </a-button>
      </template>
    </a-drawer>
  </div>
</template>

<style scoped>
.approval-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.stat-card {
  padding: 14px 18px;
  background: #fff;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: var(--od-radius-card, 12px);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-card.urgent .stat-value {
  color: #dc2626;
}

.stat-label {
  font-size: 13px;
  color: var(--od-gray-500, #64748b);
  font-weight: 500;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  font-family: var(--od-font-mono, monospace);
}

.admin-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: var(--od-shadow-1);
}

.toolbar-area {
  margin-bottom: 16px;
}

.mono-code {
  font-family: var(--od-font-mono, monospace);
  font-weight: 600;
}

.status-tag {
  font-weight: 500;
}
</style>
