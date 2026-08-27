<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { personalApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { PortalNotification } from '@/types/portal'

const { t } = useI18n()
const router = useRouter()
const messageStore = useMessageStore()

const loading = ref(false)
const rows = ref<PortalNotification[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20 })

const columns = computed(() => [
  { title: t('common.type'), dataIndex: 'type', key: 'type', width: 160 },
  { title: t('common.title'), dataIndex: 'title', key: 'title' },
  { title: t('common.updatedAt'), dataIndex: 'createdAt', key: 'createdAt', width: 200 },
  { title: t('common.status'), dataIndex: 'readAt', key: 'readAt', width: 100 },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 120 },
])

async function load() {
  loading.value = true
  try {
    const page = await personalApi.notifications({ page: query.page, size: query.size })
    rows.value = page.items
    total.value = page.total
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

async function markRead(id: string) {
  try {
    await personalApi.markRead(id)
    messageStore.success(t('notifications.marked'))
    await load()
  } catch (error) {
    messageStore.reportError(error)
  }
}

async function markAllRead() {
  try {
    await personalApi.markAllRead()
    messageStore.success(t('notifications.marked'))
    await load()
  } catch (error) {
    messageStore.reportError(error)
  }
}

function openResource(item: PortalNotification) {
  if (item.type === 'APPROVAL_DECIDED') {
    router.push('/approvals')
    return
  }
  if (item.type === 'TASK_COMPLETED') {
    router.push('/tasks')
  }
}

onMounted(load)
</script>

<template>
  <a-card :bordered="false">
    <a-space style="margin-bottom: 16px">
      <a-button @click="markAllRead">{{ t('notifications.markAllRead') }}</a-button>
    </a-space>
    <a-table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      row-key="id"
      :pagination="{ current: query.page, pageSize: query.size, total }"
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
        <template v-else-if="column.key === 'readAt'">
          <a-tag :color="record.readAt ? 'default' : 'orange'">
            {{ record.readAt ? t('notifications.all') : t('notifications.unread') }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button v-if="!record.readAt" size="small" @click="markRead(record.id)">
              {{ t('notifications.markRead') }}
            </a-button>
            <a-button size="small" type="link" @click="openResource(record)">{{ t('common.detail') }}</a-button>
          </a-space>
        </template>
      </template>
    </a-table>
  </a-card>
</template>
