<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { personalApi, resultApi, taskApi } from '@/api/portal'
import type { PortalNotification, PortalResult, PortalTask } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'

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
    count: bucket.count,
    heightPercent: Math.round((bucket.count / max) * 100),
    isToday: bucket.date.toDateString() === new Date().toDateString(),
  }))
})

const weekTotal = computed(() => weekBars.value.reduce((sum, bucket) => sum + bucket.count, 0))

async function load() {
  // 各源独立加载：单一来源异常不影响其余区块（fail-soft）
  const [resultPage, noticePage, taskPage] = await Promise.allSettled([
    resultApi.list({ page: 1, size: 3 }),
    personalApi.notifications({ page: 1, size: 3 }),
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
    <a-card size="small" class="week-card">
      <template #title>{{ t('personal.overview.weeklyTitle') }}</template>
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
          :title="`${bar.label} · ${bar.count}`"
          role="button"
          tabindex="0"
          @click="router.push('/personal/tasks')"
          @keydown.enter="router.push('/personal/tasks')"
        >
          <span class="week-count">{{ bar.count }}</span>
          <span class="week-bar" :style="{ height: `${Math.max(bar.heightPercent, 4)}%` }"></span>
          <span class="week-label">{{ bar.label }}</span>
        </div>
      </div>
      <div class="week-foot">
        <span>{{ t('personal.overview.weeklyTotal', { total: weekTotal }) }}</span>
        <a @click="router.push('/personal/tasks')">{{ t('personal.overview.weeklyLink') }}</a>
      </div>
    </a-card>

    <a-row :gutter="16">
      <a-col :xs="24" :lg="12">
        <a-card :title="t('personal.overview.recentResults')" size="small">
          <EmptyState
            v-if="results.length === 0"
            :title="t('personal.overview.emptyResults')"
            :action-label="t('personal.overview.tabResults')"
            @action="router.push('/personal/results')"
          />
          <a-list v-else :data-source="results">
            <template #renderItem="{ item }">
              <a-list-item>{{ item.resultId }} · {{ item.sourceSystem }}</a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="12">
        <a-card :title="t('personal.overview.recentNotifications')" size="small">
          <EmptyState
            v-if="notifications.length === 0"
            :title="t('personal.overview.emptyNotifications')"
            :action-label="t('personal.overview.tabNotifications')"
            @action="router.push('/personal/notifications')"
          />
          <a-list v-else :data-source="notifications">
            <template #renderItem="{ item }">
              <a-list-item>{{ item.title }}</a-list-item>
            </template>
          </a-list>
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

.week-card {
  border-radius: var(--od-radius-card, 12px);
}

.week-chart {
  display: flex;
  align-items: stretch;
  gap: 12px;
  height: 132px;
}

.week-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  border-radius: 8px;
  padding: 8px 4px;
  cursor: pointer;
}

.week-column:hover,
.week-column.today {
  background: color-mix(in srgb, var(--od-color-accent, #2b6cb0) 8%, transparent);
}

.week-count {
  font-family: var(--od-font-mono, monospace);
  font-size: 13px;
  font-weight: 600;
  color: var(--od-color-ink, #102a43);
}

.week-bar {
  width: 100%;
  max-width: 48px;
  border-radius: 6px 6px 2px 2px;
  background: var(--od-chart-1, #1f4e79);
  opacity: 0.85;
}

.week-column.today .week-bar {
  background: var(--od-color-accent, #2b6cb0);
  opacity: 1;
}

.week-label {
  font-size: 12px;
  color: var(--od-color-muted, #52677a);
}

.week-foot {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  color: var(--od-color-muted, #52677a);
  font-size: 12px;
}

.week-foot a {
  cursor: pointer;
}
</style>
