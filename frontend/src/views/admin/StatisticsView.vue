<script setup lang="ts">
/**
 * 运营统计看板（D3）：六组 KPI + 申请量趋势 + 任务状态分布 + 反馈处理。
 * 图表为轻量 SVG/CSS 实现（零依赖）；数据为确定性伪随机演示序列，
 * 真实模式契约对齐 GET /api/v1/operations/statistics/series。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { dailySeries, toLinePoints } from '@/utils/series'
import { downloadBlob, mockResultFile } from '@/utils/download'

const { t } = useI18n()

const granularity = ref<'day' | 'week'>('day')

// ── 确定性演示序列 ──
const applySeries = dailySeries(30, 18, 14, 101)
const taskSeries = dailySeries(30, 12, 10, 202)
const deliverySeries = dailySeries(30, 8, 8, 303)
const visitSeries = dailySeries(30, 120, 80, 404)
const activeSeries = dailySeries(30, 26, 16, 505)

const feedback = { pending: 2, handled: 9, avgHours: 26 }

// ── KPI（近 30 天合计） ──
const kpis = computed(() => {
  const sum = (series: typeof applySeries) => series.reduce((total, point) => total + point.value, 0)
  return [
    { key: 'visits', label: t('admin.statistics.kpiVisits'), value: sum(visitSeries).toLocaleString() },
    { key: 'applications', label: t('admin.statistics.kpiApplications'), value: sum(applySeries) },
    { key: 'tasks', label: t('admin.statistics.kpiTasks'), value: sum(taskSeries) },
    { key: 'deliveries', label: t('admin.statistics.kpiDeliveries'), value: sum(deliverySeries) },
    { key: 'activeUsers', label: t('admin.statistics.kpiActive'), value: Math.max(...activeSeries.map((point) => point.value)) },
    { key: 'feedbacks', label: t('admin.statistics.kpiFeedback'), value: `${feedback.handled}/${feedback.handled + feedback.pending}` },
  ]
})

/** 按粒度聚合（week：7 天一组求和）。 */
const applyValues = computed(() => {
  const series = applySeries.map((point) => point.value)
  return granularity.value === 'day' ? series : chunkSum(series, 7)
})

const applyLabels = computed(() => {
  const series = applySeries
  return granularity.value === 'day'
    ? series.map((point) => point.date.slice(5))
    : series.filter((_, index) => index % 7 === 0).map((point) => point.date.slice(5))
})

function chunkSum(values: number[], size: number): number[] {
  const result: number[] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size).reduce((total, value) => total + value, 0))
  }
  return result
}

/** 任务状态分布（来自种子任务状态机）。 */
const taskStatusDistribution = [
  { label: t('admin.statistics.taskRunning'), value: 3, color: '#2563eb' },
  { label: t('admin.statistics.taskQueued'), value: 2, color: '#60a5fa' },
  { label: t('admin.statistics.taskSuccess'), value: 6, color: '#16a34a' },
  { label: t('admin.statistics.taskFailed'), value: 2, color: '#dc2626' },
  { label: t('admin.statistics.taskCancelled'), value: 1, color: '#94a3b8' },
]

const linePoints = computed(() => toLinePoints(applyValues.value, 520, 140))

/** D3-2：CSV 导出（日期,申请量）。 */
function exportCsv(): void {
  const rows = applySeries.map((point) => [point.date, String(point.value)])
  const blob = mockResultFile(t('admin.statistics.exportName'), [])
  const csv = ['date,applications', ...rows.map((row) => row.join(','))].join('\n')
  downloadBlob(`${t('admin.statistics.exportName')}.csv`, 'text/csv', new Blob([`\uFEFF${csv}`], { type: 'text/csv' }))
  void blob
}
</script>

<template>
  <div class="statistics-view">
    <div class="kpi-row">
      <div v-for="kpi in kpis" :key="kpi.key" class="kpi-card">
        <span class="kpi-label">{{ kpi.label }}</span>
        <span class="kpi-value">{{ kpi.value }}</span>
      </div>
    </div>

    <div class="chart-grid">
      <section class="chart-panel">
        <div class="chart-head">
          <h3>{{ t('admin.statistics.applyTrend') }}</h3>
          <a-radio-group v-model:value="granularity" size="small">
            <a-radio-button value="day">{{ t('admin.statistics.granularityDay') }}</a-radio-button>
            <a-radio-button value="week">{{ t('admin.statistics.granularityWeek') }}</a-radio-button>
          </a-radio-group>
        </div>
        <svg
          class="trend-svg"
          viewBox="0 0 520 150"
          preserveAspectRatio="none"
          role="img"
          :aria-label="t('admin.statistics.applyTrend')"
        >
          <polyline :points="linePoints" fill="none" stroke="#2563eb" stroke-width="2" />
        </svg>
        <div class="trend-labels">
          <span>{{ applyLabels[0] }}</span>
          <span>{{ applyLabels[applyLabels.length - 1] }}</span>
        </div>
      </section>

      <section class="chart-panel">
        <h3>{{ t('admin.statistics.taskDistribution') }}</h3>
        <div class="stack-bar">
          <div
            v-for="segment in taskStatusDistribution"
            :key="segment.label"
            class="stack-segment"
            :style="{ width: `${(segment.value / 14) * 100}%`, background: segment.color }"
            :title="`${segment.label} ${segment.value}`"
          ></div>
        </div>
        <ul class="stack-legend">
          <li v-for="segment in taskStatusDistribution" :key="segment.label">
            <span class="legend-dot" :style="{ background: segment.color }"></span>
            {{ segment.label }} · {{ segment.value }}
          </li>
        </ul>

        <h3 class="feedback-title">{{ t('admin.statistics.feedbackTitle') }}</h3>
        <div class="feedback-row">
          <a-progress
            :percent="Math.round((feedback.handled / (feedback.handled + feedback.pending)) * 100)"
            size="small"
          />
        </div>
        <p class="feedback-meta">
          {{ t('admin.statistics.feedbackHandled') }} {{ feedback.handled }} ·
          {{ t('admin.statistics.feedbackPending') }} {{ feedback.pending }} ·
          {{ t('admin.statistics.feedbackAvg') }} {{ feedback.avgHours }}h
        </p>
      </section>
    </div>

    <div class="export-row">
      <a-button size="small" @click="exportCsv">{{ t('admin.statistics.exportCsv') }}</a-button>
    </div>
  </div>
</template>

<style scoped>
.statistics-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.kpi-card {
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 10px;
  background: #fff;
}

.kpi-label {
  font-size: 12px;
  color: var(--od-gray-500, #64748b);
}

.kpi-value {
  font-size: 22px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.chart-grid {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 16px;
}

.chart-panel {
  padding: 16px 18px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 12px;
  background: #fff;
}

.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.chart-panel h3 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}

.trend-svg {
  width: 100%;
  height: 150px;
}

.trend-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--od-gray-500, #64748b);
}

.stack-bar {
  display: flex;
  height: 14px;
  border-radius: 7px;
  overflow: hidden;
}

.stack-legend {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-size: 12px;
  color: var(--od-gray-500, #64748b);
}

.legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}

.feedback-title {
  margin-top: 16px;
}

.feedback-meta {
  font-size: 12px;
  color: var(--od-gray-500, #64748b);
}

.export-row {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 1100px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
