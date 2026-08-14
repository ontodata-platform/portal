<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import { operationsApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { Feedback, Notice, OperationsStatistics } from '@/types/portal'

const messageStore = useMessageStore()

const statistics = ref<OperationsStatistics>({ noticeTotal: 0, publishedNotices: 0, pendingFeedbacks: 0 })

const noticeLoading = ref(false)
const notices = ref<Notice[]>([])
const noticeTotal = ref(0)
const noticeQuery = reactive({ page: 1, size: 20, status: '', section: '' })
const noticeColumns = [
  { title: '编码', dataIndex: 'code', key: 'code' },
  { title: '标题', dataIndex: 'title', key: 'title' },
  { title: '栏目', dataIndex: 'section', key: 'section' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '操作', dataIndex: 'action', key: 'action' },
]

const noticeOpen = ref(false)
const noticeCreating = ref(false)
const noticeForm = reactive({ title: '', content: '', section: 'announcement' })

const feedbackLoading = ref(false)
const feedbacks = ref<Feedback[]>([])
const feedbackTotal = ref(0)
const feedbackQuery = reactive({ page: 1, size: 20, status: '' })
const feedbackColumns = [
  { title: '编码', dataIndex: 'code', key: 'code' },
  { title: '标题', dataIndex: 'title', key: 'title' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '处理说明', dataIndex: 'handleNote', key: 'handleNote' },
  { title: '操作', dataIndex: 'action', key: 'action' },
]

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
    messageStore.success('公告已创建（草稿状态，发布后对外可见）')
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
    messageStore.success(`公告 ${record.code} 已发布`)
    await Promise.all([loadNotices(), loadStatistics()])
  } catch (error) {
    messageStore.reportError(error)
  }
}

async function archiveNotice(record: Notice) {
  try {
    await operationsApi.archiveNotice(record.code)
    messageStore.success(`公告 ${record.code} 已归档`)
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
    messageStore.success('反馈已提交，感谢您的建议')
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
    messageStore.success(`反馈 ${handleTarget.value.code} 已处理`)
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
        <a-statistic title="公告总数" :value="statistics.noticeTotal" />
      </a-col>
      <a-col :span="8">
        <a-statistic title="已发布公告" :value="statistics.publishedNotices" />
      </a-col>
      <a-col :span="8">
        <a-statistic title="待处理反馈" :value="statistics.pendingFeedbacks" :value-style="{ color: statistics.pendingFeedbacks > 0 ? '#cf1322' : undefined }" />
      </a-col>
    </a-row>

    <a-space style="margin-bottom: 12px" wrap>
      <a-select v-model:value="noticeQuery.status" placeholder="公告状态" allow-clear style="width: 140px">
        <a-select-option value="DRAFT">草稿</a-select-option>
        <a-select-option value="PUBLISHED">已发布</a-select-option>
        <a-select-option value="ARCHIVED">已归档</a-select-option>
      </a-select>
      <a-input v-model:value="noticeQuery.section" placeholder="栏目" style="width: 160px" />
      <a-button
        type="primary"
        @click="
          noticeQuery.page = 1;
          loadNotices()
        "
      >
        查询公告
      </a-button>
      <a-button @click="noticeOpen = true">发布公告</a-button>
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
          <a-tag :color="noticeStatusColor[record.status]">{{ record.status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button v-if="record.status === 'DRAFT'" size="small" type="primary" @click="publishNotice(record)">
              发布
            </a-button>
            <a-button v-if="record.status === 'PUBLISHED'" size="small" @click="archiveNotice(record)">
              归档
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <a-divider orientation="left">用户反馈</a-divider>

    <a-space style="margin-bottom: 12px" wrap>
      <a-select v-model:value="feedbackQuery.status" placeholder="反馈状态" allow-clear style="width: 140px">
        <a-select-option value="PENDING">待处理</a-select-option>
        <a-select-option value="HANDLED">已处理</a-select-option>
      </a-select>
      <a-button
        type="primary"
        @click="
          feedbackQuery.page = 1;
          loadFeedbacks()
        "
      >
        查询反馈
      </a-button>
      <a-button @click="feedbackOpen = true">提交反馈</a-button>
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
          <a-tag :color="record.status === 'HANDLED' ? 'success' : 'processing'">{{ record.status }}</a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-button size="small" type="primary" :disabled="record.status !== 'PENDING'" @click="openHandle(record)">
            处理
          </a-button>
        </template>
      </template>
    </a-table>

    <a-modal v-model:open="noticeOpen" title="发布公告" :confirm-loading="noticeCreating" @ok="createNotice">
      <a-form layout="vertical">
        <a-form-item label="标题" required>
          <a-input v-model:value="noticeForm.title" placeholder="公告标题" />
        </a-form-item>
        <a-form-item label="内容" required>
          <a-textarea v-model:value="noticeForm.content" placeholder="公告内容" :rows="4" />
        </a-form-item>
        <a-form-item label="栏目" required>
          <a-input v-model:value="noticeForm.section" placeholder="如 announcement" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="feedbackOpen" title="提交反馈" :confirm-loading="feedbackCreating" @ok="createFeedback">
      <a-form layout="vertical">
        <a-form-item label="标题" required>
          <a-input v-model:value="feedbackForm.title" placeholder="反馈标题" />
        </a-form-item>
        <a-form-item label="内容" required>
          <a-textarea v-model:value="feedbackForm.content" placeholder="反馈内容" :rows="4" />
        </a-form-item>
        <a-form-item label="联系方式">
          <a-input v-model:value="feedbackForm.contact" placeholder="联系方式（可空）" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:open="handleOpen" title="处理反馈" :confirm-loading="handling" @ok="handleFeedback">
      <a-form layout="vertical">
        <a-form-item label="处理说明（必填，办理证据）" required>
          <a-textarea v-model:value="handleForm.handleNote" placeholder="例如：已排期下个版本增加搜索" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-card>
</template>
