<script setup lang="ts">
import {
  CheckCircleOutlined,
  CheckOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  SyncOutlined,
} from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { approvalApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { ApprovalRequest } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import { toIsoDateTime } from '@/ui-kit/format'
import OdTable from '@/ui-kit/OdTable.vue'
import { 中文展示 } from '@/ui-kit/展示文本'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const messageStore = useMessageStore()
const focusCode = ref('')

const loading = ref(false)
const loadError = ref('')
const rows = ref<ApprovalRequest[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, status: '', type: '' })

const createOpen = ref(false)
const creating = ref(false)
const createForm = reactive({
  approvalType: 'R4_TOOL_CALL',
  sourceSystem: 'mcp-gateway',
  sourceCode: '',
  title: '',
  slaDeadline: '',
})
const selectedCodes = ref<string[]>([])
const batching = ref(false)

const decideOpen = ref(false)
const deciding = ref(false)
const decideTarget = ref<ApprovalRequest | null>(null)
const decideForm = reactive({ decision: 'APPROVED' as 'APPROVED' | 'REJECTED', decisionNote: '' })

const columns = computed(() => [
  { title: t('common.code'), dataIndex: 'code', key: 'code', width: 140, odEllipsis: true, odSortable: true },
  { title: t('common.type'), dataIndex: 'approvalType', key: 'approvalType', width: 130, odEllipsis: true, odSortable: true },
  { title: t('common.sourceSystem'), dataIndex: 'sourceSystem', key: 'sourceSystem', width: 140, odEllipsis: true, odSortable: true },
  { title: t('common.title'), dataIndex: 'title', key: 'title', odEllipsis: true, odSortable: true },
  { title: t('common.applicant'), dataIndex: 'requester', key: 'requester', width: 120, odEllipsis: true, odSortable: true },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 110, odSortable: true },
  { title: t('approvals.slaStatus'), dataIndex: 'slaStatus', key: 'slaStatus', width: 110, odSortable: true },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 110 },
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
    const page = await approvalApi.list({
      page: query.page,
      size: query.size,
      status: query.status || undefined,
      type: query.type || undefined,
    })
    rows.value = page.items
    total.value = page.total
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

async function create() {
  creating.value = true
  try {
    await approvalApi.create({
      approvalType: createForm.approvalType,
      sourceSystem: createForm.sourceSystem,
      sourceCode: createForm.sourceCode || undefined,
      title: createForm.title,
      slaDeadline: toIsoDateTime(createForm.slaDeadline),
    })
    messageStore.success(t('approvals.created'))
    createOpen.value = false
    createForm.title = ''
    createForm.sourceCode = ''
    createForm.slaDeadline = ''
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    creating.value = false
  }
}

function openDecide(record: ApprovalRequest) {
  decideTarget.value = record
  decideForm.decision = 'APPROVED'
  decideForm.decisionNote = ''
  decideOpen.value = true
}

async function decide() {
  if (!decideTarget.value) {
    return
  }
  deciding.value = true
  try {
    await approvalApi.decide(decideTarget.value.code, {
      decision: decideForm.decision,
      decisionNote: decideForm.decisionNote || undefined,
    })
    messageStore.success(
      decideForm.decision === 'APPROVED'
        ? t('approvals.decidedApproved', { code: decideTarget.value.code })
        : t('approvals.decidedRejected', { code: decideTarget.value.code }),
    )
    decideOpen.value = false
    await load()
    if (route.query.from === 'agent' && decideTarget.value) {
      await router.push({ path: '/assistant', query: { resume: decideTarget.value.code } })
    }
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    deciding.value = false
  }
}

async function batchDecide(decision: 'APPROVED' | 'REJECTED') {
  if (selectedCodes.value.length === 0) {
    return
  }
  batching.value = true
  try {
    const result = await approvalApi.batchDecide({ codes: [...selectedCodes.value], decision })
    messageStore.success(
      t('approvals.batchDecided', { succeeded: result.succeeded.length, failed: result.failed.length }),
    )
    selectedCodes.value = []
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    batching.value = false
  }
}

function slaText(status?: string) {
  if (status === 'OVERDUE') return t('approvals.slaOverdue')
  if (status === 'ON_TIME') return t('approvals.slaOnTime')
  if (status === 'MET') return t('approvals.slaMet')
  if (status === 'MISSED') return t('approvals.slaMissed')
  return t('approvals.slaNone')
}

function onSelectChange(keys: (string | number)[]) {
  selectedCodes.value = keys.map(String)
}

onMounted(async () => {
  const code = typeof route.query.code === 'string' ? route.query.code : ''
  focusCode.value = code
  await load()
  if (!code) {
    return
  }
  try {
    const item = await approvalApi.find(code)
    if (item.status === 'PENDING') {
      openDecide(item)
    }
  } catch (error) {
    messageStore.reportError(error)
  }
})
</script>

<template>
  <div class="approval-section">
    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />

    <a-card v-else :bordered="false" class="approvals-card">
      <a-alert
        v-if="focusCode"
        type="info"
        show-icon
        class="focus-alert"
        :message="t('approvals.focusHint', { code: focusCode })"
      >
        <template #action>
          <a-button v-if="route.query.from === 'agent'" size="small" @click="router.push('/assistant')">
            {{ t('approvals.backToChat') }}
          </a-button>
        </template>
      </a-alert>

      <!-- 快速过滤与批量操作栏 -->
      <div class="toolbar-area">
        <div class="status-tabs">
          <button
            type="button"
            class="filter-pill"
            :class="{ active: !query.status }"
            @click="onQuickStatusFilter('')"
          >
            全部
          </button>
          <button
            type="button"
            class="filter-pill"
            :class="{ active: query.status === 'PENDING' }"
            @click="onQuickStatusFilter('PENDING')"
          >
            <ClockCircleOutlined />
            待我审批
          </button>
          <button
            type="button"
            class="filter-pill"
            :class="{ active: query.status === 'APPROVED' }"
            @click="onQuickStatusFilter('APPROVED')"
          >
            <CheckCircleOutlined />
            已通过
          </button>
          <button
            type="button"
            class="filter-pill"
            :class="{ active: query.status === 'REJECTED' }"
            @click="onQuickStatusFilter('REJECTED')"
          >
            <CloseCircleOutlined />
            已驳回
          </button>
        </div>

        <div class="action-buttons">
          <a-input
            v-model:value="query.type"
            :placeholder="t('approvals.typePlaceholder')"
            style="width: 180px"
            allow-clear
            @press-enter="query.page = 1; load()"
          />
          <a-button type="primary" ghost @click="query.page = 1; load()">
            {{ t('common.query') }}
          </a-button>
          <a-button type="dashed" @click="createOpen = true">
            <template #icon><PlusOutlined /></template>
            {{ t('approvals.createButton') }}
          </a-button>
        </div>
      </div>

      <!-- 批量处理横幅 (勾选时浮现) -->
      <transition name="batch-bar">
        <div v-if="selectedCodes.length > 0" class="batch-bar">
          <span class="batch-hint">已选中 <strong>{{ selectedCodes.length }}</strong> 项待办申请</span>
          <a-space>
            <a-button
              type="primary"
              size="small"
              :loading="batching"
              @click="batchDecide('APPROVED')"
            >
              <template #icon><CheckOutlined /></template>
              {{ t('approvals.batchApprove') }}
            </a-button>
            <a-button
              danger
              size="small"
              :loading="batching"
              @click="batchDecide('REJECTED')"
            >
              <template #icon><CloseOutlined /></template>
              {{ t('approvals.batchReject') }}
            </a-button>
            <a-button size="small" @click="selectedCodes = []">取消选择</a-button>
          </a-space>
        </div>
      </transition>

      <EmptyState
        v-if="!loading && rows.length === 0"
        :title="t('approvals.emptyTitle')"
        :description="t('approvals.emptyDesc')"
        :action-label="t('menu.personal')"
        @action="router.push('/personal')"
      />

      <OdTable
        v-else
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        row-key="code"
        class="approval-table"
        :row-selection="{ selectedRowKeys: selectedCodes, onChange: onSelectChange }"
        :pagination="{ current: query.page, pageSize: query.size, total, showTotal: (tot: number) => `共 ${tot} 项` }"
        @change="
          (pagination: { current?: number }) => {
            query.page = pagination.current ?? 1;
            load();
          }
        "
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'code'">
            <span class="mono-code">{{ record.code }}</span>
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
            <a-tag
              :color="record.slaStatus === 'OVERDUE' || record.slaStatus === 'MISSED' ? 'error' : record.slaStatus === 'ON_TIME' ? 'success' : 'default'"
              class="sla-tag"
            >
              {{ slaText(record.slaStatus) }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'approvalType'">
            {{ 中文展示(record.approvalType) }}
          </template>

          <template v-else-if="column.key === 'sourceSystem'">
            {{ 中文展示(record.sourceSystem) }}
          </template>

          <template v-else-if="column.key === 'action'">
            <a-button
              size="small"
              type="primary"
              :disabled="record.status !== 'PENDING'"
              @click="openDecide(record)"
            >
              {{ t('approvals.decideButton') }}
            </a-button>
          </template>
        </template>
      </OdTable>

      <!-- 发起申请弹窗 -->
      <a-modal v-model:open="createOpen" :title="t('approvals.createModal')" :confirm-loading="creating" @ok="create">
        <a-form layout="vertical" class="create-form">
          <a-form-item name="approvalType" :label="t('approvals.approvalType')" required>
            <a-select v-model:value="createForm.approvalType">
              <a-select-option value="R4_TOOL_CALL">{{ t('approvals.r4ToolCall') }}</a-select-option>
              <a-select-option value="DATA_GRANT">{{ t('approvals.dataGrant') }}</a-select-option>
              <a-select-option value="SYSTEM_PERMISSION">{{ t('approvals.systemPermission') }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item name="sourceSystem" :label="t('common.sourceSystem')" required>
            <a-select v-model:value="createForm.sourceSystem">
              <a-select-option value="mcp-gateway">智能体工具调用网关</a-select-option>
              <a-select-option value="data-platform">数据管理平台</a-select-option>
              <a-select-option value="algorithm-transform">算法转换工具</a-select-option>
              <a-select-option value="algorithm-recombine">算法重组平台</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item name="sourceCode" :label="t('approvals.sourceObjectCode')">
            <a-input v-model:value="createForm.sourceCode" :placeholder="t('approvals.sourceCodePlaceholder')" />
          </a-form-item>
          <a-form-item name="title" :label="t('common.title')" required>
            <a-input v-model:value="createForm.title" :placeholder="t('approvals.titlePlaceholder')" />
          </a-form-item>
          <a-form-item name="slaDeadline" :label="t('approvals.slaDeadline')" :extra="t('approvals.slaDeadlinePlaceholder')">
            <a-input v-model:value="createForm.slaDeadline" type="datetime-local" style="max-width: 280px" />
          </a-form-item>
        </a-form>
      </a-modal>

      <!-- 快速决策审批弹窗 -->
      <a-modal v-model:open="decideOpen" :title="t('approvals.decideModal')" :confirm-loading="deciding" @ok="decide">
        <div v-if="decideTarget" class="decide-target-info">
          <div class="target-row">
            <span class="target-label">申请单号:</span>
            <span class="mono-code">{{ decideTarget.code }}</span>
          </div>
          <div class="target-row">
            <span class="target-label">申请事项:</span>
            <span class="target-title">{{ decideTarget.title }}</span>
          </div>
          <div class="target-row">
            <span class="target-label">申请人:</span>
            <span>{{ decideTarget.requester }}（{{ 中文展示(decideTarget.sourceSystem) }}）</span>
          </div>
        </div>

        <a-form layout="vertical" style="margin-top: 16px">
          <a-form-item name="decision" :label="t('approvals.conclusion')" required>
            <a-radio-group v-model:value="decideForm.decision" button-style="solid">
              <a-radio-button value="APPROVED">同意通过</a-radio-button>
              <a-radio-button value="REJECTED">予以驳回</a-radio-button>
            </a-radio-group>
          </a-form-item>
          <a-form-item name="decisionNote" :label="t('approvals.decisionNote')">
            <a-textarea v-model:value="decideForm.decisionNote" :placeholder="t('approvals.decisionNotePlaceholder')" :rows="3" />
          </a-form-item>
        </a-form>
      </a-modal>
    </a-card>
  </div>
</template>

<style scoped>
.approvals-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: var(--od-shadow-1);
}

.focus-alert {
  margin-bottom: 16px;
  border-radius: 8px;
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

.action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  margin-bottom: 16px;
  background: var(--od-primary-50, #eff6ff);
  border: 1px solid var(--od-primary-200, #bfdbfe);
  border-radius: 8px;
}

.batch-hint {
  font-size: 13px;
  color: var(--od-color-primary, #1e40af);
}

.mono-code {
  font-family: var(--od-font-mono, monospace);
  font-weight: 600;
}

.status-tag,
.sla-tag {
  font-weight: 500;
  border-radius: 4px;
}

.decide-target-info {
  background: var(--od-gray-50, #f8fafc);
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.target-row {
  display: flex;
  gap: 8px;
}

.target-label {
  color: var(--od-gray-500, #64748b);
  width: 70px;
}

.target-title {
  font-weight: 600;
  color: var(--od-gray-900, #0f172a);
}

.batch-bar-enter-active,
.batch-bar-leave-active {
  transition: all 0.2s ease;
}
.batch-bar-enter-from,
.batch-bar-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
