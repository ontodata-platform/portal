<script setup lang="ts">
/**
 * 待办中心（C2）：顶栏铃铛的落地页。
 * 待办签 = 跨域聚合（审批待办/异常任务），消息签复用通知组件；审批待办直达事项详情办理。
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { approvalApi, personalApi } from '@/api/portal'
import { slaColorOf } from '@/constants/statusMeta'
import { useMessageStore } from '@/stores/message'
import type { TodoAggregateItem } from '@/types/portal'
import NotificationSection from '@/views/personal/sections/NotificationSection.vue'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import SkeletonList from '@/ui-kit/SkeletonList.vue'
import { 中文展示 } from '@/ui-kit/展示文本'

const { t } = useI18n()
const router = useRouter()
const messageStore = useMessageStore()

// C2-2：审批待办支持批量通过/驳回（复用 batch-decision 契约）
const selectedApprovals = ref<string[]>([])
const batching = ref(false)

function toggleSelect(item: TodoAggregateItem, checked: boolean): void {
  if (item.kind !== 'APPROVAL') return
  selectedApprovals.value = checked
    ? [...selectedApprovals.value, item.code]
    : selectedApprovals.value.filter((code) => code !== item.code)
}

async function batchDecide(decision: 'APPROVED' | 'REJECTED'): Promise<void> {
  if (selectedApprovals.value.length === 0) return
  batching.value = true
  try {
    await approvalApi.batchDecide({ codes: [...selectedApprovals.value], decision })
    messageStore.success(t('todos.batchDone', { count: selectedApprovals.value.length }))
    selectedApprovals.value = []
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    batching.value = false
  }
}

const activeTab = ref<'todos' | 'messages'>('todos')
const loading = ref(false)
const loadError = ref('')
const items = ref<TodoAggregateItem[]>([])

const kindLabel = computed<Record<string, string>>(() => ({
  APPROVAL: t('todos.kindApproval'),
  CORRECTION: t('todos.kindCorrection'),
  URGE: t('todos.kindUrge'),
  ANOMALY: t('todos.kindAnomaly'),
}))

// C1-3：SLA 颜色统一来自字典
const slaTone = (sla: string | null): string => slaColorOf(sla)

async function load(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    items.value = (await personalApi.aggregateTodos()).items
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="todo-center">
    <a-tabs v-model:active-key="activeTab">
      <a-tab-pane key="todos" :tab="t('todos.tabTodos')">
        <a-card :bordered="false" class="todo-card">
          <ErrorState
            v-if="loadError"
            :reason="loadError"
            :next-step="t('common.loadNextStep')"
            :action-label="t('common.reload')"
            @retry="load"
          />
          <SkeletonList v-else-if="loading" variant="list" :rows="5" />
          <EmptyState
            v-else-if="items.length === 0"
            :title="t('todos.emptyTitle')"
            :description="t('todos.emptyDesc')"
          />
          <template v-else>
            <div v-if="selectedApprovals.length > 0" class="batch-bar">
              <span>{{ t('todos.batchSelected', { count: selectedApprovals.length }) }}</span>
              <a-button size="small" type="primary" :loading="batching" @click="batchDecide('APPROVED')">
                {{ t('todos.batchApprove') }}
              </a-button>
              <a-button size="small" danger :loading="batching" @click="batchDecide('REJECTED')">
                {{ t('todos.batchReject') }}
              </a-button>
            </div>
            <div v-for="item in items" :key="`${item.kind}-${item.code}`" class="todo-row">
              <a-checkbox
                v-if="item.kind === 'APPROVAL'"
                :checked="selectedApprovals.includes(item.code)"
                @update:checked="(checked: boolean) => toggleSelect(item, checked)"
              />
              <a-tag :color="item.kind === 'ANOMALY' ? 'error' : 'processing'" class="todo-kind">
                {{ kindLabel[item.kind] ?? item.kind }}
              </a-tag>
              <button type="button" class="todo-title" @click="router.push(item.route)">
                {{ item.title }}
              </button>
              <a-tag
                v-if="item.slaStatus && item.slaStatus !== 'ON_TIME' && item.slaStatus !== 'MET'"
                :color="slaTone(item.slaStatus)"
              >
                {{ 中文展示(item.slaStatus) }}
              </a-tag>
              <a-button size="small" type="primary" ghost @click="router.push(item.route)">
                {{ t('todos.goHandle') }}
              </a-button>
            </div>
          </template>
        </a-card>
      </a-tab-pane>
      <a-tab-pane key="messages" :tab="t('todos.tabMessages')">
        <NotificationSection />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<style scoped>
.todo-center {
  max-width: 960px;
  margin: 0 auto;
}

.todo-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px dashed var(--od-gray-200, #e2e8f0);
}

.todo-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
}

.todo-title:hover {
  color: var(--od-primary, #2563eb);
}

.todo-kind {
  flex-shrink: 0;
}

.batch-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  margin-bottom: 8px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 8px;
  background: #f8fafc;
  font-size: 13px;
}
</style>
