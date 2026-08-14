<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { operationsApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { Feedback, Notice, OperationsStatistics } from '@/types/portal'

const { t } = useI18n()
const messageStore = useMessageStore()

const statistics = ref<OperationsStatistics>({ noticeTotal: 0, publishedNotices: 0, pendingFeedbacks: 0 })

const noticeLoading = ref(false)
const notices = ref<Notice[]>([])
const noticeTotal = ref(0)
const noticeQuery = reactive({ page: 1, size: 20, status: '', section: '' })
const noticeColumns = computed(() => [
  { title: t('common.code'), dataIndex: 'code', key: 'code' },
  { title: t('common.title'), dataIndex: 'title', key: 'title' },
  { title: t('common.section'), dataIndex: 'section', key: 'section' },
  { title: t('common.status'), dataIndex: 'status', key: 'status' },
  { title: t('common.action'), dataIndex: 'action', key: 'action' },
])

const noticeOpen = ref(false)
const noticeCreating = ref(false)
const noticeForm = reactive({ title: '', content: '', section: 'announcement' })

const feedbackLoading = ref(false)
const feedbacks = ref<Feedback[]>([])
const feedbackTotal = ref(0)
const feedbackQuery = reactive({ page: 1, size: 20, status: '' })
const feedbackColumns = computed(() => [
  { title: t('common.code'), dataIndex: 'code', key: 'code' },
  { title: t('common.title'), dataIndex: 'title', key: 'title' },
  { title: t('common.status'), dataIndex: 'status', key: 'status' },
  { title: t('common.handleNote'), dataIndex: 'handleNote', key: 'handleNote' },
  { title: t('common.action'), dataIndex: 'action', key: 'action' },
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

/** 公告/反馈状态展示文案（状态值本身是后端协议编码，界面按语言翻译展示）。 */
const noticeStatusText: Record<string, string> = {
  DRAFT: t('operations.draft'),
  PUBLISHED: t('operations.published'),
  ARCHIVED: t('operations.archived'),
}
const feedbackStatusText: Record<string, string> = {
  PENDING: t('operations.pending'),
  HANDLED: t('operations.handled'),
}

async function loadStatistics() {
  try {
    statistics.value = await operationsApi.statistics()
  } catch (error) {
    messageStore.reportError(error)
  }
}

async function loadNotices() {
  noticeLoading.value = true
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
    messageStore.reportError(error)
  } finally {
    feedbackLoading.value = false
  }
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
  try {
    await operationsApi.publishNotice(record.code)
    messageStore.success(t('operations.noticePublished', { code: record.code }))
    await Promise.all([loadNotices(), loadStatistics()])
  } catch (error) {
    messageStore.reportError(error)
  }
}

async function archiveNotice(record: Notice) {
  try {
    await operationsApi.archiveNotice(record.code)
    messageStore.success(t('operations.noticeArchived', { code: record.code }))
    await Promise.all([loadNotices(), loadStatistics()])
  } catch (error) {
    messageStore.reportError(error)
  }
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
  loadStatistics()
  loadNotices()
  loadFeedbacks()
})
</script>

<template>
  <a-card>
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="8">
        <a-statistic :title="t('operations.noticeTotal')" :value="statistics.noticeTotal" />
      </a-col>
      <a-col :span="8">
        <a-statistic :title="t('operations.publishedNotices')" :value="statistics.publishedNotices" />
      </a-col>
      <a-col :span="8">
        <a-statistic :title="t('operations.pendingFeedbacks')" :value="statistics.pendingFeedbacks" :value-style="{ color: statistics.pendingFeedbacks > 0 ? '#cf1322' : undefined }" />
      </a-col>
    </a-row>

    <a-space style="margin-bottom: 12px" wrap>
      <a-select v-model:value="noticeQuery.status" :placeholder="t('operations.noticeStatusPlaceholder')" allow-clear style="width: 140px">
        <a-select-option value="DRAFT">{{ t('operations.draft') }}</a-select-option>
        <a-select-option value="PUBLISHED">{{ t('operations.published') }}</a-select-option>
        <a-select-option value="ARCHIVED">{{ t('operations.archived') }}</a-select-option>
      </a-select>
      <a-input v-model:value="noticeQuery.section" :placeholder="t('operations.sectionPlaceholder')" style="width: 160px" />
      <a-button
        type="primary"
        @click="
          noticeQuery.page = 1;
          loadNotices()
        "
      >
        {{ t('operations.queryNotices') }}
      </a-button>
      <a-button @click="noticeOpen = true">{{ t('operations.publishNotice') }}</a-button>
    </a-space>

    <a-table
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
        <template v-if="column.key === 'status'">
          <a-tag :color="noticeStatusColor[record.status]">{{ noticeStatusText[record.status] ?? record.status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button v-if="record.status === 'DRAFT'" size="small" type="primary" @click="publishNotice(record)">
              {{ t('operations.publish') }}
            </a-button>
            <a-button v-if="record.status === 'PUBLISHED'" size="small" @click="archiveNotice(record)">
              {{ t('operations.archive') }}
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-divider orientation="left">{{ t('operations.userFeedback') }}</a-divider>

    <a-space style="margin-bottom: 12px" wrap>
      <a-select v-model:value="feedbackQuery.status" :placeholder="t('operations.feedbackStatusPlaceholder')" allow-clear style="width: 140px">
        <a-select-option value="PENDING">{{ t('operations.pending') }}</a-select-option>
        <a-select-option value="HANDLED">{{ t('operations.handled') }}</a-select-option>
      </a-select>
      <a-button
        type="primary"
        @click="
          feedbackQuery.page = 1;
          loadFeedbacks()
        "
      >
        {{ t('operations.queryFeedbacks') }}
      </a-button>
      <a-button @click="feedbackOpen = true">{{ t('operations.submitFeedback') }}</a-button>
    </a-space>

    <a-table
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
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 'HANDLED' ? 'success' : 'processing'">{{ feedbackStatusText[record.status] ?? record.status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button size="small" type="primary" :disabled="record.status !== 'PENDING'" @click="openHandle(record)">
            {{ t('operations.handle') }}
          </a-button>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="noticeOpen" :title="t('operations.noticeModalTitle')" :confirm-loading="noticeCreating" @ok="createNotice">
      <a-form layout="vertical">
        <a-form-item :label="t('operations.formTitle')" required>
          <a-input v-model:value="noticeForm.title" :placeholder="t('operations.noticeTitlePlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('operations.formContent')" required>
          <a-textarea v-model:value="noticeForm.content" :placeholder="t('operations.noticeContentPlaceholder')" :rows="4" />
        </a-form-item>
        <a-form-item :label="t('operations.formSection')" required>
          <a-input v-model:value="noticeForm.section" :placeholder="t('operations.sectionExample')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="feedbackOpen" :title="t('operations.feedbackModalTitle')" :confirm-loading="feedbackCreating" @ok="createFeedback">
      <a-form layout="vertical">
        <a-form-item :label="t('operations.formTitle')" required>
          <a-input v-model:value="feedbackForm.title" :placeholder="t('operations.feedbackTitlePlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('operations.formContent')" required>
          <a-textarea v-model:value="feedbackForm.content" :placeholder="t('operations.feedbackContentPlaceholder')" :rows="4" />
        </a-form-item>
        <a-form-item :label="t('operations.formContact')">
          <a-input v-model:value="feedbackForm.contact" :placeholder="t('operations.contactPlaceholder')" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="handleOpen" :title="t('operations.handleModalTitle')" :confirm-loading="handling" @ok="handleFeedback">
      <a-form layout="vertical">
        <a-form-item :label="t('operations.handleNoteLabel')" required>
          <a-textarea v-model:value="handleForm.handleNote" :placeholder="t('operations.handleNotePlaceholder')" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-card>
</template>
