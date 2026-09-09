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
import PageHeader from '@/ui-kit/PageHeader.vue'
import { 中文展示 } from '@/ui-kit/展示文本'

const ASSIGN_TARGETS = [
  { value: 'data-platform', labelKey: 'admin.requirements.targetData' },
  { value: 'ontology-platform', labelKey: 'admin.requirements.targetOntology' },
  { value: 'algorithm-transform', labelKey: 'admin.requirements.targetTransform' },
  { value: 'algorithm-recombine', labelKey: 'admin.requirements.targetRecombine' },
  { value: 'portal', labelKey: 'admin.requirements.targetPortal' },
] as const

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
  { title: t('common.code'), dataIndex: 'code', key: 'code', width: 130, odEllipsis: true, odSortable: true },
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
    if (updated?.code) current.value = updated
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
    <PageHeader :eyebrow="t('menu.admin')" :title="t('menu.adminRequirements')" />

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

    <a-drawer v-model:open="drawerOpen" :title="current ? `${t('admin.requirements.handle')} ${current.code}` : ''" width="480">
      <template v-if="current">
        <a-descriptions :column="1" size="small" class="drawer-meta">
          <a-descriptions-item :label="t('common.title')">{{ current.title }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.requester')">{{ current.requester }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.status')">{{ statusText[current.status] ?? current.status }}</a-descriptions-item>
          <a-descriptions-item :label="t('requirements.assigneeTarget')">{{ 中文展示(current.assigneeSystem) }}</a-descriptions-item>
        </a-descriptions>

        <section v-if="current.dataProfile" class="drawer-fact-panel">
          <h3 class="drawer-section">{{ t('requirements.dataProfileTitle') }}</h3>
          <dl class="data-profile-grid">
            <div><dt>{{ t('requirements.dataObject') }}</dt><dd>{{ current.dataProfile.dataObject }}</dd></div>
            <div><dt>{{ t('requirements.dataScope') }}</dt><dd>{{ current.dataProfile.scope }}</dd></div>
            <div><dt>{{ t('requirements.dataGranularity') }}</dt><dd>{{ current.dataProfile.granularity }}</dd></div>
            <div><dt>{{ t('requirements.dataUseCase') }}</dt><dd>{{ current.dataProfile.useCase }}</dd></div>
          </dl>
          <p class="data-profile-fields">{{ t('requirements.dataFields') }}：{{ current.dataProfile.fields.join('、') }}</p>
        </section>

        <a-form v-if="current.status === 'OPEN'" layout="vertical" class="drawer-fact-panel">
          <h3 class="drawer-section">{{ t('requirements.analysisTitle') }}</h3>
          <a-form-item name="analysisConclusion" :label="t('requirements.analysisConclusion')" required>
            <a-textarea v-model:value="analysisForm.conclusion" name="analysisConclusion" :placeholder="t('requirements.analysisConclusionPlaceholder')" :rows="3" />
          </a-form-item>
          <a-form-item name="analysisFeasibility" :label="t('requirements.analysisFeasibility')" required>
            <a-select v-model:value="analysisForm.feasibility">
              <a-select-option value="FEASIBLE">{{ t('requirements.feasibilityFeasible') }}</a-select-option>
              <a-select-option value="NEEDS_CLARIFICATION">{{ t('requirements.feasibilityClarification') }}</a-select-option>
              <a-select-option value="NOT_FEASIBLE">{{ t('requirements.feasibilityNotFeasible') }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item name="analysisPriority" :label="t('requirements.analysisPriority')" required>
            <a-select v-model:value="analysisForm.priority">
              <a-select-option value="HIGH">{{ t('requirements.priorityHigh') }}</a-select-option>
              <a-select-option value="MEDIUM">{{ t('requirements.priorityMedium') }}</a-select-option>
              <a-select-option value="LOW">{{ t('requirements.priorityLow') }}</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item name="analysisRisks" :label="t('requirements.analysisRisks')">
            <a-textarea v-model:value="analysisForm.risks" :placeholder="t('requirements.analysisRisksPlaceholder')" :rows="2" />
          </a-form-item>
        </a-form>

        <section v-if="current.requirementType === 'DATA'" class="drawer-fact-panel overlap-panel">
          <div class="drawer-section-row">
            <h3 class="drawer-section">{{ t('requirements.overlapCandidates') }}</h3>
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
            <a-space size="small" wrap>
              <a-tag v-for="reason in candidate.reasons" :key="reason" color="blue">{{ reason }}</a-tag>
            </a-space>
            <div v-if="current.status === 'ANALYZING'" class="overlap-candidate__actions">
              <a-button size="small" type="primary" ghost @click="openConsolidation(candidate.code, current.code)">
                {{ t('requirements.consolidateToCurrent') }}
              </a-button>
              <a-button size="small" @click="openConsolidation(current.code, candidate.code)">
                {{ t('requirements.mergeCurrentIntoCandidate') }}
              </a-button>
            </div>
            <p v-else class="overlap-candidate__restriction">{{ t('requirements.analyzeBeforeConsolidation') }}</p>
          </article>
        </section>

        <h3 class="drawer-section">{{ t('admin.requirements.timeline') }}</h3>
        <a-timeline>
          <a-timeline-item v-for="fact in timelineFacts" :key="fact.key" :color="fact.color">
            <div class="timeline-fact">
              <strong>{{ fact.label }}</strong>
              <p>{{ fact.detail }}</p>
              <time>{{ formatDateTime(fact.at) }}</time>
            </div>
          </a-timeline-item>
        </a-timeline>

        <a-form v-if="current.status === 'ANALYZING'" layout="vertical">
          <a-form-item name="assigneeSystem" :label="t('requirements.assignTargetLabel')" required>
            <a-select v-model:value="assignForm.assigneeSystem">
              <a-select-option v-for="target in ASSIGN_TARGETS" :key="target.value" :value="target.value">
                {{ t(target.labelKey) }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item name="assigneeRef" :label="t('admin.requirements.assignNote')">
            <a-input v-model:value="assignForm.assigneeRef" :placeholder="t('admin.requirements.assignNotePlaceholder')" />
          </a-form-item>
          <a-divider orientation="left" plain>{{ t('requirements.deliveryPlanTitle') }}</a-divider>
          <a-form-item name="planOwner" :label="t('requirements.planOwner')" required>
            <a-input v-model:value="assignForm.owner" name="planOwner" :placeholder="t('requirements.planOwnerPlaceholder')" />
          </a-form-item>
          <a-form-item name="planDeliverable" :label="t('requirements.planDeliverable')" required>
            <a-input v-model:value="assignForm.deliverable" name="planDeliverable" :placeholder="t('requirements.planDeliverablePlaceholder')" />
          </a-form-item>
          <a-form-item name="planTargetDate" :label="t('requirements.planTargetDate')" required>
            <a-input v-model:value="assignForm.targetDate" name="planTargetDate" type="date" />
          </a-form-item>
          <a-form-item name="planMilestones" :label="t('requirements.planMilestones')">
            <a-textarea v-model:value="assignForm.milestones" name="planMilestones" :placeholder="t('requirements.planMilestonesPlaceholder')" :rows="2" />
          </a-form-item>
        </a-form>

        <a-form v-if="current.status === 'ASSIGNED' || current.status === 'IN_PROGRESS'" layout="vertical" class="drawer-fact-panel">
          <h3 class="drawer-section">{{ t('requirements.progressTitle') }}</h3>
          <a-form-item name="progressPercent" :label="t('requirements.progressPercent')" required>
            <a-input
              v-model:value="progressForm.percent"
              name="progressPercent"
              type="number"
              min="0"
              max="100"
              :placeholder="t('requirements.progressPercentPlaceholder')"
            />
          </a-form-item>
          <a-form-item name="progressNote" :label="t('requirements.progressNote')" required>
            <a-textarea v-model:value="progressForm.note" name="progressNote" :placeholder="t('requirements.progressNotePlaceholder')" :rows="2" />
          </a-form-item>
        </a-form>

        <a-form v-if="current.status === 'IN_PROGRESS'" layout="vertical">
          <a-form-item name="closedNote" :label="t('requirements.closedNoteLabel')" required>
            <a-textarea v-model:value="closeForm.closedNote" :placeholder="t('requirements.closedNotePlaceholder')" :rows="3" />
          </a-form-item>
        </a-form>
      </template>

      <template #footer>
        <a-space wrap>
          <a-button v-if="current?.status === 'OPEN'" type="primary" :loading="acting" @click="analyze">
            {{ t('requirements.submitAnalysis') }}
          </a-button>
          <a-button v-if="current?.status === 'ANALYZING'" type="primary" :loading="acting" @click="assign">
            {{ t('requirements.assign') }}
          </a-button>
          <a-button v-if="current?.status === 'ASSIGNED' || current?.status === 'IN_PROGRESS'" type="primary" :loading="acting" @click="progress">
            {{ t('requirements.submitProgress') }}
          </a-button>
          <a-button
            v-if="current?.status === 'IN_PROGRESS'"
            type="primary"
            :loading="acting"
            :disabled="!closeForm.closedNote.trim()"
            @click="complete"
          >
            {{ t('requirements.complete') }}
          </a-button>
          <a-button
            v-if="current && current.status !== 'COMPLETED' && current.status !== 'CANCELED'"
            danger
            :loading="acting"
            @click="cancel"
          >
            {{ t('requirements.cancel') }}
          </a-button>
        </a-space>
      </template>
    </a-drawer>

    <a-modal v-model:open="consolidationOpen" :title="t('requirements.consolidationModal')" :confirm-loading="consolidating" @ok="consolidate">
      <a-form layout="vertical">
        <p class="consolidation-hint">{{ t('requirements.consolidationHint') }}</p>
        <a-form-item name="consolidationReason" :label="t('requirements.consolidationReason')" required>
          <a-textarea v-model:value="consolidationForm.reason" name="consolidationReason" :placeholder="t('requirements.consolidationReasonPlaceholder')" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.admin-card {
  border-radius: var(--od-radius-card, 12px);
  box-shadow: var(--od-shadow-1);
}

.toolbar-area {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.mono-code {
  font-family: var(--od-font-mono, monospace);
  font-weight: 600;
}

.status-tag {
  font-weight: 500;
  border-radius: 4px;
}

.drawer-meta {
  margin-bottom: 16px;
}

.drawer-section {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 650;
}

.drawer-fact-panel {
  margin: 18px 0;
  padding: 16px;
  border: 1px solid var(--od-gray-200, #e2e8f0);
  border-radius: 10px;
  background: var(--od-gray-50, #f8fafc);
}

.data-profile-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 0;
}

.data-profile-grid div {
  min-width: 0;
}

.data-profile-grid dt,
.data-profile-fields,
.drawer-hint,
.drawer-muted,
.overlap-candidate p,
.timeline-fact p,
.timeline-fact time,
.consolidation-hint {
  color: var(--od-gray-500, #64748b);
  font-size: 12px;
}

.data-profile-grid dt {
  margin-bottom: 3px;
}

.data-profile-grid dd {
  margin: 0;
  color: var(--od-gray-800, #1e293b);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.data-profile-fields,
.drawer-hint,
.consolidation-hint {
  margin: 12px 0 0;
  line-height: 1.6;
}

.drawer-section-row,
.overlap-candidate__head,
.overlap-candidate__actions {
  display: flex;
  align-items: center;
}

.drawer-section-row,
.overlap-candidate__head {
  justify-content: space-between;
  gap: 12px;
}

.drawer-section-row .drawer-section {
  margin-bottom: 0;
}

.overlap-empty {
  padding: 14px;
  border: 1px dashed var(--od-gray-300, #cbd5e1);
  border-radius: 8px;
  color: var(--od-gray-500, #64748b);
  font-size: 13px;
  text-align: center;
}

.overlap-candidate {
  margin-top: 10px;
  padding: 12px;
  border: 1px solid var(--od-primary-200, #bfdbfe);
  border-radius: 8px;
  background: #fff;
}

.overlap-candidate__head strong {
  min-width: 0;
  color: var(--od-gray-900, #0f172a);
  font-size: 13px;
}

.overlap-score {
  flex: 0 0 auto;
  color: var(--od-color-primary, #1e40af);
  font-size: 12px;
  font-weight: 700;
}

.overlap-candidate p {
  margin: 6px 0;
}

.overlap-candidate__actions {
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.timeline-fact strong {
  display: block;
  color: var(--od-gray-800, #1e293b);
  font-size: 13px;
}

.timeline-fact p {
  margin: 3px 0;
  line-height: 1.5;
}

.timeline-fact time {
  display: block;
}

@media (max-width: 480px) {
  .data-profile-grid {
    grid-template-columns: 1fr;
  }

  .drawer-fact-panel {
    padding: 12px;
  }
}
</style>
