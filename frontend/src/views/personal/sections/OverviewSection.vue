<script setup lang="ts">
import { ArrowRightOutlined, BellOutlined, FileDoneOutlined } from '@ant-design/icons-vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { personalApi, resultApi, taskApi } from '@/api/portal'
import type { PortalNotification, PortalResult, PortalTask } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import { formatDate } from '@/ui-kit/format'

const { t, locale } = useI18n()
const router = useRouter()

const results = ref<PortalResult[]>([])
const notifications = ref<PortalNotification[]>([])
const recentTasks = ref<PortalTask[]>([])

/** 近 7 天（含今天）逐日任务数，来自我的任务列表的更新时间 */
const weekBars = computed(() => {
  const buckets = Array.from({ length: 7 }, (_, index) => {
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - (6 - index))
    return { date: day, count: 0 }
  })
  for (const task of recentTasks.value) {
    const updated = new Date(task.updatedAt)
    for (const bucket of buckets) {
      const next = new Date(bucket.date)
      next.setDate(next.getDate() + 1)
      if (updated >= bucket.date && updated < next) {
        bucket.count += 1
        break
      }
    }
  }
  const weekdayFormatter = new Intl.DateTimeFormat(locale.value === 'en-US' ? 'en-US' : 'zh-CN', {
    weekday: 'short',
  })
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count))
  return buckets.map((bucket) => ({
    label: weekdayFormatter.format(bucket.date),
    date: formatDate(bucket.date),
    count: bucket.count,
    heightPercent: Math.round((bucket.count / max) * 100),
    isToday: bucket.date.toDateString() === new Date().toDateString(),
  }))
})

const weekTotal = computed(() => weekBars.value.reduce((sum, bucket) => sum + bucket.count, 0))

async function load() {
  const [resultPage, noticePage, taskPage] = await Promise.allSettled([
    resultApi.list({ page: 1, size: 4 }),
    personalApi.notifications({ page: 1, size: 4 }),
    taskApi.list({ page: 1, size: 100 }),
  ])
  if (resultPage.status === 'fulfilled') results.value = resultPage.value.items
  if (noticePage.status === 'fulfilled') notifications.value = noticePage.value.items
  if (taskPage.status === 'fulfilled') recentTasks.value = taskPage.value.items
}

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="overview">
    <!-- 近 7 天任务执行活跃度卡片 -->
    <a-card :bordered="false" class="week-card">
      <template #title>
        <div class="card-header-flex">
          <span class="card-title">{{ t('personal.overview.weeklyTitle') }}</span>
          <span class="badge-total">{{ t('personal.overview.weeklyTotal', { total: weekTotal }) }}</span>
        </div>
      </template>
      <div
        class="week-chart"
        role="img"
        :aria-label="t('personal.overview.weeklyAria', { total: weekTotal })"
      >
        <div
          v-for="bar in weekBars"
          :key="bar.label"
          class="week-column"
          :class="{ today: bar.isToday }"
          role="button"
          tabindex="0"
          @click="router.push({ path: '/personal/tasks', query: { date: bar.date } })"
          @keydown.enter="router.push({ path: '/personal/tasks', query: { date: bar.date } })"
        >
          <span class="week-bubble">{{ bar.label }} · {{ bar.count }} 项</span>
          <span class="week-count">{{ bar.count }}</span>
          <div class="week-bar-container">
            <span class="week-bar" :style="{ height: `${Math.max(bar.heightPercent, 8)}%` }"></span>
          </div>
          <span class="week-label">{{ bar.label }}</span>
        </div>
      </div>
      <div class="week-foot">
        <span class="chart-tip">💡 点击柱体可直接查看当日任务明细</span>
        <a class="drilldown-link" @click="router.push('/personal/tasks')">
          {{ t('personal.overview.weeklyLink') }}
          <ArrowRightOutlined />
        </a>
      </div>
    </a-card>

    <!-- 最新产出与动态通知双栏 -->
    <a-row :gutter="16">
      <a-col :xs="24" :lg="12">
        <a-card :bordered="false" class="section-card">
          <template #title>
            <div class="card-header-flex">
              <span class="card-title">
                <FileDoneOutlined style="color: #059669; margin-right: 6px" />
                {{ t('personal.overview.recentResults') }}
              </span>
              <a-button type="link" size="small" @click="router.push('/personal/results')">
                全部
              </a-button>
            </div>
          </template>
          <EmptyState
            v-if="results.length === 0"
            :title="t('personal.overview.emptyResults')"
            :action-label="t('personal.overview.tabResults')"
            @action="router.push('/personal/results')"
          />
          <div v-else class="result-list">
            <div
              v-for="item in results"
              :key="item.resultId"
              class="result-item"
              role="button"
              tabindex="0"
              @click="router.push('/personal/results')"
            >
              <div class="result-main">
                <span class="result-id">{{ item.resultId }}</span>
                <a-tag color="blue" class="source-tag">{{ item.sourceSystem }}</a-tag>
              </div>
              <span class="result-date">{{ formatDate(item.createdAt) }}</span>
            </div>
          </div>
        </a-card>
      </a-col>

      <a-col :xs="24" :lg="12">
        <a-card :bordered="false" class="section-card">
          <template #title>
            <div class="card-header-flex">
              <span class="card-title">
                <BellOutlined style="color: #d97706; margin-right: 6px" />
                {{ t('personal.overview.recentNotifications') }}
              </span>
              <a-button type="link" size="small" @click="router.push('/personal/notifications')">
                全部
              </a-button>
            </div>
          </template>
          <EmptyState
            v-if="notifications.length === 0"
            :title="t('personal.overview.emptyNotifications')"
            :action-label="t('personal.overview.tabNotifications')"
            @action="router.push('/personal/notifications')"
          />
          <div v-else class="notice-list">
            <div
              v-for="item in notifications"
              :key="item.id"
              class="notice-item"
              :class="{ unread: !item.readAt }"
              role="button"
              tabindex="0"
              @click="router.push('/personal/notifications')"
            >
              <div class="notice-title-row">
                <span v-if="!item.readAt" class="notice-dot"></span>
                <span class="notice-title">{{ item.title }}</span>
              </div>
              <span class="notice-time">{{ formatDate(item.createdAt) }}</span>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.week-card,
.section-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: var(--od-shadow-xs);
  border: 1px solid var(--od-gray-200, #e2e8f0);
}

.card-header-flex {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 15px;
  font-weight: 650;
  color: var(--od-gray-900, #0f172a);
}

.badge-total {
  font-size: 12px;
  font-weight: 600;
  color: var(--od-color-accent, #2563eb);
  background: var(--od-primary-50, #eff6ff);
  padding: 3px 10px;
  border-radius: 20px;
}

.week-chart {
  display: flex;
  align-items: stretch;
  gap: 12px;
  height: 140px;
  padding: 10px 0 0;
}

.week-column {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  border-radius: 8px;
  padding: 6px 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.week-bubble {
  position: absolute;
  top: -6px;
  transform: translateY(-100%);
  background: var(--od-gray-900, #0f172a);
  color: #fff;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms ease;
  z-index: 2;
}

.week-column:hover .week-bubble,
.week-column:focus-visible .week-bubble {
  opacity: 1;
}

.week-column:hover,
.week-column.today {
  background: var(--od-primary-50, #eff6ff);
}

.week-count {
  font-family: var(--od-font-mono, monospace);
  font-size: 13px;
  font-weight: 700;
  color: var(--od-gray-800, #1e293b);
}

.week-bar-container {
  width: 100%;
  max-width: 36px;
  height: 80px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.week-bar {
  width: 100%;
  border-radius: 6px 6px 2px 2px;
  background: linear-gradient(180deg, #3b82f6 0%, #1e40af 100%);
  transition: height 0.3s ease;
}

.week-column.today .week-bar {
  background: linear-gradient(180deg, #60a5fa 0%, #2563eb 100%);
  box-shadow: 0 0 10px rgba(37, 99, 235, 0.4);
}

.week-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--od-gray-500, #64748b);
}

.week-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid var(--od-gray-100, #f1f5f9);
  color: var(--od-gray-500, #64748b);
  font-size: 12px;
}

.drilldown-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--od-color-accent, #2563eb);
  font-weight: 600;
  cursor: pointer;
}

.result-list,
.notice-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item,
.notice-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--od-gray-50, #f8fafc);
  border: 1px solid var(--od-gray-200, #e2e8f0);
  cursor: pointer;
  transition: all 0.15s ease;
}

.result-item:hover,
.notice-item:hover {
  background: #fff;
  border-color: var(--od-primary-300, #93c5fd);
  box-shadow: var(--od-shadow-xs);
  transform: translateX(2px);
}

.result-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-id {
  font-family: var(--od-font-mono, monospace);
  font-size: 13px;
  font-weight: 600;
  color: var(--od-gray-900, #0f172a);
}

.source-tag {
  font-size: 11px;
}

.result-date,
.notice-time {
  font-size: 12px;
  color: var(--od-gray-500, #64748b);
}

.notice-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.notice-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2563eb;
  flex-shrink: 0;
}

.notice-title {
  font-size: 13px;
  color: var(--od-gray-800, #1e293b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notice-item.unread .notice-title {
  font-weight: 600;
}
</style>
