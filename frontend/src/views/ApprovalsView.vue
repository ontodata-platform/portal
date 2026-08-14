<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import { approvalApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { ApprovalRequest } from '@/types/portal'

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

const columns = [
  { title: '编码', dataIndex: 'code', key: 'code' },
  { title: '类型', dataIndex: 'approvalType', key: 'approvalType' },
  { title: '来源系统', dataIndex: 'sourceSystem', key: 'sourceSystem' },
  { title: '标题', dataIndex: 'title', key: 'title' },
  { title: '申请人', dataIndex: 'requester', key: 'requester' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '操作', dataIndex: 'action', key: 'action' },
]

const statusColor: Record<string, string> = {
  PENDING: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
}

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
    messageStore.success('审批单已创建（编码由服务端生成）')
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
    messageStore.success(`审批单 ${decideTarget.value.code} 已${decideForm.decision === 'APPROVED' ? '通过' : '拒绝'}`)
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
      <a-select v-model:value="query.status" placeholder="状态" allow-clear style="width: 140px">
        <a-select-option value="PENDING">待审批</a-select-option>
        <a-select-option value="APPROVED">已通过</a-select-option>
        <a-select-option value="REJECTED">已拒绝</a-select-option>
      </a-select>
      <a-input v-model:value="query.type" placeholder="审批类型（如 R4_TOOL_CALL）" style="width: 220px" />
      <a-button
        type="primary"
        @click="
          query.page = 1;
          load()
        "
      >
        查询
      </a-button>
      <a-button @click="createOpen = true">创建审批单</a-button>
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
          <a-tag :color="statusColor[record.status]">{{ record.status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button
            size="small"
            type="primary"
            :disabled="record.status !== 'PENDING'"
            @click="openDecide(record)"
          >
            审批
          </a-button>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="createOpen" title="创建审批单" :confirm-loading="creating" @ok="create">
      <a-form layout="vertical">
        <a-form-item label="审批类型" required>
          <a-select v-model:value="createForm.approvalType">
            <a-select-option value="R4_TOOL_CALL">R4 工具调用</a-select-option>
            <a-select-option value="DATA_GRANT">数据授权</a-select-option>
            <a-select-option value="SYSTEM_PERMISSION">系统权限</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="来源系统" required>
          <a-select v-model:value="createForm.sourceSystem">
            <a-select-option value="mcp-gateway">mcp-gateway</a-select-option>
            <a-select-option value="data-platform">data-platform</a-select-option>
            <a-select-option value="algorithm-transform">algorithm-transform</a-select-option>
            <a-select-option value="algorithm-recombine">algorithm-recombine</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="来源对象编码">
          <a-input v-model:value="createForm.sourceCode" placeholder="如 cfm-xxxxxxxx（可空）" />
        </a-form-item>
        <a-form-item label="标题" required>
          <a-input v-model:value="createForm.title" placeholder="例如：调用工具需要审批" />
        </a-form-item>
        <a-form-item label="申请人" required>
          <a-input v-model:value="createForm.requester" placeholder="申请人" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="decideOpen" title="审批决策" :confirm-loading="deciding" @ok="decide">
      <a-form layout="vertical">
        <a-form-item label="结论" required>
          <a-radio-group v-model:value="decideForm.decision">
            <a-radio value="APPROVED">通过</a-radio>
            <a-radio value="REJECTED">拒绝</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="审批人" required>
          <a-input v-model:value="decideForm.decisionBy" placeholder="审批人" />
        </a-form-item>
        <a-form-item label="审批意见">
          <a-textarea v-model:value="decideForm.decisionNote" placeholder="审批意见（拒绝时建议填写）" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-card>
</template>
