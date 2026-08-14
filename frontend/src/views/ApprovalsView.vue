<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { approvalApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { ApprovalRequest } from '@/types/portal'

const { t } = useI18n()
const messageStore = useMessageStore()

const loading = ref(false)
const rows = ref<ApprovalRequest[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, status: '', type: '' })

const createOpen = ref(false)
const creating = ref(false)
const createForm = reactive({ approvalType: 'R4_TOOL_CALL', sourceSystem: 'mcp-gateway', sourceCode: '', title: '', requester: '' })

const decideOpen = ref(false)
const deciding = ref(false)
const decideTarget = ref<ApprovalRequest | null>(null)
const decideForm = reactive({ decision: 'APPROVED' as 'APPROVED' | 'REJECTED', decisionBy: '', decisionNote: '' })

const columns = computed(() => [
  { title: t('common.code'), dataIndex: 'code', key: 'code' },
  { title: t('common.type'), dataIndex: 'approvalType', key: 'approvalType' },
  { title: t('common.sourceSystem'), dataIndex: 'sourceSystem', key: 'sourceSystem' },
  { title: t('common.title'), dataIndex: 'title', key: 'title' },
  { title: t('common.applicant'), dataIndex: 'requester', key: 'requester' },
  { title: t('common.status'), dataIndex: 'status', key: 'status' },
  { title: t('common.action'), dataIndex: 'action', key: 'action' },
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

async function load() {
  loading.value = true
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
      requester: createForm.requester,
    })
    messageStore.success(t('approvals.created'))
    createOpen.value = false
    createForm.title = ''
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
  decideForm.decisionBy = ''
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
      decisionBy: decideForm.decisionBy,
      decisionNote: decideForm.decisionNote || undefined,
    })
    messageStore.success(
      decideForm.decision === 'APPROVED'
        ? t('approvals.decidedApproved', { code: decideTarget.value.code })
        : t('approvals.decidedRejected', { code: decideTarget.value.code }),
    )
    decideOpen.value = false
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    deciding.value = false
  }
}

onMounted(load)
</script>

<template>
  <a-card>
    <a-space style="margin-bottom: 12px" wrap>
      <a-select v-model:value="query.status" :placeholder="t('common.status')" allow-clear style="width: 140px">
        <a-select-option value="PENDING">{{ t('approvals.pendingApproval') }}</a-select-option>
        <a-select-option value="APPROVED">{{ t('approvals.approved') }}</a-select-option>
        <a-select-option value="REJECTED">{{ t('approvals.rejected') }}</a-select-option>
      </a-select>
      <a-input v-model:value="query.type" :placeholder="t('approvals.typePlaceholder')" style="width: 220px" />
      <a-button
        type="primary"
        @click="
          query.page = 1;
          load()
        "
      >
        {{ t('common.query') }}
      </a-button>
      <a-button @click="createOpen = true">{{ t('approvals.createButton') }}</a-button>
    </a-space>

    <a-table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      row-key="code"
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
        <a-form-item :label="t('common.applicant')" required>
          <a-input v-model:value="createForm.requester" :placeholder="t('approvals.requesterPlaceholder')" />
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
        <a-form-item :label="t('approvals.decisionBy')" required>
          <a-input v-model:value="decideForm.decisionBy" :placeholder="t('approvals.decisionBy')" />
        </a-form-item>
        <a-form-item :label="t('approvals.decisionNote')">
          <a-textarea v-model:value="decideForm.decisionNote" :placeholder="t('approvals.decisionNotePlaceholder')" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-card>
</template>
