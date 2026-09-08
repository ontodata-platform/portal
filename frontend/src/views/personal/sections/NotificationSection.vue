<script setup lang="ts">
import { CheckOutlined } from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { personalApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { PortalNotification } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import { formatDateTime } from '@/ui-kit/format'
import OdTable from '@/ui-kit/OdTable.vue'

const { t } = useI18n()
const router = useRouter()
const messageStore = useMessageStore()

const loading = ref(false)
const loadError = ref('')
const rows = ref<PortalNotification[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20 })
const markingAll = ref(false)
const markingId = ref('')

const columns = computed(() => [
  { title: t('common.type'), dataIndex: 'type', key: 'type', width: 160, odEllipsis: true, odSortable: true },
  { title: t('common.title'), dataIndex: 'title', key: 'title', odEllipsis: true, odSortable: true },
  { title: t('common.updatedAt'), dataIndex: 'createdAt', key: 'createdAt', width: 200, odSortable: true },
  { title: t('common.status'), dataIndex: 'readAt', key: 'readAt', width: 100, odSortable: true },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 120 },
])

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
    const page = await personalApi.notifications({ page: query.page, size: query.size })
    rows.value = page.items
    total.value = page.total
  } catch (error) {
    loadError.value = describeLoadError(error)
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

async function markRead(id: string) {
  if (markingAll.value) return
  markingId.value = id
  try {
    await personalApi.markRead(id)
    messageStore.success(t('notifications.marked'))
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    markingId.value = ''
  }
}

async function markAllRead() {
  if (markingId.value) return
  markingAll.value = true
  try {
    await personalApi.markAllRead()
    messageStore.success(t('notifications.marked'))
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    markingAll.value = false
  }
}

function openResource(item: PortalNotification) {
  if (item.type === 'APPROVAL_DECIDED') {
    void router.push('/personal/approvals')
    return
  }
  if (item.type === 'TASK_COMPLETED') {
    void router.push('/personal/tasks')
  }
}

onMounted(load)
</script>

<template>
  <div class="notification-section">
    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />

    <a-card v-else :bordered="false" class="notifications-card">
      <div class="notification-toolbar">
        <a-button
          type="primary"
          ghost
          :loading="markingAll"
          :disabled="Boolean(markingId)"
          @click="markAllRead"
        >
          <template #icon><CheckOutlined /></template>
          {{ t('notifications.markAllRead') }}
        </a-button>
      </div>
      <EmptyState
        v-if="!loading && rows.length === 0"
        :title="t('notifications.empty')"
        :description="t('notifications.emptyDesc')"
      />
      <OdTable
        v-else
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        row-key="id"
        class="notification-table"
        :pagination="{ current: query.page, pageSize: query.size, total, showTotal: (tot: number) => `共 ${tot} 项` }"
        @change="
          (pagination: { current?: number }) => {
            query.page = pagination.current ?? 1
            load()
          }
        "
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'type'">
            <a-tag :color="record.type === 'APPROVAL_DECIDED' ? 'blue' : 'green'">
              {{
                record.type === 'APPROVAL_DECIDED'
                  ? t('notifications.approvalDecided')
                  : t('notifications.taskCompleted')
              }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'title'">
            <span class="notice-title-text" :class="{ unread: !record.readAt }">{{ record.title }}</span>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDateTime(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'readAt'">
            <a-tag :color="record.readAt ? 'default' : 'orange'">
              {{ record.readAt ? t('notifications.all') : t('notifications.unread') }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button
                v-if="!record.readAt"
                size="small"
                :loading="markingId === record.id"
                :disabled="markingAll"
                @click="markRead(record.id)"
              >
                {{ t('notifications.markRead') }}
              </a-button>
              <a-button size="small" type="link" @click="openResource(record)">{{ t('common.detail') }}</a-button>
            </a-space>
          </template>
        </template>
      </OdTable>
    </a-card>
  </div>
</template>

<style scoped>
.notifications-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: var(--od-shadow-1);
}

.notification-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.notice-title-text {
  font-size: 13px;
  color: var(--od-gray-700, #334155);
}

.notice-title-text.unread {
  font-weight: 600;
  color: var(--od-gray-900, #0f172a);
}
</style>
