<script setup lang="ts">
import {
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  NotificationOutlined,
  ReloadOutlined,
  RobotOutlined,
  SolutionOutlined,
  SyncOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { approvalApi, marketplaceApi, operationsApi, personalApi } from '@/api/portal'
import { useIdentityStore } from '@/stores/identity'
import { useMessageStore } from '@/stores/message'
import type { ApprovalRequest, Notice, PersonalTodo, RequirementRequest } from '@/types/portal'
import AsyncTaskPanel from '@/ui-kit/AsyncTaskPanel.vue'
import EmptyState from '@/ui-kit/EmptyState.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'

const { t, locale } = useI18n()
const router = useRouter()
const messageStore = useMessageStore()
const identityStore = useIdentityStore()

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

const noticeLoading = ref(false)
const notices = ref<Notice[]>([])

const selectedNotice = ref<Notice | null>(null)
const noticeModalOpen = ref(false)

const retryingCode = ref<string | null>(null)

const pendingDelivery = computed(() =>
  approvals.value.find((item) => item.detail?.deliveryStatus === 'PENDING'),
)

const requirementColumns = computed(() => [
  { title: t('common.code'), dataIndex: 'code', key: 'code', width: 140 },
  { title: t('common.title'), dataIndex: 'title', key: 'title' },
  { title: t('common.type'), dataIndex: 'requirementType', key: 'requirementType', width: 110 },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 110 },
])

const myApprovalColumns = computed(() => [
  { title: t('common.code'), dataIndex: 'code', key: 'code', width: 140 },
  { title: t('common.title'), dataIndex: 'title', key: 'title' },
  { title: t('common.type'), dataIndex: 'approvalType', key: 'approvalType', width: 130 },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 100 },
  { title: t('personal.deliveryStatus'), dataIndex: 'deliveryStatus', key: 'deliveryStatus', width: 140 },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 110 },
])

const pendingColumns = computed(() => [
  { title: t('common.code'), dataIndex: 'code', key: 'code', width: 140 },
  { title: t('common.title'), dataIndex: 'title', key: 'title' },
  { title: t('common.applicant'), dataIndex: 'requester', key: 'requester', width: 110 },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 100 },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 90 },
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

function formatTime(value?: string): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString(locale.value)
}

async function loadAll() {
  await Promise.all([
    identityStore.fetchIdentity(),
    loadTodos(),
    loadRequirements(),
    loadApprovals(),
    loadPending(),
    loadNotices(),
  ])
}

async function loadTodos() {
  try {
    todos.value = await personalApi.todos()
  } catch (error) {
    messageStore.reportError(error)
  }
}

async function loadRequirements() {
  requirementLoading.value = true
  try {
    const page = await personalApi.requirements({ page: 1, size: 10 })
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
    const page = await personalApi.approvals({ page: 1, size: 10 })
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
    const page = await approvalApi.list({ page: 1, size: 10, status: 'PENDING' })
    pendingApprovals.value = page.items
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    pendingLoading.value = false
  }
}

async function loadNotices() {
  noticeLoading.value = true
  try {
    const page = await operationsApi.notices({ page: 1, size: 5, status: 'PUBLISHED' })
    notices.value = page.items
  } catch {
    // 公告只读展示，容错忽略
  } finally {
    noticeLoading.value = false
  }
}

async function handleRetryDelivery(record: ApprovalRequest) {
  retryingCode.value = record.code
  try {
    await marketplaceApi.retryDelivery(record.code)
    messageStore.success(t('marketplace.retryDeliverySuccess'))
    await loadApprovals()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    retryingCode.value = null
  }
}

function openNotice(notice: Notice) {
  selectedNotice.value = notice
  noticeModalOpen.value = true
}

onMounted(loadAll)
</script>

<template>
  <div class="personal-workbench">
    <PageHeader
      eyebrow="服务门户"
      :title="t('menu.personal')"
    >
      <template #extra>
        <a-space>
          <a-button type="primary" ghost @click="router.push('/agent/chat')">
            <template #icon><RobotOutlined /></template>
            {{ t('personal.quickAgent') }}
          </a-button>
          <a-button @click="loadAll">
            <template #icon><ReloadOutlined /></template>
            {{ t('personal.refresh') }}
          </a-button>
        </a-space>
      </template>
    </PageHeader>

    <AsyncTaskPanel
      v-if="pendingDelivery"
      :task-id="pendingDelivery.code"
      phase="订阅投递"
      status="running"
      message="审批已通过，结果正在投递。完成后可在结果中心查看。"
    />

    <!-- 顶部欢迎横幅 -->
    <a-card class="welcome-card" :bordered="false">
      <div class="welcome-header">
        <div class="welcome-user">
          <a-avatar size="large" class="user-avatar">
            <template #icon><UserOutlined /></template>
          </a-avatar>
          <div class="user-meta">
            <h3 class="user-title">
              {{ t('personal.welcome') }}，{{ identityStore.name }}
            </h3>
            <div class="user-sub">
              <span>{{ t('layout.tenant') }}: <strong>{{ identityStore.tenantId }}</strong></span>
              <span v-if="identityStore.roles.length > 0" class="role-list">
                {{ t('layout.roles') }}: {{ identityStore.roles.join(', ') }}
              </span>
            </div>
          </div>
        </div>

        <div class="welcome-actions">
          <span class="user-sub">{{ t('layout.tenant') }} · {{ identityStore.tenantId }}</span>
        </div>
      </div>
    </a-card>

    <!-- 四项指标统计 -->
    <a-row :gutter="16" style="margin: 16px 0">
      <a-col :xs="24" :sm="12" :md="6">
        <a-card class="stat-card" hoverable @click="router.push('/approvals')">
          <a-statistic
            :title="t('personal.pendingForMe')"
            :value="todos.pendingApprovalCount"
            :value-style="{
              color: todos.pendingApprovalCount > 0 ? 'var(--od-color-blocked)' : 'var(--od-color-success)',
            }"
          >
            <template #prefix><AuditOutlined /></template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :md="6">
        <a-card class="stat-card" hoverable @click="router.push('/requirements')">
          <a-statistic
            :title="t('personal.myOpenRequirements')"
            :value="todos.myOpenRequirementCount"
            :value-style="{ color: 'var(--od-color-running)' }"
          >
            <template #prefix><ClockCircleOutlined /></template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :md="6">
        <a-card class="stat-card" hoverable @click="router.push('/requirements')">
          <a-statistic :title="t('personal.myRequirementTotal')" :value="todos.myRequirementCount">
            <template #prefix><SolutionOutlined /></template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :md="6">
        <a-card class="stat-card" hoverable>
          <a-statistic :title="t('personal.myApprovalTotal')" :value="todos.myApprovalCount">
            <template #prefix><FileTextOutlined /></template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <!-- 工作台主区域 -->
    <a-row :gutter="16">
      <!-- 左侧：待办与申请 -->
      <a-col :xs="24" :lg="16">
        <!-- 待我审批 -->
        <a-card
          :title="t('personal.pendingCard')"
          size="small"
          class="section-card"
          style="margin-bottom: 16px"
        >
          <template #extra>
            <a-button type="link" size="small" @click="router.push('/approvals')">
              {{ t('personal.viewAllApprovals') }}
            </a-button>
          </template>
          <a-table
            :columns="pendingColumns"
            :data-source="pendingApprovals"
            :loading="pendingLoading"
            row-key="code"
            size="middle"
            :pagination="false"
          >
            <template #emptyText>
              <EmptyState
                :title="t('personal.noTodos')"
                description="没有待你处理的审批。有新申请时会出现在这里。"
                :action-label="t('personal.viewAllApprovals')"
                @action="router.push('/approvals')"
              />
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag :color="statusColor[record.status]">{{ record.status }}</a-tag>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-button size="small" type="primary" @click="router.push('/approvals')">
                  {{ t('approvals.decideButton') }}
                </a-button>
              </template>
            </template>
          </a-table>
        </a-card>

        <!-- 我的申请与订阅投递 -->
        <a-card :title="t('personal.myApprovals')" size="small" class="section-card">
          <a-table
            :columns="myApprovalColumns"
            :data-source="approvals"
            :loading="approvalLoading"
            row-key="code"
            size="middle"
            :pagination="{ pageSize: 5, total: approvalTotal }"
          >
            <template #emptyText>
              <a-empty :description="t('personal.noApprovals')" />
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag :color="statusColor[record.status]">{{ record.status }}</a-tag>
              </template>
              <template v-else-if="column.key === 'deliveryStatus'">
                <span v-if="record.detail?.deliveryStatus === 'SUCCEEDED'">
                  <a-tag color="success"><CheckCircleOutlined /> {{ t('marketplace.deliverySucceeded') }}</a-tag>
                </span>
                <span v-else-if="record.detail?.deliveryStatus === 'FAILED'">
                  <a-tag color="error"><CloseCircleOutlined /> {{ t('marketplace.deliveryFailed') }}</a-tag>
                </span>
                <span v-else-if="record.detail?.deliveryStatus === 'PENDING'">
                  <a-tag color="processing"><SyncOutlined spin /> {{ t('marketplace.deliveryPending') }}</a-tag>
                </span>
                <span v-else class="text-muted">-</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-button
                  v-if="record.status === 'APPROVED' && record.detail?.deliveryStatus === 'FAILED'"
                  size="small"
                  type="link"
                  danger
                  :loading="retryingCode === record.code"
                  @click="handleRetryDelivery(record)"
                >
                  {{ t('personal.retryDelivery') }}
                </a-button>
                <span v-else class="text-muted">-</span>
              </template>
            </template>
          </a-table>
        </a-card>
      </a-col>

      <!-- 右侧：我的需求与平台公告 -->
      <a-col :xs="24" :lg="8">
        <!-- 平台公告 -->
        <a-card :title="t('personal.notices')" size="small" class="section-card" style="margin-bottom: 16px">
          <template #extra>
            <NotificationOutlined class="notice-icon" />
          </template>
          <a-spin :spinning="noticeLoading">
            <div v-if="notices.length === 0" style="padding: 16px 0">
              <EmptyState :title="t('personal.noNotices')" description="暂无公告，稍后刷新即可。" />
            </div>
            <a-list v-else size="small" :data-source="notices">
              <template #renderItem="{ item }">
                <a-list-item class="notice-item" @click="openNotice(item)">
                  <div class="notice-row">
                    <span class="notice-title">{{ item.title }}</span>
                    <span class="notice-date">{{ formatTime(item.publishedAt || item.createdAt) }}</span>
                  </div>
                </a-list-item>
              </template>
            </a-list>
          </a-spin>
        </a-card>

        <!-- 我的需求 -->
        <a-card :title="t('personal.myRequirements')" size="small" class="section-card">
          <template #extra>
            <a-button type="link" size="small" @click="router.push('/requirements')">
              {{ t('personal.viewAllRequirements') }}
            </a-button>
          </template>
          <a-table
            :columns="requirementColumns"
            :data-source="requirements"
            :loading="requirementLoading"
            row-key="code"
            size="small"
            :pagination="{ pageSize: 5, total: requirementTotal }"
          >
            <template #emptyText>
              <a-empty :description="t('personal.noRequirements')" />
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag :color="statusColor[record.status]">{{ record.status }}</a-tag>
              </template>
            </template>
          </a-table>
        </a-card>
      </a-col>
    </a-row>

    <!-- 公告详情弹窗 -->
    <a-modal
      v-model:open="noticeModalOpen"
      :title="selectedNotice?.title"
      :footer="null"
      width="560px"
    >
      <div v-if="selectedNotice" class="notice-detail">
        <div class="notice-detail-meta">
          <a-tag color="blue">{{ selectedNotice.section }}</a-tag>
          <span class="notice-detail-time">{{ formatTime(selectedNotice.publishedAt || selectedNotice.createdAt) }}</span>
        </div>
        <a-divider style="margin: 12px 0" />
        <div class="notice-detail-content">{{ selectedNotice.content }}</div>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.personal-workbench {
  display: flex;
  flex-direction: column;
}

.welcome-card {
  border-radius: 8px;
  background: linear-gradient(135deg, #ffffff 0%, #f8faff 100%);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.welcome-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.user-avatar {
  background-color: var(--od-color-accent);
}

.notice-icon {
  color: var(--od-color-accent);
}

.welcome-user {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-title {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
}

.user-sub {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
}

.role-list {
  margin-left: 12px;
}

.stat-card {
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: all 0.3s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.section-card {
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.notice-item {
  cursor: pointer;
  padding: 8px 4px;
  transition: background 0.2s;
}

.notice-item:hover {
  background: #f5f5f5;
  border-radius: 4px;
}

.notice-row {
  display: flex;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
}

.notice-title {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.85);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-date {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  white-space: nowrap;
}

.notice-detail-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notice-detail-time {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.notice-detail-content {
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  color: rgba(0, 0, 0, 0.85);
}

.text-muted {
  color: rgba(0, 0, 0, 0.25);
}
</style>
