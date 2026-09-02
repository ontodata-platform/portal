<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { approvalApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { ApprovalRequest } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'

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
  { title: t('common.code'), dataIndex: 'code', key: 'code', width: 140 },
  { title: t('common.type'), dataIndex: 'approvalType', key: 'approvalType', width: 130 },
  { title: t('common.sourceSystem'), dataIndex: 'sourceSystem', key: 'sourceSystem', width: 140 },
  { title: t('common.title'), dataIndex: 'title', key: 'title' },
  { title: t('common.applicant'), dataIndex: 'requester', key: 'requester', width: 120 },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 110 },
  { title: t('approvals.slaStatus'), dataIndex: 'slaStatus', key: 'slaStatus', width: 90 },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 110 },
])

const statusColor: Record<string, string> = {
  PENDING: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
}

/** 审批状态展示文案（协议编码 PENDING/APPROVED/REJECTED 不变，界面按语言翻译）。 */
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

async function create() {
  creating.value = true
  try {
    await approvalApi.create({
      approvalType: createForm.approvalType,
      sourceSystem: createForm.sourceSystem,
      sourceCode: createForm.sourceCode || undefined,
      title: createForm.title,
      slaDeadline: createForm.slaDeadline ? new Date(createForm.slaDeadline).toISOString() : undefined,
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
  <div>
    <PageHeader
      :eyebrow="t('menu.groupPortal')"
      :title="t('menu.approvals')"
      :description="t('approvals.pageDesc')"
    />

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
    <a-space style="margin-bottom: 16px" wrap>
      <a-select v-model:value="query.status" :placeholder="t('common.status')" allow-clear style="width: 140px">
        <a-select-option value="PENDING">{{ t('approvals.pendingApproval') }}</a-select-option>
        <a-select-option value="APPROVED">{{ t('approvals.approved') }}</a-select-option>
        <a-select-option value="REJECTED">{{ t('approvals.rejected') }}</a-select-option>
      </a-select>
      <a-input v-model:value="query.type" :placeholder="t('approvals.typePlaceholder')" style="width: 220px" allow-clear />
      <a-button
        type="primary"
        @click="
          query.page = 1;
          load();
        "
      >
        {{ t('common.query') }}
      </a-button>
      <a-button @click="createOpen = true">{{ t('approvals.createButton') }}</a-button>
      <a-button :disabled="selectedCodes.length === 0" :loading="batching" @click="batchDecide('APPROVED')">
        {{ t('approvals.batchApprove') }}
      </a-button>
      <a-button :disabled="selectedCodes.length === 0" :loading="batching" danger @click="batchDecide('REJECTED')">
        {{ t('approvals.batchReject') }}
      </a-button>
    </a-space>

    <EmptyState
      v-if="!loading && rows.length === 0"
      :title="t('approvals.emptyTitle')"
      :description="t('approvals.emptyDesc')"
      :action-label="t('menu.personal')"
      @action="router.push('/personal')"
    />
    <a-table
      v-else
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      row-key="code"
      :row-selection="{ selectedRowKeys: selectedCodes, onChange: onSelectChange }"
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
          <a-tag :color="statusColor[record.status]">{{ statusText[record.status] ?? record.status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'slaStatus'">
          <a-tag :color="record.slaStatus === 'OVERDUE' || record.slaStatus === 'MISSED' ? 'error' : 'default'">
            {{ slaText(record.slaStatus) }}
          </a-tag>
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
    </a-table>

    <a-modal v-model:open="createOpen" :title="t('approvals.createModal')" :confirm-loading="creating" @ok="create">
      <a-form layout="vertical">
        <a-form-item :label="t('approvals.approvalType')" required>
          <a-select v-model:value="createForm.approvalType">
            <a-select-option value="R4_TOOL_CALL">{{ t('approvals.r4ToolCall') }}</a-select-option>
            <a-select-option value="DATA_GRANT">{{ t('approvals.dataGrant') }}</a-select-option>
            <a-select-option value="SYSTEM_PERMISSION">{{ t('approvals.systemPermission') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('common.sourceSystem')" required>
          <a-select v-model:value="createForm.sourceSystem">
            <a-select-option value="mcp-gateway">mcp-gateway</a-select-option>
            <a-select-option value="data-platform">data-platform</a-select-option>
            <a-select-option value="algorithm-transform">algorithm-transform</a-select-option>
            <a-select-option value="algorithm-recombine">algorithm-recombine</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="t('approvals.sourceObjectCode')">
          <a-input v-model:value="createForm.sourceCode" :placeholder="t('approvals.sourceCodePlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('common.title')" required>
          <a-input v-model:value="createForm.title" :placeholder="t('approvals.titlePlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('approvals.slaDeadline')" :extra="t('approvals.slaDeadlinePlaceholder')">
          <a-input v-model:value="createForm.slaDeadline" type="datetime-local" style="max-width: 280px" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="decideOpen" :title="t('approvals.decideModal')" :confirm-loading="deciding" @ok="decide">
      <a-form layout="vertical">
        <a-form-item :label="t('approvals.conclusion')" required>
          <a-radio-group v-model:value="decideForm.decision">
            <a-radio value="APPROVED">{{ t('approvals.approve') }}</a-radio>
            <a-radio value="REJECTED">{{ t('approvals.reject') }}</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :label="t('approvals.decisionNote')">
          <a-textarea v-model:value="decideForm.decisionNote" :placeholder="t('approvals.decisionNotePlaceholder')" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
    </a-card>
  </div>
</template>

<style scoped>
.approvals-card {
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.focus-alert {
  margin-bottom: 12px;
}
</style>
