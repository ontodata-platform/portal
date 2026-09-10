<script setup lang="ts">
/**
 * 门户首页（B1）：登录后的默认落地页。
 * 四区结构：待办聚合（跨域口径见 HomeTodoAggregate）、公告与动态（仅已发布）、
 * 推荐服务位（D4 内容运营接管前为内置配置）、快捷入口。
 * 数据来自 GET /api/v1/content/home（mock 由 portalMockApi 路由承接）。
 */
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  DatabaseOutlined,
  FileDoneOutlined,
  FormOutlined,
  ExperimentOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { contentApi } from '@/api/content'
import { useIdentityStore } from '@/stores/identity'
import type { HomeData, HomeEntry } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import SkeletonList from '@/ui-kit/SkeletonList.vue'

const { t } = useI18n()
const router = useRouter()
const identityStore = useIdentityStore()

const homeData = ref<HomeData | null>(null)
const loading = ref(false)
const loadError = ref('')
const askText = ref('')

async function load(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    homeData.value = await contentApi.getHomeData()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
  }
}

onMounted(load)

/** 问候语按当前时段切换（上午/下午/晚上）。 */
const greeting = computed(() => {
  const hour = new Date().getHours()
  const key = hour < 12 ? 'home.greetingMorning' : hour < 18 ? 'home.greetingAfternoon' : 'home.greetingEvening'
  return t(key, { name: homeData.value?.greetingName || identityStore.name })
})

/** 待办四格：数字来自跨域聚合，点击直达对应办理位置。 */
const todoMetrics = computed(() => {
  const todo = homeData.value?.todo
  return [
    { key: 'pendingApprovals', label: t('home.todoApprovals'), value: todo?.pendingApprovals ?? 0, target: '/personal/approvals' },
    { key: 'runningTasks', label: t('home.todoTasks'), value: todo?.runningTasks ?? 0, target: '/personal/tasks' },
    { key: 'openRequirements', label: t('home.todoRequirements'), value: todo?.openRequirements ?? 0, target: '/personal/requirements' },
    { key: 'unread', label: t('home.todoUnread'), value: todo?.unread ?? 0, target: '/personal/notifications' },
  ]
})

const entryIcons = {
  database: DatabaseOutlined,
  appstore: AppstoreOutlined,
  robot: RobotOutlined,
  'file-done': FileDoneOutlined,
} as const

/** 快捷入口（B1 内置；D4 内容运营上线后可配置化）。 */
const quickActions = computed(() => [
  { key: 'requirement', label: t('home.quickRequirement'), icon: FormOutlined, target: '/personal/requirements' },
  { key: 'algorithm', label: t('home.quickAlgorithm'), icon: ExperimentOutlined, target: '/algorithm-workbench' },
  { key: 'result', label: t('home.quickResult'), icon: FileDoneOutlined, target: '/personal/results' },
  { key: 'permission', label: t('home.quickPermission'), icon: SafetyCertificateOutlined, target: '/personal' },
])

function openEntry(entry: HomeEntry): void {
  router.push(entry.route)
}

/** 首页快捷提问：带话术直达智能服务，空话术仅进入会话页。 */
function goAsk(): void {
  const question = askText.value.trim()
  router.push(question ? { path: '/assistant', query: { q: question } } : '/assistant')
}
</script>

<template>
  <div class="home-view">
    <!-- 问候 + 智能服务快捷提问 -->
    <section class="hero-card">
      <h1 class="hero-greeting">{{ greeting }}</h1>
      <p class="hero-hint">{{ t('home.hint') }}</p>
      <div class="hero-ask">
        <a-input
          v-model:value="askText"
          :placeholder="t('home.askPlaceholder')"
          size="large"
          allow-clear
          @press-enter="goAsk"
        >
          <template #prefix><SearchOutlined /></template>
        </a-input>
        <a-button type="primary" size="large" @click="goAsk">{{ t('home.ask') }}</a-button>
      </div>
    </section>

    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />
    <SkeletonList v-else-if="loading" variant="cards" :rows="4" />

    <template v-else-if="homeData">
      <div class="home-grid">
        <!-- 我的待办：跨域聚合，点击直达对应签页 -->
        <section class="panel todo-panel" :aria-label="t('home.todoTitle')">
          <h2 class="panel-title">{{ t('home.todoTitle') }}</h2>
          <button
            v-for="metric in todoMetrics"
            :key="metric.key"
            type="button"
            class="todo-metric"
            @click="router.push(metric.target)"
          >
            <span class="todo-value">{{ metric.value }}</span>
            <span class="todo-label">
              {{ metric.label }}
              <ArrowRightOutlined class="todo-arrow" />
            </span>
          </button>
        </section>

        <!-- 公告与动态：仅已发布公告 -->
        <section class="panel notice-panel" :aria-label="t('home.noticesTitle')">
          <h2 class="panel-title">{{ t('home.noticesTitle') }}</h2>
          <EmptyState v-if="homeData.notices.length === 0" :title="t('home.noticesEmpty')" />
          <ul v-else class="notice-list">
            <li v-for="notice in homeData.notices" :key="notice.code" class="notice-item">
              <a-tag color="blue" class="notice-section">{{ notice.section }}</a-tag>
              <span class="notice-title">{{ notice.title }}</span>
              <span class="notice-date">{{ notice.publishedAt?.slice(0, 10) }}</span>
            </li>
          </ul>
        </section>
      </div>

      <!-- 推荐服务位 -->
      <section class="panel" :aria-label="t('home.entriesTitle')">
        <h2 class="panel-title">{{ t('home.entriesTitle') }}</h2>
        <div class="entry-grid">
          <button
            v-for="entry in homeData.entries"
            :key="entry.code"
            type="button"
            class="entry-card"
            @click="openEntry(entry)"
          >
            <component :is="entryIcons[entry.icon]" class="entry-icon" />
            <span class="entry-title">{{ entry.title }}</span>
            <span class="entry-desc">{{ entry.description }}</span>
          </button>
        </div>
      </section>

      <!-- 快捷入口 -->
      <section class="panel" :aria-label="t('home.quickTitle')">
        <h2 class="panel-title">{{ t('home.quickTitle') }}</h2>
        <div class="quick-row">
          <button
            v-for="action in quickActions"
            :key="action.key"
            type="button"
            class="quick-action"
            @click="router.push(action.target)"
          >
            <component :is="action.icon" />
            <span>{{ action.label }}</span>
            <ArrowRightOutlined class="quick-arrow" />
          </button>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1180px;
  margin: 0 auto;
}

.hero-card {
  padding: 28px 32px;
  border-radius: 12px;
  background: linear-gradient(135deg, #eff6ff 0%, #ffffff 70%);
  border: 1px solid var(--od-gray-200, #e2e8f0);
}

.hero-greeting {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.hero-hint {
  margin: 6px 0 16px;
  color: var(--od-gray-500, #64748b);
}

.hero-ask {
  display: flex;
  gap: 12px;
  max-width: 640px;
}

.home-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
}

.panel {
  padding: 18px 20px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 12px;
  background: #fff;
}

.panel-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.todo-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  align-content: start;
}

.todo-metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 10px;
  background: #f8fafc;
  cursor: pointer;
  text-align: left;
}

.todo-metric:hover {
  border-color: var(--od-primary, #2563eb);
}

.todo-value {
  font-size: 22px;
  font-weight: 600;
  color: var(--od-primary, #2563eb);
  font-variant-numeric: tabular-nums;
}

.todo-label {
  font-size: 12px;
  color: var(--od-gray-500, #64748b);
}

.todo-arrow {
  margin-left: 4px;
}

.notice-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.notice-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 2px;
  border-bottom: 1px dashed var(--od-gray-200, #e2e8f0);
}

.notice-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-date {
  font-size: 12px;
  color: var(--od-gray-500, #64748b);
  font-variant-numeric: tabular-nums;
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.entry-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 16px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  text-align: left;
}

.entry-card:hover {
  border-color: var(--od-primary, #2563eb);
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.12);
}

.entry-icon {
  font-size: 20px;
  color: var(--od-primary, #2563eb);
}

.entry-title {
  font-weight: 600;
}

.entry-desc {
  font-size: 12px;
  color: var(--od-gray-500, #64748b);
}

.quick-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.quick-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
}

.quick-action:hover {
  border-color: var(--od-primary, #2563eb);
}

.quick-arrow {
  margin-left: auto;
}

@media (max-width: 960px) {
  .home-grid {
    grid-template-columns: 1fr;
  }
}
</style>
