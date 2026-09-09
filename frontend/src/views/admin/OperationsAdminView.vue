<script setup lang="ts">
import { BellOutlined, CheckCircleOutlined, FormOutlined, MessageOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { Modal } from 'ant-design-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { operationsApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { Feedback, Notice, OperationsStatistics } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import OdTable from '@/ui-kit/OdTable.vue'

const { t } = useI18n()
const messageStore = useMessageStore()

const statistics = ref<OperationsStatistics>({ noticeTotal: 0, publishedNotices: 0, pendingFeedbacks: 0 })
const loadError = ref('')

const noticeLoading = ref(false)
const notices = ref<Notice[]>([])
const noticeTotal = ref(0)
const noticeQuery = reactive({ page: 1, size: 20, status: '', section: '' })
const noticeColumns = computed(() => [
  { title: t('common.code'), dataIndex: 'code', key: 'code', width: 140, odEllipsis: true, odSortable: true },
  { title: t('common.title'), dataIndex: 'title', key: 'title', odEllipsis: true, odSortable: true },
  { title: t('common.section'), dataIndex: 'section', key: 'section', width: 150, odEllipsis: true, odSortable: true },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 110, odSortable: true },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 150 },
])

const noticeOpen = ref(false)
const noticeCreating = ref(false)
const noticeActionCode = ref('')
const noticeForm = reactive({ title: '', content: '', section: 'announcement' })

const feedbackLoading = ref(false)
const feedbacks = ref<Feedback[]>([])
const feedbackTotal = ref(0)
const feedbackQuery = reactive({ page: 1, size: 20, status: '' })
const feedbackColumns = computed(() => [
  { title: t('common.code'), dataIndex: 'code', key: 'code', width: 140, odEllipsis: true, odSortable: true },
  { title: t('common.title'), dataIndex: 'title', key: 'title', odEllipsis: true, odSortable: true },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 110, odSortable: true },
  { title: t('common.handleNote'), dataIndex: 'handleNote', key: 'handleNote', odEllipsis: true, odSortable: true },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 110 },
])

const feedbackOpen = ref(false)
const feedbackCreating = ref(false)
const feedbackForm = reactive({ title: '', content: '', contact: '' })

const handleOpen = ref(false)
const handling = ref(false)
const handleTarget = ref<Feedback | null>(null)
const handleForm = reactive({ handleNote: '' })

const noticeStatusColor: Record<string, string> = {
  DRAFT: 'default',
  PUBLISHED: 'success',
  ARCHIVED: 'default',
}

const noticeStatusText: Record<string, string> = {
  DRAFT: t('operations.draft'),
  PUBLISHED: t('operations.published'),
  ARCHIVED: t('operations.archived'),
}
const feedbackStatusText: Record<string, string> = {
  PENDING: t('operations.pending'),
  HANDLED: t('operations.handled'),
}

function describeLoadError(error: unknown): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  if (message) return message
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

async function loadStatistics() {
  try {
    statistics.value = await operationsApi.statistics()
  } catch (error) {
    loadError.value = describeLoadError(error)
    messageStore.reportError(error)
  }
}

async function loadNotices() {
  noticeLoading.value = true
  loadError.value = ''
  try {
    const page = await operationsApi.notices({
      page: noticeQuery.page,
      size: noticeQuery.size,
      status: noticeQuery.status || undefined,
      domain: noticeQuery.section || undefined,
    })
    notices.value = page.items
    noticeTotal.value = page.total
  } catch (error) {
    loadError.value = describeLoadError(error)
    messageStore.reportError(error)
  } finally {
    noticeLoading.value = false
  }
}

async function loadFeedbacks() {
  feedbackLoading.value = true
  try {
    const page = await operationsApi.feedbacks({
      page: feedbackQuery.page,
      size: feedbackQuery.size,
      status: feedbackQuery.status || undefined,
    })
    feedbacks.value = page.items
    feedbackTotal.value = page.total
  } catch (error) {
    loadError.value = describeLoadError(error)
    messageStore.reportError(error)
  } finally {
    feedbackLoading.value = false
  }
}

function reloadAll() {
  loadError.value = ''
  void loadStatistics()
  void loadNotices()
  void loadFeedbacks()
}

async function createNotice() {
  noticeCreating.value = true
  try {
    await operationsApi.createNotice({
      title: noticeForm.title,
      content: noticeForm.content,
      section: noticeForm.section,
    })
    messageStore.success(t('operations.noticeCreated'))
    noticeOpen.value = false
    noticeForm.title = ''
    noticeForm.content = ''
    await Promise.all([loadNotices(), loadStatistics()])
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    noticeCreating.value = false
  }
}

async function publishNotice(record: Notice) {
  noticeActionCode.value = record.code
  try {
    await operationsApi.publishNotice(record.code)
    messageStore.success(t('operations.noticePublished', { code: record.code }))
    await Promise.all([loadNotices(), loadStatistics()])
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    noticeActionCode.value = ''
  }
}

async function archiveNotice(record: Notice) {
  noticeActionCode.value = record.code
  try {
    await operationsApi.archiveNotice(record.code)
    messageStore.success(t('operations.noticeArchived', { code: record.code }))
    await Promise.all([loadNotices(), loadStatistics()])
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    noticeActionCode.value = ''
  }
}

function confirmArchiveNotice(record: Notice) {
  Modal.confirm({
    title: '确认归档此公告？',
    content: '归档后公告不再对门户用户可见；需要重新发布时请新建公告。',
    okText: '确认归档',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: () => archiveNotice(record),
  })
}

async function createFeedback() {
  feedbackCreating.value = true
  try {
    await operationsApi.createFeedback({
      title: feedbackForm.title,
      content: feedbackForm.content,
      contact: feedbackForm.contact || undefined,
    })
    messageStore.success(t('operations.feedbackSubmitted'))
    feedbackOpen.value = false
    feedbackForm.title = ''
    feedbackForm.content = ''
    await Promise.all([loadFeedbacks(), loadStatistics()])
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    feedbackCreating.value = false
  }
}

function openHandle(record: Feedback) {
  handleTarget.value = record
  handleForm.handleNote = ''
  handleOpen.value = true
}

async function handleFeedback() {
  if (!handleTarget.value) {
    return
  }
  handling.value = true
  try {
    await operationsApi.handleFeedback(handleTarget.value.code, { handleNote: handleForm.handleNote })
    messageStore.success(t('operations.feedbackHandled', { code: handleTarget.value.code }))
    handleOpen.value = false
    await Promise.all([loadFeedbacks(), loadStatistics()])
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    handling.value = false
  }
}

onMounted(() => {
  void loadStatistics()
  void loadNotices()
  void loadFeedbacks()
})
</script>

<template>
  <div class="operations-admin-view">
    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="reloadAll"
    />

    <div v-else class="operations-body">
      <!-- 统计指标卡 -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-icon-wrap notice">
            <BellOutlined />
          </div>
          <div class="stat-info">
            <span class="stat-label">{{ t('operations.noticeTotal') }}</span>
            <span class="stat-value">{{ statistics.noticeTotal }}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrap published">
            <CheckCircleOutlined />
          </div>
          <div class="stat-info">
            <span class="stat-label">{{ t('operations.publishedNotices') }}</span>
            <span class="stat-value">{{ statistics.publishedNotices }}</span>
          </div>
        </div>
        <div class="stat-card" :class="{ urgent: statistics.pendingFeedbacks > 0 }">
          <div class="stat-icon-wrap feedback">
            <MessageOutlined />
          </div>
          <div class="stat-info">
            <span class="stat-label">{{ t('operations.pendingFeedbacks') }}</span>
            <span class="stat-value">{{ statistics.pendingFeedbacks }}</span>
          </div>
        </div>
      </div>

      <!-- 公告管理 -->
      <a-card :bordered="false" class="op-card" :title="t('operations.noticeModalTitle')">
        <div class="toolbar-area">
          <a-space wrap>
            <a-select v-model:value="noticeQuery.status" :placeholder="t('operations.noticeStatusPlaceholder')" allow-clear style="width: 140px">
              <a-select-option value="DRAFT">{{ t('operations.draft') }}</a-select-option>
              <a-select-option value="PUBLISHED">{{ t('operations.published') }}</a-select-option>
              <a-select-option value="ARCHIVED">{{ t('operations.archived') }}</a-select-option>
            </a-select>
            <a-input v-model:value="noticeQuery.section" :placeholder="t('operations.sectionPlaceholder')" style="width: 160px" allow-clear />
            <a-button type="primary" @click="noticeQuery.page = 1; loadNotices()">
              <template #icon><SearchOutlined /></template>
              {{ t('operations.queryNotices') }}
            </a-button>
          </a-space>
          <a-button type="primary" @click="noticeOpen = true">
            <template #icon><PlusOutlined /></template>
            {{ t('operations.publishNotice') }}
          </a-button>
        </div>

        <EmptyState
          v-if="!noticeLoading && notices.length === 0"
          :title="t('operations.emptyNotices')"
          :description="t('operations.emptyNoticesDesc')"
          :action-label="t('operations.publishNotice')"
          @action="noticeOpen = true"
        />
        <OdTable
          v-else
          :columns="noticeColumns"
          :data-source="notices"
          :loading="noticeLoading"
          row-key="code"
          :pagination="{ current: noticeQuery.page, pageSize: noticeQuery.size, total: noticeTotal }"
          @change="
            (pagination: { current?: number }) => {
              noticeQuery.page = pagination.current ?? 1;
              loadNotices();
            }
          "
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'code'">
              <span class="mono-code">{{ record.code }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="noticeStatusColor[record.status]">{{ noticeStatusText[record.status] ?? record.status }}</a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space size="small">
                <a-button
                  v-if="record.status === 'DRAFT'"
                  size="small"
                  type="primary"
                  :loading="noticeActionCode === record.code"
                  @click="publishNotice(record)"
                >
                  {{ t('operations.publish') }}
                </a-button>
                <a-button
                  v-if="record.status === 'PUBLISHED'"
                  size="small"
                  danger
                  :loading="noticeActionCode === record.code"
                  @click="confirmArchiveNotice(record)"
                >
                  {{ t('operations.archive') }}
                </a-button>
              </a-space>
            </template>
          </template>
        </OdTable>
      </a-card>

      <!-- 用户反馈 -->
      <a-card :bordered="false" class="op-card op-card--feedback" :title="t('operations.userFeedback')">
        <div class="toolbar-area">
          <a-space wrap>
            <a-select v-model:value="feedbackQuery.status" :placeholder="t('operations.feedbackStatusPlaceholder')" allow-clear style="width: 140px">
              <a-select-option value="PENDING">{{ t('operations.pending') }}</a-select-option>
              <a-select-option value="HANDLED">{{ t('operations.handled') }}</a-select-option>
            </a-select>
            <a-button type="primary" @click="feedbackQuery.page = 1; loadFeedbacks()">
              <template #icon><SearchOutlined /></template>
              {{ t('operations.queryFeedbacks') }}
            </a-button>
          </a-space>
          <a-button @click="feedbackOpen = true">
            <template #icon><FormOutlined /></template>
            {{ t('operations.submitFeedback') }}
          </a-button>
        </div>

        <EmptyState
          v-if="!feedbackLoading && feedbacks.length === 0"
          :title="t('operations.emptyFeedbacks')"
          :description="t('operations.emptyFeedbacksDesc')"
          :action-label="t('operations.submitFeedback')"
          @action="feedbackOpen = true"
        />
        <OdTable
          v-else
          :columns="feedbackColumns"
          :data-source="feedbacks"
          :loading="feedbackLoading"
          row-key="code"
          :pagination="{ current: feedbackQuery.page, pageSize: feedbackQuery.size, total: feedbackTotal }"
          @change="
            (pagination: { current?: number }) => {
              feedbackQuery.page = pagination.current ?? 1;
              loadFeedbacks();
            }
          "
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'code'">
              <span class="mono-code">{{ record.code }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="record.status === 'HANDLED' ? 'success' : 'processing'">{{ feedbackStatusText[record.status] ?? record.status }}</a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button size="small" type="primary" :disabled="record.status !== 'PENDING'" @click="openHandle(record)">
                {{ t('operations.handle') }}
              </a-button>
            </template>
          </template>
        </OdTable>
      </a-card>

      <!-- 新建公告弹窗 -->
      <a-modal v-model:open="noticeOpen" :title="t('operations.noticeModalTitle')" :confirm-loading="noticeCreating" @ok="createNotice">
        <a-form layout="vertical">
          <a-form-item name="title" :label="t('operations.formTitle')" required>
            <a-input v-model:value="noticeForm.title" :placeholder="t('operations.noticeTitlePlaceholder')" />
          </a-form-item>
          <a-form-item name="content" :label="t('operations.formContent')" required>
            <a-textarea v-model:value="noticeForm.content" :placeholder="t('operations.noticeContentPlaceholder')" :rows="4" />
          </a-form-item>
          <a-form-item name="section" :label="t('operations.formSection')" required>
            <a-input v-model:value="noticeForm.section" :placeholder="t('operations.sectionExample')" />
          </a-form-item>
        </a-form>
      </a-modal>

      <!-- 提交反馈弹窗 -->
      <a-modal v-model:open="feedbackOpen" :title="t('operations.feedbackModalTitle')" :confirm-loading="feedbackCreating" @ok="createFeedback">
        <a-form layout="vertical">
          <a-form-item name="title" :label="t('operations.formTitle')" required>
            <a-input v-model:value="feedbackForm.title" :placeholder="t('operations.feedbackTitlePlaceholder')" />
          </a-form-item>
          <a-form-item name="content" :label="t('operations.formContent')" required>
            <a-textarea v-model:value="feedbackForm.content" :placeholder="t('operations.feedbackContentPlaceholder')" :rows="4" />
          </a-form-item>
          <a-form-item name="contact" :label="t('operations.formContact')">
            <a-input v-model:value="feedbackForm.contact" :placeholder="t('operations.contactPlaceholder')" />
          </a-form-item>
        </a-form>
      </a-modal>

      <!-- 办理反馈弹窗 -->
      <a-modal v-model:open="handleOpen" :title="t('operations.handleModalTitle')" :confirm-loading="handling" @ok="handleFeedback">
        <a-form layout="vertical">
          <a-form-item name="handleNote" :label="t('operations.handleNoteLabel')" required>
            <a-textarea v-model:value="handleForm.handleNote" :placeholder="t('operations.handleNotePlaceholder')" :rows="3" />
          </a-form-item>
        </a-form>
      </a-modal>
    </div>
  </div>
</template>

<style scoped>
.operations-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 80px;
  padding: 14px 16px;
  background: #ffffff;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: var(--od-radius-card, 12px);
  box-shadow: var(--od-shadow-xs);
}

.stat-card.urgent {
  border-color: rgba(220, 38, 38, 0.3);
  background: #fffafa;
}

.stat-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.stat-icon-wrap.notice {
  background: var(--od-primary-50, #eff6ff);
  color: var(--od-color-primary, #1e40af);
}

.stat-icon-wrap.published {
  background: #ecfdf5;
  color: #059669;
}

.stat-icon-wrap.feedback {
  background: #fffbeb;
  color: #d97706;
}

.stat-card.urgent .stat-icon-wrap.feedback {
  background: #fef2f2;
  color: #dc2626;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 13px;
  color: var(--od-gray-500, #64748b);
  font-weight: 500;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--od-gray-900, #0f172a);
  font-family: var(--od-font-mono, monospace);
  line-height: 1.2;
}

.stat-card.urgent .stat-value {
  color: #dc2626;
}

.op-card {
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: var(--od-radius-card, 12px);
  overflow: hidden;
  box-shadow: var(--od-shadow-xs);
}

:deep(.op-card .ant-card-head) {
  min-height: 52px;
  padding: 0 18px;
  border-bottom-color: var(--od-gray-200, #e2e8f0);
}

:deep(.op-card .ant-card-head-title) {
  padding: 14px 0;
  color: var(--od-gray-900, #0f172a);
  font-size: 15px;
  font-weight: 650;
}

:deep(.op-card .ant-card-body) {
  padding: 16px 18px 18px;
}

.toolbar-area {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.op-card--feedback :deep(.od-empty) {
  min-height: 176px;
  padding: 24px 16px;
}

.mono-code {
  font-family: var(--od-font-mono, monospace);
  font-weight: 600;
}

@media (max-width: 900px) {
  .stats-row {
    grid-template-columns: 1fr;
  }

  :deep(.op-card .ant-card-head),
  :deep(.op-card .ant-card-body) {
    padding-left: 14px;
    padding-right: 14px;
  }
}
</style>
