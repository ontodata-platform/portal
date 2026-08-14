<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { approvalApi, personalApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { ApprovalRequest, PersonalTodo, RequirementRequest } from '@/types/portal'

const messageStore = useMessageStore()

const requester = ref('alice')
const todos = ref<PersonalTodo>({
  pendingApprovalCount: 0,
  myOpenRequirementCount: 0,
  myRequirementCount: 0,
  myApprovalCount: 0,
})

const requirementLoading = ref(false)
const requirements = ref<RequirementRequest[]>([])
const requirementTotal = ref(0)

const approvalLoading = ref(false)
const approvals = ref<ApprovalRequest[]>([])
const approvalTotal = ref(0)

const pendingLoading = ref(false)
const pendingApprovals = ref<ApprovalRequest[]>([])

const requirementColumns = [
  { title: '编码', dataIndex: 'code', key: 'code' },
  { title: '标题', dataIndex: 'title', key: 'title' },
  { title: '状态', dataIndex: 'status', key: 'status' },
]

const approvalColumns = [
  { title: '编码', dataIndex: 'code', key: 'code' },
  { title: '标题', dataIndex: 'title', key: 'title' },
  { title: '状态', dataIndex: 'status', key: 'status' },
]

const statusColor: Record<string, string> = {
  OPEN: 'default',
  ANALYZING: 'processing',
  ASSIGNED: 'geekblue',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  CANCELED: 'default',
  PENDING: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
}

async function loadAll() {
  await Promise.all([loadTodos(), loadRequirements(), loadApprovals(), loadPending()])
}

async function loadTodos() {
  try {
    todos.value = await personalApi.todos(requester.value)
  } catch (error) {
    messageStore.reportError(error)
  }
}

async function loadRequirements() {
  requirementLoading.value = true
  try {
    const page = await personalApi.requirements(requester.value, { page: 1, size: 20 })
    requirements.value = page.items
    requirementTotal.value = page.total
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    requirementLoading.value = false
  }
}

async function loadApprovals() {
  approvalLoading.value = true
  try {
    const page = await personalApi.approvals(requester.value, { page: 1, size: 20 })
    approvals.value = page.items
    approvalTotal.value = page.total
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    approvalLoading.value = false
  }
}

async function loadPending() {
  pendingLoading.value = true
  try {
    const page = await approvalApi.list({ page: 1, size: 20, status: 'PENDING' })
    pendingApprovals.value = page.items
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    pendingLoading.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <a-card>
    <a-space style="margin-bottom: 16px">
      <span>当前用户（M5 接入统一身份后自动识别）：</span>
      <a-input v-model:value="requester" style="width: 200px" />
      <a-button type="primary" @click="loadAll">刷新</a-button>
    </a-space>

    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="6">
        <a-statistic title="待我审批" :value="todos.pendingApprovalCount" :value-style="{ color: todos.pendingApprovalCount > 0 ? '#cf1322' : undefined }" />
      </a-col>
      <a-col :span="6">
        <a-statistic title="我的进行中需求" :value="todos.myOpenRequirementCount" />
      </a-col>
      <a-col :span="6">
        <a-statistic title="我的需求总数" :value="todos.myRequirementCount" />
      </a-col>
      <a-col :span="6">
        <a-statistic title="我的申请总数" :value="todos.myApprovalCount" />
      </a-col>
    </a-row>

    <a-card title="待我审批（全体 PENDING 审批单）" size="small" :bordered="false" style="margin-bottom: 16px">
      <a-table
        :columns="approvalColumns"
        :data-source="pendingApprovals"
        :loading="pendingLoading"
        row-key="code"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="statusColor[record.status]">{{ record.status }}</a-tag>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-card title="我的需求" size="small" :bordered="false" style="margin-bottom: 16px">
      <a-table
        :columns="requirementColumns"
        :data-source="requirements"
        :loading="requirementLoading"
        row-key="code"
        :pagination="{ total: requirementTotal }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="statusColor[record.status]">{{ record.status }}</a-tag>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-card title="我的申请" size="small" :bordered="false">
      <a-table
        :columns="approvalColumns"
        :data-source="approvals"
        :loading="approvalLoading"
        row-key="code"
        :pagination="{ total: approvalTotal }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="statusColor[record.status]">{{ record.status }}</a-tag>
          </template>
        </template>
      </a-table>
    </a-card>
  </a-card>
</template>
