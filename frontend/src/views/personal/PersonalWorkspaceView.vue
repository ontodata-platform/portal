<script setup lang="ts">
import {
  AuditOutlined,
  BellOutlined,
  CarryOutOutlined,
  DatabaseOutlined,
  FileDoneOutlined,
  PlusOutlined,
  RobotOutlined,
  SettingOutlined,
  SolutionOutlined,
  SyncOutlined,
} from '@ant-design/icons-vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { personalApi, resultApi, taskApi } from '@/api/portal'
import { useIdentityStore } from '@/stores/identity'
import { useMessageStore } from '@/stores/message'
import type { PersonalTodo } from '@/types/portal'
import { 中文展示 } from '@/ui-kit/展示文本'

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
  { key: '/personal', name: 'personal-overview', labelKey: 'personal.overview.tabOverview', icon: CarryOutOutlined },
  { key: '/personal/tasks', name: 'personal-tasks', labelKey: 'personal.overview.tabTasks', icon: SyncOutlined },
  { key: '/personal/approvals', name: 'personal-approvals', labelKey: 'personal.overview.tabApprovals', icon: AuditOutlined },
  { key: '/personal/requirements', name: 'personal-requirements', labelKey: 'personal.overview.tabRequirements', icon: SolutionOutlined },
  { key: '/personal/results', name: 'personal-results', labelKey: 'personal.overview.tabResults', icon: FileDoneOutlined },
  { key: '/personal/notifications', name: 'personal-notifications', labelKey: 'personal.overview.tabNotifications', icon: BellOutlined },
]

const activeKey = computed(() => {
  const match = [...tabs].reverse().find((tab) => route.path === tab.key || route.name === tab.name)
  return match?.key ?? '/personal'
})

function onTabChange(key: string | number) {
  void router.push(String(key))
}

function quickNavigate(path: string) {
  void router.push(path)
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
    <!-- 顶部工作台欢迎与快捷操作横幅 -->
    <div class="hero-banner od-blueprint">
      <div class="hero-left">
        <div class="greeting-row">
          <span class="greeting-text">{{ greeting }}，{{ identityStore.name }}</span>
          <a-tag color="blue" class="tenant-badge">{{ 中文展示(identityStore.tenantId) }}</a-tag>
          <a-tag v-if="identityStore.identity.projectId" color="purple" class="project-badge">
            {{ 中文展示(identityStore.identity.projectId) }}
          </a-tag>
        </div>
        <p class="hero-subtitle">
          <span class="conclusion-badge">{{ conclusion }}</span>
          统一管控数据资产、算法流水线与协同审批
        </p>
      </div>

      <!-- 快捷操作胶囊 -->
      <div class="hero-quick-actions">
        <button type="button" class="action-capsule primary" @click="quickNavigate('/assistant')">
          <RobotOutlined />
          <span>智能问答</span>
        </button>
        <button type="button" class="action-capsule" @click="quickNavigate('/data-workbench')">
          <DatabaseOutlined />
          <span>数据服务</span>
        </button>
        <button type="button" class="action-capsule" @click="quickNavigate('/algorithm-workbench')">
          <SettingOutlined />
          <span>算法工作台</span>
        </button>
        <button type="button" class="action-capsule" @click="quickNavigate('/personal/requirements')">
          <PlusOutlined />
          <span>提报需求</span>
        </button>
      </div>
    </div>

    <!-- 4 个关键指标卡片 (可点击直接穿透) -->
    <div class="metrics-grid">
      <button
        type="button"
        class="metric-card"
        :class="{ urgent: todos.pendingApprovalCount > 0 }"
        aria-label="查看待我审批"
        @click="quickNavigate('/personal/approvals')"
      >
        <div class="metric-icon-wrap approval">
          <AuditOutlined />
        </div>
        <div class="metric-info">
          <div class="metric-label">待我审批</div>
          <div class="metric-value">{{ todos.pendingApprovalCount }}</div>
        </div>
        <div v-if="todos.pendingApprovalCount > 0" class="metric-badge-pulse">待处理</div>
      </button>

      <button
        type="button"
        class="metric-card"
        aria-label="查看进行中任务"
        @click="quickNavigate('/personal/tasks')"
      >
        <div class="metric-icon-wrap task">
          <SyncOutlined :spin="runningTasks > 0" />
        </div>
        <div class="metric-info">
          <div class="metric-label">进行中任务</div>
          <div class="metric-value">{{ runningTasks }}</div>
        </div>
      </button>

      <button
        type="button"
        class="metric-card"
        aria-label="查看生成结果集"
        @click="quickNavigate('/personal/results')"
      >
        <div class="metric-icon-wrap result">
          <FileDoneOutlined />
        </div>
        <div class="metric-info">
          <div class="metric-label">生成结果集</div>
          <div class="metric-value">{{ newResults }}</div>
        </div>
      </button>

      <button
        type="button"
        class="metric-card"
        :class="{ has_unread: unread > 0 }"
        aria-label="查看未读通知"
        @click="quickNavigate('/personal/notifications')"
      >
        <div class="metric-icon-wrap notification">
          <BellOutlined />
        </div>
        <div class="metric-info">
          <div class="metric-label">未读通知</div>
          <div class="metric-value">{{ unread }}</div>
        </div>
      </button>
    </div>

    <!-- 保留 summary-bar 供测试与语义识别 -->
    <div class="summary-bar-hidden" data-testid="personal-summary">
      <span>{{ t('personal.overview.summaryTodos', { n: todos.pendingApprovalCount }) }}</span>
      <span>{{ t('personal.overview.summaryRunning', { n: runningTasks }) }}</span>
      <span>{{ t('personal.overview.summaryResults', { n: newResults }) }}</span>
      <span>{{ t('personal.overview.summaryUnread', { n: unread }) }}</span>
      <em>{{ conclusion }}</em>
    </div>

    <!-- 导航标签页 -->
    <div class="tab-container">
      <a-tabs :active-key="activeKey" class="workspace-tabs" @change="onTabChange">
        <a-tab-pane v-for="tab in tabs" :key="tab.key" :tab="t(tab.labelKey)">
          <template #tab>
            <span class="tab-label">
              <component :is="tab.icon" />
              <span>{{ t(tab.labelKey) }}</span>
            </span>
          </template>
        </a-tab-pane>
      </a-tabs>
    </div>

    <div class="tab-body">
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.personal-workspace {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.hero-banner {
  background-color: rgba(255,255,255,0.6);
  background-blend-mode: overlay;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  padding: 20px 24px;
  background: linear-gradient(135deg, #ffffff 0%, #f0f7ff 50%, #f8fafc 100%);
  border-radius: var(--od-radius-card, 12px);
  border: 1px solid var(--od-gray-200, #e2e8f0);
  box-shadow: var(--od-shadow-1);
}

.hero-left {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.greeting-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.greeting-text {
  font-size: 20px;
  font-weight: 700;
  color: var(--od-gray-900, #0f172a);
  letter-spacing: -0.01em;
}

.tenant-badge,
.project-badge {
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
}

.hero-subtitle {
  margin: 0;
  color: var(--od-gray-500, #64748b);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.conclusion-badge {
  color: var(--od-color-primary, #1e40af);
  font-weight: 600;
  background: var(--od-primary-50, #eff6ff);
  padding: 2px 8px;
  border-radius: 6px;
}

.hero-quick-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.action-capsule {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  background: #ffffff;
  color: var(--od-gray-700, #334155);
  cursor: pointer;
  box-shadow: var(--od-shadow-xs);
  transition: all 0.15s ease;
}

.action-capsule:hover {
  border-color: var(--od-primary-300, #93c5fd);
  color: var(--od-color-primary, #1e40af);
  transform: translateY(-1px);
  box-shadow: var(--od-shadow-1);
}

.action-capsule.primary {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
}

.action-capsule.primary:hover {
  background: linear-gradient(135deg, #1d4ed8, #1e40af);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.metric-card {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  font: inherit;
  text-align: left;
  background: #fff;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: var(--od-radius-card, 12px);
  box-shadow: var(--od-shadow-xs);
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.metric-card:hover {
  border-color: var(--od-primary-300, #93c5fd);
  box-shadow: var(--od-shadow-2);
  transform: translateY(-2px);
}

.metric-card.urgent {
  border-color: rgba(220, 38, 38, 0.3);
  background: #fffafa;
}

.metric-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.metric-icon-wrap.approval {
  background: #fef2f2;
  color: #dc2626;
}

.metric-icon-wrap.task {
  background: #eff6ff;
  color: #2563eb;
}

.metric-icon-wrap.result {
  background: #ecfdf5;
  color: #059669;
}

.metric-icon-wrap.notification {
  background: #fffbeb;
  color: #d97706;
}

.metric-info {
  display: flex;
  flex-direction: column;
}

.metric-label {
  font-size: 13px;
  color: var(--od-gray-500, #64748b);
  font-weight: 500;
}

.metric-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--od-gray-900, #0f172a);
  font-family: var(--od-font-mono, monospace);
  line-height: 1.2;
}

.metric-badge-pulse {
  position: absolute;
  top: 10px;
  right: 12px;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  background: #dc2626;
  color: #fff;
  font-weight: 600;
}

.summary-bar-hidden {
  display: none;
}

.tab-container {
  background: #fff;
  border-radius: var(--od-radius-card, 12px);
  padding: 4px 16px 0;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  box-shadow: var(--od-shadow-xs);
}

:deep(.workspace-tabs .ant-tabs-nav) {
  margin-bottom: 0 !important;
}

:deep(.workspace-tabs .ant-tabs-content-holder) {
  display: none !important;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.tab-body {
  min-height: 400px;
}

@media (max-width: 900px) {
  .hero-banner {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
