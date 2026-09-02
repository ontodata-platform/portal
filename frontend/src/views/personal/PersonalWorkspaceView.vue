<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { personalApi, resultApi, taskApi } from '@/api/portal'
import { useIdentityStore } from '@/stores/identity'
import { useMessageStore } from '@/stores/message'
import type { PersonalTodo } from '@/types/portal'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const identityStore = useIdentityStore()
const messageStore = useMessageStore()

const todos = ref<PersonalTodo>({
  pendingApprovalCount: 0,
  myOpenRequirementCount: 0,
  myRequirementCount: 0,
  myApprovalCount: 0,
})
const runningTasks = ref(0)
const newResults = ref(0)
const unread = ref(0)

const hour = new Date().getHours()
const greeting = computed(() => {
  if (hour < 12) return t('personal.overview.greetingMorning')
  if (hour < 18) return t('personal.overview.greetingAfternoon')
  return t('personal.overview.greetingEvening')
})

const conclusion = computed(() => {
  if (todos.value.pendingApprovalCount > 0) {
    return t('personal.overview.conclusionPending', { n: todos.value.pendingApprovalCount })
  }
  if (unread.value > 0) {
    return t('personal.overview.conclusionUnread', { n: unread.value })
  }
  return t('personal.overview.conclusionClear')
})

const tabs = [
  { key: '/personal', name: 'personal-overview', labelKey: 'personal.overview.tabOverview' },
  { key: '/personal/tasks', name: 'personal-tasks', labelKey: 'personal.overview.tabTasks' },
  { key: '/personal/approvals', name: 'personal-approvals', labelKey: 'personal.overview.tabApprovals' },
  { key: '/personal/requirements', name: 'personal-requirements', labelKey: 'personal.overview.tabRequirements' },
  { key: '/personal/results', name: 'personal-results', labelKey: 'personal.overview.tabResults' },
  { key: '/personal/notifications', name: 'personal-notifications', labelKey: 'personal.overview.tabNotifications' },
]

const activeKey = computed(() => {
  const match = [...tabs].reverse().find((tab) => route.path === tab.key || route.name === tab.name)
  return match?.key ?? '/personal'
})

function onTabChange(key: string | number) {
  void router.push(String(key))
}

async function loadSummary() {
  try {
    const [todo, running, results, unreadRes] = await Promise.all([
      personalApi.todos(),
      taskApi.list({ page: 1, size: 1, status: 'RUNNING' }),
      resultApi.list({ page: 1, size: 1 }),
      personalApi.unreadCount(),
    ])
    todos.value = todo
    runningTasks.value = running.total
    newResults.value = results.total
    unread.value = unreadRes.unread
  } catch (error) {
    messageStore.reportError(error)
  }
}

onMounted(() => {
  void identityStore.fetchIdentity()
  void loadSummary()
})
</script>

<template>
  <div class="personal-workspace">
    <div class="greeting">
      {{ greeting }}，{{ identityStore.name }}
      <span class="context">
        {{ identityStore.tenantId }}
        <template v-if="identityStore.identity.projectId"> · {{ identityStore.identity.projectId }}</template>
      </span>
    </div>
    <div class="summary-bar" data-testid="personal-summary">
      <span>{{ t('personal.overview.summaryTodos', { n: todos.pendingApprovalCount }) }}</span>
      <span>{{ t('personal.overview.summaryRunning', { n: runningTasks }) }}</span>
      <span>{{ t('personal.overview.summaryResults', { n: newResults }) }}</span>
      <span>{{ t('personal.overview.summaryUnread', { n: unread }) }}</span>
      <em>{{ conclusion }}</em>
    </div>
    <a-tabs :active-key="activeKey" @change="onTabChange">
      <a-tab-pane v-for="tab in tabs" :key="tab.key" :tab="t(tab.labelKey)" />
    </a-tabs>
    <RouterView />
  </div>
</template>

<style scoped>
.personal-workspace {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.greeting {
  font-size: 20px;
  font-weight: 600;
  color: var(--od-gray-800, #1e293b);
}

.context {
  margin-left: 12px;
  font-size: 13px;
  font-weight: 400;
  color: var(--od-gray-500, #64748b);
}

.summary-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e8eef4;
}

.summary-bar em {
  font-style: normal;
  color: #1f4e79;
}
</style>
