<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { approvalApi, personalApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { ApprovalRequest, PersonalTodo, RequirementRequest } from '@/types/portal'

const { t } = useI18n()
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

const requirementColumns = computed(() => [
  { title: t('common.code'), dataIndex: 'code', key: 'code' },
  { title: t('common.title'), dataIndex: 'title', key: 'title' },
  { title: t('common.status'), dataIndex: 'status', key: 'status' },
])

const approvalColumns = computed(() => [
  { title: t('common.code'), dataIndex: 'code', key: 'code' },
  { title: t('common.title'), dataIndex: 'title', key: 'title' },
  { title: t('common.status'), dataIndex: 'status', key: 'status' },
])

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
      <span>{{ t('personal.currentUser') }}</span>
      <a-input v-model:value="requester" style="width: 200px" />
      <a-button type="primary" @click="loadAll">{{ t('personal.refresh') }}</a-button>
    </a-space>

    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="6">
        <a-statistic :title="t('personal.pendingForMe')" :value="todos.pendingApprovalCount" :value-style="{ color: todos.pendingApprovalCount > 0 ? '#cf1322' : undefined }" />
      </a-col>
      <a-col :span="6">
        <a-statistic :title="t('personal.myOpenRequirements')" :value="todos.myOpenRequirementCount" />
      </a-col>
      <a-col :span="6">
        <a-statistic :title="t('personal.myRequirementTotal')" :value="todos.myRequirementCount" />
      </a-col>
      <a-col :span="6">
        <a-statistic :title="t('personal.myApprovalTotal')" :value="todos.myApprovalCount" />
      </a-col>
    </a-row>

    <a-card :title="t('personal.pendingCard')" size="small" :bordered="false" style="margin-bottom: 16px">
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

    <a-card :title="t('personal.myRequirements')" size="small" :bordered="false" style="margin-bottom: 16px">
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

    <a-card :title="t('personal.myApprovals')" size="small" :bordered="false">
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
