<script setup lang="ts">
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FieldTimeOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { requirementApi } from '@/api/portal'
import { useMessageStore } from '@/stores/message'
import type { RequirementOverlapCandidate, RequirementRequest } from '@/types/portal'
import EmptyState from '@/ui-kit/EmptyState.vue'
import ErrorState from '@/ui-kit/ErrorState.vue'
import { formatDateTime } from '@/ui-kit/format'
import OdTable from '@/ui-kit/OdTable.vue'
import { 中文展示 } from '@/ui-kit/展示文本'

const ASSIGN_TARGETS = [
  { value: 'data-platform', labelKey: 'admin.requirements.targetData' },
  { value: 'ontology-platform', labelKey: 'admin.requirements.targetOntology' },
  { value: 'algorithm-transform', labelKey: 'admin.requirements.targetTransform' },
  { value: 'algorithm-recombine', labelKey: 'admin.requirements.targetRecombine' },
  { value: 'portal', labelKey: 'admin.requirements.targetPortal' },
] as const

type HandlingPanel = 'overview' | 'analysis' | 'consolidation' | 'assignment' | 'progress' | 'close'

const { t } = useI18n()
const messageStore = useMessageStore()

const loading = ref(false)
const loadError = ref('')
const rows = ref<RequirementRequest[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, status: '', type: '', keyword: '' })

const drawerOpen = ref(false)
const current = ref<RequirementRequest | null>(null)
const acting = ref(false)
const activePanel = ref<HandlingPanel>('overview')
const assignForm = reactive({ assigneeSystem: 'data-platform', assigneeRef: '', owner: '', deliverable: '', targetDate: '', milestones: '' })
const closeForm = reactive({ closedNote: '' })
const analysisForm = reactive({ conclusion: '', feasibility: 'FEASIBLE' as 'FEASIBLE' | 'NEEDS_CLARIFICATION' | 'NOT_FEASIBLE', priority: 'MEDIUM' as 'HIGH' | 'MEDIUM' | 'LOW', risks: '' })
const overlapLoading = ref(false)
const overlapCandidates = ref<RequirementOverlapCandidate[]>([])
const consolidationOpen = ref(false)
const consolidating = ref(false)
const consolidationForm = reactive({ relatedCode: '', primaryCode: '', reason: '' })
const progressForm = reactive({ percent: '', note: '' })

const columns = computed(() => [
  { title: t('common.code'), dataIndex: 'code', key: 'code', width: 130, odEllipsis: true, odSortable: true, mono: true },
  { title: t('common.title'), dataIndex: 'title', key: 'title', width: 220, odEllipsis: true, odSortable: true },
  { title: t('common.type'), dataIndex: 'requirementType', key: 'requirementType', width: 110, odEllipsis: true, odSortable: true },
  { title: t('common.status'), dataIndex: 'status', key: 'status', width: 110, odSortable: true },
  { title: t('common.requester'), dataIndex: 'requester', key: 'requester', width: 100, odEllipsis: true, odSortable: true },
  { title: t('admin.requirements.updatedAt'), dataIndex: 'updatedAtText', key: 'updatedAtText', width: 130, odSortable: true },
  { title: t('common.action'), dataIndex: 'action', key: 'action', width: 90 },
])

const statusColor: Record<string, string> = {
  OPEN: 'cyan',
  ANALYZING: 'processing',
  ASSIGNED: 'geekblue',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  CANCELED: 'default',
}

const typeLabel = computed(
  () =>
    ({
      DATA: t('requirements.dataRequirement'),
      ALGORITHM: t('requirements.algorithmRequirement'),
      COMPREHENSIVE: t('requirements.comprehensiveRequirement'),
    }) as Record<string, string>,
)

const statusText = computed(
  () =>
    ({
      OPEN: t('requirements.open'),
      ANALYZING: t('requirements.analyzing'),
      ASSIGNED: t('requirements.assigned'),
      IN_PROGRESS: t('requirements.inProgress'),
      COMPLETED: t('requirements.completed'),
      CANCELED: t('requirements.canceled'),
    }) as Record<string, string>,
)

const handlingPanels = computed(() => {
  const requirement = current.value
  if (!requirement) return []

  const panels: Array<{ key: HandlingPanel; label: string }> = [
    { key: 'overview', label: t('requirements.handlingOverview') },
  ]
  if (requirement.status === 'OPEN') {
    panels.push({ key: 'analysis', label: t('requirements.handlingAnalysis') })
  } else if (requirement.status === 'ANALYZING') {
    if (requirement.requirementType === 'DATA') {
      panels.push({ key: 'consolidation', label: t('requirements.handlingConsolidation') })
    }
    panels.push({ key: 'assignment', label: t('requirements.handlingAssignment') })
  } else if (requirement.status === 'ASSIGNED') {
    panels.push({ key: 'progress', label: t('requirements.handlingProgress') })
  } else if (requirement.status === 'IN_PROGRESS') {
    panels.push(
      { key: 'progress', label: t('requirements.handlingProgress') },
      { key: 'close', label: t('requirements.handlingClose') },
    )
  }
  return panels
})

const handlingHint = computed(() => {
  const requirement = current.value
  if (!requirement) return ''
  if (requirement.status === 'OPEN') return t('requirements.handlingHintAnalysis')
  if (requirement.status === 'ANALYZING') {
    return requirement.requirementType === 'DATA'
      ? t('requirements.handlingHintConsolidation')
      : t('requirements.handlingHintAssignment')
  }
  if (requirement.status === 'ASSIGNED' || requirement.status === 'IN_PROGRESS') return t('requirements.handlingHintProgress')
  return t('requirements.handlingHintOverview')
})

const timelineFacts = computed(() => {
  const requirement = current.value
  if (!requirement) return []
  const facts = [{
    key: 'received',
    label: t('admin.requirements.received'),
    detail: t('requirements.receivedDetail', { requester: requirement.requester }),
    at: requirement.createdAt,
    color: 'blue',
  }]
  if (requirement.analysis) {
    facts.push({
      key: 'analysis',
      label: t('requirements.analysisRecorded'),
      detail: requirement.analysis.conclusion,
      at: requirement.analysis.analyzedAt ?? requirement.updatedAt,
      color: 'blue',
    })
  }
  if (requirement.consolidation) {
    facts.push({
      key: 'consolidation',
      label: t('requirements.consolidationRecorded'),
      detail: t('requirements.consolidationDetail', { code: requirement.consolidation.primaryCode, reason: requirement.consolidation.reason }),
      at: requirement.consolidation.consolidatedAt ?? requirement.updatedAt,
      color: 'purple',
    })
  }
  if (requirement.assigneeSystem || requirement.plan) {
    facts.push({
      key: 'assignment',
      label: t('requirements.assignmentRecorded'),
      detail: t('requirements.assignmentDetail', {
        system: 中文展示(requirement.assigneeSystem),
        owner: requirement.plan?.owner ?? '—',
        deliverable: requirement.plan?.deliverable ?? '—',
      }),
      at: requirement.updatedAt,
      color: 'cyan',
    })
  }
  requirement.progressEntries?.forEach((entry, index) => {
    facts.push({
      key: `progress-${index}`,
      label: t('requirements.progressRecorded', { percent: entry.percent }),
      detail: entry.note,
      at: entry.recordedAt ?? requirement.updatedAt,
      color: 'blue',
    })
  })
  if (requirement.closedNote) {
    facts.push({
      key: 'closed',
      label: requirement.status === 'CANCELED' ? t('requirements.canceled') : t('requirements.completed'),
      detail: requirement.closedNote,
      at: requirement.updatedAt,
      color: requirement.status === 'CANCELED' ? 'gray' : 'green',
    })
  }
  return facts
})

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
    const page = await requirementApi.list({
      page: query.page,
      size: query.size,
      status: query.status || undefined,
      type: query.type || undefined,
      keyword: query.keyword || undefined,
    })
    rows.value = page.items.map((item) => ({ ...item, updatedAtText: formatDateTime(item.updatedAt) }))
    total.value = page.total
    if (current.value) {
      current.value = page.items.find((item) => item.code === current.value?.code) ?? current.value
    }
  } catch (error) {
    loadError.value = describeLoadError(error)
    messageStore.reportError(error)
  } finally {
    loading.value = false
  }
}

function openHandle(record: RequirementRequest) {
  current.value = record
  activePanel.value = defaultHandlingPanel(record)
  assignForm.assigneeSystem = record.assigneeSystem || 'data-platform'
  assignForm.assigneeRef = record.assigneeRef || ''
  assignForm.owner = record.plan?.owner ?? ''
  assignForm.deliverable = record.plan?.deliverable ?? ''
  assignForm.targetDate = record.plan?.targetDate ?? ''
  assignForm.milestones = record.plan?.milestones ?? ''
  closeForm.closedNote = ''
  analysisForm.conclusion = record.analysis?.conclusion ?? ''
  analysisForm.feasibility = record.analysis?.feasibility ?? 'FEASIBLE'
  analysisForm.priority = record.analysis?.priority ?? 'MEDIUM'
  analysisForm.risks = record.analysis?.risks ?? ''
  progressForm.percent = ''
  progressForm.note = ''
  void loadOverlapCandidates(record)
  drawerOpen.value = true
}

function defaultHandlingPanel(record: RequirementRequest): HandlingPanel {
  if (record.status === 'OPEN') return 'analysis'
  if (record.status === 'ANALYZING') return record.requirementType === 'DATA' ? 'consolidation' : 'assignment'
  if (record.status === 'ASSIGNED' || record.status === 'IN_PROGRESS') return 'progress'
  return 'overview'
}

async function loadOverlapCandidates(record: RequirementRequest) {
  overlapCandidates.value = []
  if (record.requirementType !== 'DATA') return
  overlapLoading.value = true
  try {
    overlapCandidates.value = await requirementApi.overlapCandidates(record.code)
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    overlapLoading.value = false
  }
}

async function runAction(action: () => Promise<unknown>, successText: string) {
  acting.value = true
  try {
    const updated = (await action()) as RequirementRequest
    messageStore.success(successText)
    if (updated?.code) {
      current.value = updated
      activePanel.value = defaultHandlingPanel(updated)
    }
    await load()
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    acting.value = false
  }
}

async function analyze() {
  if (!current.value || !analysisForm.conclusion.trim()) {
    messageStore.warning(t('requirements.analysisConclusionRequired'))
    return
  }
  await runAction(
    () => requirementApi.analyze(current.value!.code, {
      analysis: {
        conclusion: analysisForm.conclusion.trim(),
        feasibility: analysisForm.feasibility,
        priority: analysisForm.priority,
        risks: analysisForm.risks.trim() || undefined,
      },
    }),
    t('requirements.analyzed', { code: current.value.code }),
  )
}

function openConsolidation(relatedCode: string, primaryCode: string) {
  consolidationForm.relatedCode = relatedCode
  consolidationForm.primaryCode = primaryCode
  consolidationForm.reason = ''
  consolidationOpen.value = true
}

async function consolidate() {
  if (!consolidationForm.reason.trim()) {
    messageStore.warning(t('requirements.consolidationReasonRequired'))
    return
  }
  consolidating.value = true
  try {
    await requirementApi.consolidate(consolidationForm.relatedCode, {
      primaryCode: consolidationForm.primaryCode,
      reason: consolidationForm.reason.trim(),
    })
    messageStore.success(t('requirements.consolidated'))
    consolidationOpen.value = false
    await load()
    if (current.value) await loadOverlapCandidates(current.value)
    activePanel.value = 'assignment'
  } catch (error) {
    messageStore.reportError(error)
  } finally {
    consolidating.value = false
  }
}

async function assign() {
  if (!current.value) return
  if (![assignForm.owner, assignForm.deliverable, assignForm.targetDate].every((value) => value.trim())) {
    messageStore.warning(t('requirements.assignmentPlanIncomplete'))
    return
  }
  await runAction(
    () =>
      requirementApi.assign(current.value!.code, {
        assigneeSystem: assignForm.assigneeSystem,
        assigneeRef: assignForm.assigneeRef || undefined,
        plan: {
          owner: assignForm.owner.trim(),
          deliverable: assignForm.deliverable.trim(),
          targetDate: assignForm.targetDate,
          milestones: assignForm.milestones.trim() || undefined,
        },
      }),
    t('requirements.assignedTo', { code: current.value.code, system: assignForm.assigneeSystem }),
  )
}

async function progress() {
  if (!current.value) return
  const percent = Number(progressForm.percent)
  if (!Number.isFinite(percent) || percent < 0 || percent > 100 || !progressForm.note.trim()) {
    messageStore.warning(t('requirements.progressIncomplete'))
    return
  }
  await runAction(
    () => requirementApi.progress(current.value!.code, { percent, note: progressForm.note.trim() }),
    t('requirements.progressed', { code: current.value.code }),
  )
}

async function complete() {
  if (!current.value || !closeForm.closedNote.trim()) return
  await runAction(
    () => requirementApi.complete(current.value!.code, { closedNote: closeForm.closedNote }),
    t('requirements.completedMessage', { code: current.value.code }),
  )
}

async function cancel() {
  if (!current.value) return
  await runAction(
    () => requirementApi.cancel(current.value!.code, { closedNote: closeForm.closedNote || undefined }),
    t('requirements.canceledMessage', { code: current.value.code }),
  )
}

onMounted(load)
</script>

<template>
  <div class="requirement-admin-view">
    <ErrorState
      v-if="loadError"
      :reason="loadError"
      :next-step="t('common.loadNextStep')"
      :action-label="t('common.reload')"
      @retry="load"
    />

    <a-card v-else :bordered="false" class="admin-card">
      <div class="toolbar-area">
        <a-space wrap>
          <a-select v-model:value="query.status" :placeholder="t('requirements.statusPlaceholder')" allow-clear style="width: 140px">
            <a-select-option value="OPEN">{{ t('requirements.open') }}</a-select-option>
            <a-select-option value="ANALYZING">{{ t('requirements.analyzing') }}</a-select-option>
            <a-select-option value="ASSIGNED">{{ t('requirements.assigned') }}</a-select-option>
            <a-select-option value="IN_PROGRESS">{{ t('requirements.inProgress') }}</a-select-option>
            <a-select-option value="COMPLETED">{{ t('requirements.completed') }}</a-select-option>
            <a-select-option value="CANCELED">{{ t('requirements.canceled') }}</a-select-option>
          </a-select>
          <a-select v-model:value="query.type" :placeholder="t('requirements.typePlaceholder')" allow-clear style="width: 140px">
            <a-select-option value="DATA">{{ t('requirements.dataRequirement') }}</a-select-option>
            <a-select-option value="ALGORITHM">{{ t('requirements.algorithmRequirement') }}</a-select-option>
            <a-select-option value="COMPREHENSIVE">{{ t('requirements.comprehensiveRequirement') }}</a-select-option>
          </a-select>
          <a-input
            v-model:value="query.keyword"
            :placeholder="t('admin.requirements.keywordPlaceholder')"
            style="width: 200px"
            allow-clear
            @press-enter="query.page = 1; load()"
          />
          <a-button type="primary" @click="query.page = 1; load()">
            <template #icon><SearchOutlined /></template>
            {{ t('common.query') }}
          </a-button>
        </a-space>
      </div>

      <EmptyState
        v-if="!loading && rows.length === 0"
        :title="t('admin.requirements.emptyTitle')"
        :description="t('admin.requirements.emptyDesc')"
      />

      <OdTable
        v-else
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        row-key="code"
        :pagination="{ current: query.page, pageSize: query.size, total, showTotal: (tot: number) => `共 ${tot} 项` }"
        @change="
          (pagination: { current?: number }) => {
            query.page = pagination.current ?? 1
            load()
          }
        "
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'code'">
            <span class="mono-code">{{ record.code }}</span>
          </template>
          <template v-else-if="column.key === 'requirementType'">
            <a-tag :color="record.requirementType === 'DATA' ? 'cyan' : record.requirementType === 'ALGORITHM' ? 'purple' : 'blue'">
              {{ typeLabel[record.requirementType] ?? record.requirementType }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColor[record.status]" class="status-tag">
              <template #icon>
                <FieldTimeOutlined v-if="record.status === 'OPEN'" />
                <SyncOutlined v-else-if="record.status === 'IN_PROGRESS' || record.status === 'ANALYZING'" spin />
                <CheckCircleOutlined v-else-if="record.status === 'COMPLETED'" />
                <CloseCircleOutlined v-else-if="record.status === 'CANCELED'" />
              </template>
              {{ statusText[record.status] ?? record.status }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'updatedAt'">
            {{ formatDateTime(record.updatedAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button size="small" type="primary" ghost @click="openHandle(record)">
              {{ t('admin.requirements.handle') }}
            </a-button>
          </template>
        </template>
      </OdTable>
    </a-card>

    <a-drawer
      v-model:open="drawerOpen"
      :title="current ? `${t('admin.requirements.handle')} ${current.code}` : ''"
      width="760"
      class="requirement-drawer"
    >
      <template v-if="current">
        <section class="handling-summary">
          <div class="handling-summary__heading">
            <div>
              <p class="handling-summary__eyebrow">{{ t('common.title') }}</p>
              <h2>{{ current.title }}</h2>
            </div>
            <a-tag :color="statusColor[current.status]">{{ statusText[current.status] ?? current.status }}</a-tag>
          </div>
          <p class="handling-summary__hint">{{ handlingHint }}</p>
        </section>

        <div class="handling-layout">
          <nav class="handling-nav" :aria-label="t('admin.requirements.handle')">
            <button
              v-for="(panel, index) in handlingPanels"
              :key="panel.key"
              type="button"
              :data-handling-target="panel.key"
              :class="['handling-nav__item', { 'handling-nav__item--active': activePanel === panel.key }]"
              :aria-current="activePanel === panel.key ? 'step' : undefined"
              @click="activePanel = panel.key"
            >
              <span class="handling-nav__index">{{ String(index + 1).padStart(2, '0') }}</span>
              <span>{{ panel.label }}</span>
            </button>
          </nav>

          <main class="handling-panel-wrap">
            <section v-if="activePanel === 'overview'" data-handling-panel="overview" class="handling-panel">
              <h3>{{ t('requirements.handlingOverview') }}</h3>
              <a-descriptions :column="1" size="small" class="drawer-meta">
                <a-descriptions-item :label="t('common.requester')">{{ current.requester }}</a-descriptions-item>
                <a-descriptions-item :label="t('common.status')">{{ statusText[current.status] ?? current.status }}</a-descriptions-item>
                <a-descriptions-item :label="t('requirements.assigneeTarget')">{{ 中文展示(current.assigneeSystem) }}</a-descriptions-item>
              </a-descriptions>

              <section v-if="current.dataProfile" class="drawer-fact-panel">
                <h4 class="drawer-section">{{ t('requirements.dataProfileTitle') }}</h4>
                <dl class="data-profile-grid">
                  <div><dt>{{ t('requirements.dataObject') }}</dt><dd>{{ current.dataProfile.dataObject }}</dd></div>
                  <div><dt>{{ t('requirements.dataScope') }}</dt><dd>{{ current.dataProfile.scope }}</dd></div>
                  <div><dt>{{ t('requirements.dataGranularity') }}</dt><dd>{{ current.dataProfile.granularity }}</dd></div>
                  <div><dt>{{ t('requirements.dataUseCase') }}</dt><dd>{{ current.dataProfile.useCase }}</dd></div>
                </dl>
                <p class="data-profile-fields">{{ t('requirements.dataFields') }}：{{ current.dataProfile.fields.join('、') }}</p>
              </section>

              <section class="timeline-panel">
                <h4 class="drawer-section">{{ t('admin.requirements.timeline') }}</h4>
                <a-timeline>
                  <a-timeline-item v-for="fact in timelineFacts" :key="fact.key" :color="fact.color">
                    <div class="timeline-fact">
                      <strong>{{ fact.label }}</strong>
                      <p>{{ fact.detail }}</p>
                      <time>{{ formatDateTime(fact.at) }}</time>
                    </div>
                  </a-timeline-item>
                </a-timeline>
              </section>
            </section>

            <section v-else-if="activePanel === 'analysis' && current.status === 'OPEN'" data-handling-panel="analysis" class="handling-panel">
              <div class="handling-panel__heading">
                <div>
                  <h3>{{ t('requirements.analysisTitle') }}</h3>
                  <p>{{ t('requirements.handlingHintAnalysis') }}</p>
                </div>
              </div>
              <a-form :model="analysisForm" layout="vertical" class="handling-form">
                <a-form-item
                  name="conclusion"
                  :label="t('requirements.analysisConclusion')"
                  :rules="[{ required: true, message: t('requirements.analysisConclusionRequired'), trigger: 'change' }]"
                >
                  <a-textarea v-model:value="analysisForm.conclusion" name="analysisConclusion" :placeholder="t('requirements.analysisConclusionPlaceholder')" :rows="4" />
                </a-form-item>
                <div class="handling-form__two-columns">
                  <a-form-item name="feasibility" :label="t('requirements.analysisFeasibility')" required>
                    <a-select v-model:value="analysisForm.feasibility">
                      <a-select-option value="FEASIBLE">{{ t('requirements.feasibilityFeasible') }}</a-select-option>
                      <a-select-option value="NEEDS_CLARIFICATION">{{ t('requirements.feasibilityClarification') }}</a-select-option>
                      <a-select-option value="NOT_FEASIBLE">{{ t('requirements.feasibilityNotFeasible') }}</a-select-option>
                    </a-select>
                  </a-form-item>
                  <a-form-item name="priority" :label="t('requirements.analysisPriority')" required>
                    <a-select v-model:value="analysisForm.priority">
                      <a-select-option value="HIGH">{{ t('requirements.priorityHigh') }}</a-select-option>
                      <a-select-option value="MEDIUM">{{ t('requirements.priorityMedium') }}</a-select-option>
                      <a-select-option value="LOW">{{ t('requirements.priorityLow') }}</a-select-option>
                    </a-select>
                  </a-form-item>
                </div>
                <a-form-item name="risks" :label="t('requirements.analysisRisks')">
                  <a-textarea v-model:value="analysisForm.risks" :placeholder="t('requirements.analysisRisksPlaceholder')" :rows="2" />
                </a-form-item>
                <div class="handling-form__actions">
                  <a-button type="primary" :loading="acting" @click="analyze">{{ t('requirements.submitAnalysis') }}</a-button>
                </div>
              </a-form>

              <section v-if="current.requirementType === 'DATA'" class="drawer-fact-panel overlap-panel">
                <div class="drawer-section-row">
                  <h4 class="drawer-section">{{ t('requirements.overlapCandidates') }}</h4>
                  <span v-if="overlapLoading" class="drawer-muted">{{ t('requirements.overlapCandidatesLoading') }}</span>
                </div>
                <p class="drawer-hint">{{ t('requirements.overlapCandidatesHint') }}</p>
                <div v-if="!overlapLoading && overlapCandidates.length === 0" class="overlap-empty">{{ t('requirements.overlapCandidatesEmpty') }}</div>
                <article v-for="candidate in overlapCandidates" :key="candidate.code" class="overlap-candidate">
                  <div class="overlap-candidate__head">
                    <strong>{{ candidate.title }}</strong>
                    <span class="overlap-score">{{ candidate.score }}% {{ t('requirements.matchDegree') }}</span>
                  </div>
                  <p>{{ candidate.code }} · {{ candidate.requester }} · {{ statusText[candidate.status] ?? candidate.status }}</p>
                  <div class="overlap-candidate__reasons">
                    <a-tag v-for="reason in candidate.reasons" :key="reason" color="blue">{{ reason }}</a-tag>
                  </div>
                  <p class="overlap-candidate__restriction">{{ t('requirements.analyzeBeforeConsolidation') }}</p>
                </article>
              </section>
            </section>

            <section v-else-if="activePanel === 'consolidation' && current.status === 'ANALYZING'" data-handling-panel="consolidation" class="handling-panel">
              <div class="handling-panel__heading">
                <div>
                  <h3>{{ t('requirements.handlingConsolidation') }}</h3>
                  <p>{{ t('requirements.handlingHintConsolidation') }}</p>
                </div>
              </div>
              <section class="overlap-panel">
                <div class="drawer-section-row">
                  <h4 class="drawer-section">{{ t('requirements.overlapCandidates') }}</h4>
                  <span v-if="overlapLoading" class="drawer-muted">{{ t('requirements.overlapCandidatesLoading') }}</span>
                </div>
                <p class="drawer-hint">{{ t('requirements.overlapCandidatesHint') }}</p>
                <div v-if="!overlapLoading && overlapCandidates.length === 0" class="overlap-empty">{{ t('requirements.overlapCandidatesEmpty') }}</div>
                <article v-for="candidate in overlapCandidates" :key="candidate.code" class="overlap-candidate">
                  <div class="overlap-candidate__head">
                    <strong>{{ candidate.title }}</strong>
                    <span class="overlap-score">{{ candidate.score }}% {{ t('requirements.matchDegree') }}</span>
                  </div>
                  <p>{{ candidate.code }} · {{ candidate.requester }} · {{ statusText[candidate.status] ?? candidate.status }}</p>
                  <div class="overlap-candidate__reasons">
                    <a-tag v-for="reason in candidate.reasons" :key="reason" color="blue">{{ reason }}</a-tag>
                  </div>
                  <div class="overlap-candidate__actions">
                    <a-button size="small" type="primary" ghost @click="openConsolidation(candidate.code, current.code)">{{ t('requirements.consolidateToCurrent') }}</a-button>
                    <a-button size="small" @click="openConsolidation(current.code, candidate.code)">{{ t('requirements.mergeCurrentIntoCandidate') }}</a-button>
                  </div>
                </article>
              </section>
            </section>

            <section v-else-if="activePanel === 'assignment' && current.status === 'ANALYZING'" data-handling-panel="assignment" class="handling-panel">
              <div class="handling-panel__heading"><div><h3>{{ t('requirements.handlingAssignment') }}</h3><p>{{ t('requirements.handlingHintAssignment') }}</p></div></div>
              <a-form :model="assignForm" layout="vertical" class="handling-form">
                <a-form-item name="assigneeSystem" :label="t('requirements.assignTargetLabel')" required>
                  <a-select v-model:value="assignForm.assigneeSystem">
                    <a-select-option v-for="target in ASSIGN_TARGETS" :key="target.value" :value="target.value">{{ t(target.labelKey) }}</a-select-option>
                  </a-select>
                </a-form-item>
                <a-form-item name="assigneeRef" :label="t('admin.requirements.assignNote')">
                  <a-input v-model:value="assignForm.assigneeRef" :placeholder="t('admin.requirements.assignNotePlaceholder')" />
                </a-form-item>
                <a-divider orientation="left" plain>{{ t('requirements.deliveryPlanTitle') }}</a-divider>
                <div class="handling-form__two-columns">
                  <a-form-item name="owner" :label="t('requirements.planOwner')" required>
                    <a-input v-model:value="assignForm.owner" name="planOwner" :placeholder="t('requirements.planOwnerPlaceholder')" />
                  </a-form-item>
                  <a-form-item name="targetDate" :label="t('requirements.planTargetDate')" required>
                    <a-input v-model:value="assignForm.targetDate" name="planTargetDate" type="date" />
                  </a-form-item>
                </div>
                <a-form-item name="deliverable" :label="t('requirements.planDeliverable')" required>
                  <a-input v-model:value="assignForm.deliverable" name="planDeliverable" :placeholder="t('requirements.planDeliverablePlaceholder')" />
                </a-form-item>
                <a-form-item name="milestones" :label="t('requirements.planMilestones')">
                  <a-textarea v-model:value="assignForm.milestones" name="planMilestones" :placeholder="t('requirements.planMilestonesPlaceholder')" :rows="3" />
                </a-form-item>
                <div class="handling-form__actions"><a-button type="primary" :loading="acting" @click="assign">{{ t('requirements.assign') }}</a-button></div>
              </a-form>
            </section>

            <section v-else-if="activePanel === 'progress' && (current.status === 'ASSIGNED' || current.status === 'IN_PROGRESS')" data-handling-panel="progress" class="handling-panel">
              <div class="handling-panel__heading"><div><h3>{{ t('requirements.progressTitle') }}</h3><p>{{ t('requirements.handlingHintProgress') }}</p></div></div>
              <a-form :model="progressForm" layout="vertical" class="handling-form">
                <a-form-item name="percent" :label="t('requirements.progressPercent')" required>
                  <a-input
                    v-model:value="progressForm.percent"
                    name="progressPercent"
                    type="number"
                    min="0"
                    max="100"
                    :placeholder="t('requirements.progressPercentPlaceholder')"
                  />
                </a-form-item>
                <a-form-item name="note" :label="t('requirements.progressNote')" required>
                  <a-textarea v-model:value="progressForm.note" name="progressNote" :placeholder="t('requirements.progressNotePlaceholder')" :rows="3" />
                </a-form-item>
                <div class="handling-form__actions"><a-button type="primary" :loading="acting" @click="progress">{{ t('requirements.submitProgress') }}</a-button></div>
              </a-form>
            </section>

            <section v-else-if="activePanel === 'close' && current.status === 'IN_PROGRESS'" data-handling-panel="close" class="handling-panel">
              <div class="handling-panel__heading"><div><h3>{{ t('requirements.handlingClose') }}</h3><p>{{ t('requirements.handlingHintClose') }}</p></div></div>
              <a-form :model="closeForm" layout="vertical" class="handling-form">
                <a-form-item name="closedNote" :label="t('requirements.closedNoteLabel')" required>
                  <a-textarea v-model:value="closeForm.closedNote" :placeholder="t('requirements.closedNotePlaceholder')" :rows="4" />
                </a-form-item>
                <div class="handling-form__actions">
                  <a-button type="primary" :loading="acting" :disabled="!closeForm.closedNote.trim()" @click="complete">{{ t('requirements.complete') }}</a-button>
                </div>
              </a-form>
            </section>
          </main>
        </div>
      </template>

      <template #footer>
        <a-space wrap>
          <a-button @click="drawerOpen = false">{{ t('common.close') }}</a-button>
          <a-button v-if="current && current.status !== 'COMPLETED' && current.status !== 'CANCELED'" danger :loading="acting" @click="cancel">
            {{ t('requirements.cancel') }}
          </a-button>
        </a-space>
      </template>
    </a-drawer>

    <a-modal v-model:open="consolidationOpen" :title="t('requirements.consolidationModal')" :confirm-loading="consolidating" @ok="consolidate">
      <a-form :model="consolidationForm" layout="vertical">
        <p class="consolidation-hint">{{ t('requirements.consolidationHint') }}</p>
        <a-form-item name="reason" :label="t('requirements.consolidationReason')" required>
          <a-textarea v-model:value="consolidationForm.reason" name="consolidationReason" :placeholder="t('requirements.consolidationReasonPlaceholder')" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
@layer blocks {
  .admin-card {
    border-radius: var(--od-radius-card, 0.75rem);
    box-shadow: var(--od-shadow-1, 0 0.25rem 0.75rem rgb(15 23 42 / 8%));
  }

  .toolbar-area {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .status-tag {
    border-radius: 0.25rem;
    font-weight: 500;
  }

  :deep(.requirement-drawer .ant-drawer-body) {
    padding: 0;
  }

  .handling-summary {
    padding: 1.25rem 1.5rem 1rem;
    border-bottom: 1px solid var(--od-gray-200, #e2e8f0);
    background: var(--od-gray-50, #f8fafc);
  }

  .handling-summary__heading,
  .drawer-section-row,
  .overlap-candidate__head,
  .overlap-candidate__actions,
  .handling-form__actions {
    display: flex;
    align-items: center;
  }

  .handling-summary__heading,
  .drawer-section-row,
  .overlap-candidate__head {
    justify-content: space-between;
    gap: 0.75rem;
  }

  .handling-summary__heading > div,
  .handling-panel__heading > div,
  .overlap-candidate__head strong {
    min-width: 0;
  }

  .handling-summary__eyebrow {
    margin: 0 0 0.25rem;
    color: var(--od-gray-500, #64748b);
    font-size: 0.75rem;
    line-height: 1.25;
  }

  .handling-summary h2,
  .handling-panel h3 {
    margin: 0;
    color: var(--od-gray-900, #0f172a);
    overflow-wrap: anywhere;
  }

  .handling-summary h2 {
    font-size: 1.125rem;
    line-height: 1.45;
  }

  .handling-summary__hint,
  .handling-panel__heading p,
  .data-profile-grid dt,
  .data-profile-fields,
  .drawer-hint,
  .drawer-muted,
  .overlap-candidate p,
  .timeline-fact p,
  .timeline-fact time,
  .consolidation-hint {
    color: var(--od-gray-500, #64748b);
    font-size: 0.75rem;
  }

  .handling-summary__hint {
    margin: 0.625rem 0 0;
    line-height: 1.6;
  }

  .handling-layout {
    display: grid;
    grid-template-columns: 12.5rem minmax(0, 1fr);
    min-height: 32rem;
    container-type: inline-size;
  }

  .handling-nav {
    display: flex;
    align-content: flex-start;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1rem 0.75rem;
    border-inline-end: 1px solid var(--od-gray-200, #e2e8f0);
    background: var(--od-gray-50, #f8fafc);
  }

  .handling-nav__item {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 2.75rem;
    gap: 0.625rem;
    padding: 0.625rem 0.75rem;
    border: 0;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--od-gray-600, #475569);
    cursor: pointer;
    font: inherit;
    font-size: 0.875rem;
    text-align: start;
    transition: background-color 160ms ease, color 160ms ease;
  }

  .handling-nav__item:hover {
    background: var(--od-primary-50, #eff6ff);
    color: var(--od-color-primary, #2563eb);
  }

  .handling-nav__item:focus-visible {
    outline: 0.1875rem solid var(--od-primary-200, #bfdbfe);
    outline-offset: 0.125rem;
  }

  .handling-nav__item--active {
    box-shadow: inset 0.1875rem 0 0 var(--od-color-primary, #2563eb);
    background: var(--od-primary-50, #eff6ff);
    color: var(--od-color-primary, #2563eb);
    font-weight: 650;
  }

  .handling-nav__index {
    color: inherit;
    font-family: var(--od-font-mono, ui-monospace, monospace);
    font-size: 0.6875rem;
    font-weight: 700;
  }

  .handling-panel-wrap {
    min-width: 0;
    padding: 1.5rem;
  }

  .handling-panel {
    min-height: 26rem;
  }

  .handling-panel__heading {
    margin-bottom: 1.5rem;
    padding-bottom: 0.875rem;
    border-bottom: 1px solid var(--od-gray-200, #e2e8f0);
  }

  .handling-panel__heading h3 {
    font-size: 1rem;
  }

  .handling-panel__heading p {
    margin: 0.5rem 0 0;
    line-height: 1.6;
  }

  .drawer-meta {
    margin-bottom: 1rem;
  }

  .drawer-section {
    margin: 0 0 0.75rem;
    color: var(--od-gray-800, #1e293b);
    font-size: 0.875rem;
    font-weight: 650;
  }

  .drawer-fact-panel {
    margin: 1.125rem 0;
    padding: 1rem;
    border: 1px solid var(--od-gray-200, #e2e8f0);
    border-radius: 0.625rem;
    background: var(--od-gray-50, #f8fafc);
  }

  .data-profile-grid,
  .handling-form__two-columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    margin: 0;
  }

  .data-profile-grid div {
    min-width: 0;
  }

  .data-profile-grid dt {
    margin-bottom: 0.1875rem;
  }

  .data-profile-grid dd {
    margin: 0;
    color: var(--od-gray-800, #1e293b);
    font-size: 0.8125rem;
    overflow-wrap: anywhere;
  }

  .data-profile-fields,
  .drawer-hint,
  .consolidation-hint {
    margin: 0.75rem 0 0;
    line-height: 1.6;
  }

  .drawer-section-row .drawer-section {
    margin-bottom: 0;
  }

  .overlap-empty {
    padding: 0.875rem;
    border: 1px dashed var(--od-gray-300, #cbd5e1);
    border-radius: 0.5rem;
    color: var(--od-gray-500, #64748b);
    font-size: 0.8125rem;
    text-align: center;
  }

  .overlap-candidate {
    margin-top: 0.625rem;
    padding: 0.875rem;
    border: 1px solid var(--od-primary-200, #bfdbfe);
    border-radius: 0.5rem;
    background: var(--od-surface, #fff);
  }

  .overlap-candidate__head strong {
    color: var(--od-gray-900, #0f172a);
    font-size: 0.8125rem;
  }

  .overlap-score {
    flex: 0 0 auto;
    color: var(--od-color-primary, #2563eb);
    font-size: 0.75rem;
    font-weight: 700;
  }

  .overlap-candidate p {
    margin: 0.375rem 0;
  }

  .overlap-candidate__reasons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    min-width: 0;
    margin: 0.625rem 0 0.75rem;
  }

  .overlap-candidate__restriction {
    margin: 0;
  }

  .overlap-candidate__actions,
  .handling-form__actions {
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .timeline-panel {
    margin-top: 1.5rem;
  }

  .timeline-fact strong {
    display: block;
    color: var(--od-gray-800, #1e293b);
    font-size: 0.8125rem;
  }

  .timeline-fact p {
    margin: 0.1875rem 0;
    line-height: 1.5;
  }

  .timeline-fact time {
    display: block;
  }

  @container (max-width: 40rem) {
    .handling-layout {
      grid-template-columns: minmax(0, 1fr);
      min-height: 0;
    }

    .handling-nav {
      flex-direction: row;
      overflow-x: auto;
      padding: 0.75rem;
      border-right: 0;
      border-bottom: 1px solid var(--od-gray-200, #e2e8f0);
    }

    .handling-nav__item {
      flex: 0 0 auto;
      width: auto;
    }

    .handling-panel-wrap {
      padding: 1rem;
    }

    .handling-panel {
      min-height: 0;
    }

    .data-profile-grid,
    .handling-form__two-columns {
      grid-template-columns: minmax(0, 1fr);
    }
  }
}
</style>
