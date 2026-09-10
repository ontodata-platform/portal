<script setup lang="ts">
/**
 * 统一事项详情（C1）：审批/申请/需求/任务/结果共用一个单据视图。
 * 结构：单号与状态 → 基础信息 → 统一时间轴 → 动作区。
 * 路由 /matter/:type/:code，type ∈ approval|application|requirement|task|result（application 归入 approval 视图）。
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { matterApi, type MatterKind } from '@/api/matter'
import type { MatterDetail } from '@/types/portal'
import ErrorState from '@/ui-kit/ErrorState.vue'
import PageHeader from '@/ui-kit/PageHeader.vue'
import SkeletonList from '@/ui-kit/SkeletonList.vue'
import { 中文展示 } from '@/ui-kit/展示文本'

const route = useRoute()
const { t } = useI18n()

const kind = computed(() => route.params.type as MatterKind)
const code = computed(() => String(route.params.code ?? ''))

const matter = ref<MatterDetail | null>(null)
const loading = ref(false)
const loadError = ref('')

const DONE_STATUS = ['APPROVED', 'SUCCESS', 'COMPLETED', 'DELIVERED', 'PUBLISHED']
const TERMINAL_BAD_STATUS = ['REJECTED', 'FAILED', 'CANCELED', 'CANCELLED']

const statusTone = computed(() => {
  const status = matter.value?.status ?? ''
  if (DONE_STATUS.includes(status)) return 'success' as const
  if (TERMINAL_BAD_STATUS.includes(status)) return 'blocked' as const
  return 'running' as const
})

const timelineState = (state: string): string => (state === 'done' ? 'green' : state === 'blocked' ? 'red' : 'blue')

async function load(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    matter.value = await matterApi.getMatter(kind.value, code.value)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="matter-view">
    <PageHeader
      :title="matter?.title ?? t('matter.title')"
      :status="matter ? statusTone : undefined"
      :status-label="matter ? 中文展示(matter.status) : undefined"
      :description="`${matter?.code ?? code}`"
      back-to="/personal"
    />

    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />
    <SkeletonList v-else-if="loading" variant="list" :rows="4" />

    <template v-else-if="matter">
      <section class="matter-panel">
        <h3 class="matter-panel-title">{{ t('matter.baseInfo') }}</h3>
        <a-descriptions bordered :column="2" size="small">
          <a-descriptions-item :label="t('common.code')">
            <span class="cell-mono">{{ matter.code }}</span>
          </a-descriptions-item>
          <a-descriptions-item :label="t('matter.kindLabel')">{{ 中文展示(matter.kind) }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.status')">{{ 中文展示(matter.status) }}</a-descriptions-item>
          <a-descriptions-item v-if="matter.slaStatus" :label="t('approvals.slaStatus')">{{ 中文展示(matter.slaStatus) }}</a-descriptions-item>
          <a-descriptions-item v-if="matter.requester" :label="t('common.applicant')">{{ matter.requester }}</a-descriptions-item>
        </a-descriptions>
      </section>

      <section class="matter-panel">
        <h3 class="matter-panel-title">{{ t('matter.timeline') }}</h3>
        <a-timeline>
          <a-timeline-item v-for="(item, index) in matter.timeline" :key="index" :color="timelineState(item.state)">
            <span class="timeline-title">{{ item.title }}</span>
            <span class="timeline-time cell-mono">{{ item.time.slice(0, 16).replace('T', ' ') }}</span>
          </a-timeline-item>
        </a-timeline>
      </section>

      <section v-if="matter.detail && Object.keys(matter.detail).length > 0" class="matter-panel">
        <h3 class="matter-panel-title">{{ t('matter.detail') }}</h3>
        <a-descriptions bordered :column="1" size="small">
          <a-descriptions-item v-for="(value, key) in matter.detail" :key="key" :label="String(key)">
            {{ typeof value === 'object' ? JSON.stringify(value) : String(value) }}
          </a-descriptions-item>
        </a-descriptions>
      </section>
    </template>
  </div>
</template>

<style scoped>
.matter-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 960px;
  margin: 0 auto;
}

.matter-panel {
  padding: 16px 20px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 12px;
  background: #fff;
}

.matter-panel-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
}

.timeline-title {
  font-size: 13px;
}

.timeline-time {
  margin-left: 10px;
  font-size: 11px;
  color: var(--od-gray-500, #64748b);
}
</style>
